import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ANALYSIS_DIR = path.join(LAB_DIR, "analysis");
const DATASET_FILE = path.join(ANALYSIS_DIR, "dataset.jsonl");
const PASS_LABELS = new Set(["correct"]);
const NOT_PASS_LABELS = new Set(["skip", "repeat", "wrong"]);
const KNOWN_LABELS = new Set([...PASS_LABELS, ...NOT_PASS_LABELS]);
const POLICY_VERSION = "recite-lab-policy-sim-v0.1";

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    audioOnly: false,
    scope: null,
    maxFalsePasses: 0,
    maxFalseRejectRate: 0.12,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--audio-only") {
      options.audioOnly = true;
    } else if (arg === "--scope") {
      const value = argv[index + 1];
      if (!value) throw new Error("--scope must be followed by a scope label.");
      options.scope = value;
      index += 1;
    } else if (arg === "--max-false-passes") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--max-false-passes must be followed by a number >= 0.");
      }
      options.maxFalsePasses = value;
      index += 1;
    } else if (arg === "--max-false-reject-rate") {
      const value = Number.parseFloat(argv[index + 1] ?? "");
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error("--max-false-reject-rate must be followed by a number from 0 to 1.");
      }
      options.maxFalseRejectRate = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function readJsonl(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing dataset. Run: node scripts/analyze-recite-lab.mjs --write`);
  }
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not parse ${path.basename(filePath)} line ${index + 1}: ${message}`);
      }
    });
}

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function getOutputFiles(options) {
  const suffixParts = [];
  if (options.scope) suffixParts.push(safeFilePart(options.scope));
  if (options.audioOnly) suffixParts.push("audio-only");
  const suffix = suffixParts.length > 0 ? `-${suffixParts.join("-")}` : "";
  return {
    json: path.join(ANALYSIS_DIR, `policy-sim${suffix}.json`),
    markdown: path.join(ANALYSIS_DIR, `policy-sim${suffix}.md`),
  };
}

function rowScope(row) {
  return row.expectedScope?.label ?? row.expectedScope?.mode ?? "unknown";
}

function actualPassDecision(row) {
  const label = row.labels?.effective ?? "unlabeled";
  if (PASS_LABELS.has(label)) return "pass";
  if (NOT_PASS_LABELS.has(label)) return "not_pass";
  return null;
}

function rowFeatures(row) {
  const expectedCount = row.counts?.expected ?? 0;
  const acceptedCount = row.window?.acceptedCount ?? 0;
  const missingCount = row.counts?.missing ?? 0;
  const extraCount = row.counts?.extra ?? 0;
  const substituteCount = row.counts?.substitute ?? 0;
  const offTargetExtraCount = row.comparison?.offTargetExtraCount ?? 0;
  const score = row.comparison?.score ?? 0;
  const windowConfidence = row.window?.confidence ?? 0;
  const reachedEnd = expectedCount > 0 && acceptedCount >= expectedCount;
  const nearEnd = expectedCount > 0 && acceptedCount >= expectedCount - Math.max(1, Math.ceil(expectedCount * 0.04));

  return {
    expectedCount,
    acceptedCount,
    missingCount,
    extraCount,
    substituteCount,
    offTargetExtraCount,
    score,
    windowConfidence,
    reachedEnd,
    nearEnd,
    decision: row.comparison?.decision ?? "unknown",
    windowStatus: row.window?.status ?? "unknown",
    label: row.labels?.effective ?? "unlabeled",
    scope: rowScope(row),
  };
}

const POLICIES = [
  {
    id: "strict_transcript",
    label: "Strict transcript",
    description: "Pass only when whole-passage transcript alignment says pass.",
    predict(row) {
      return row.comparison?.decision === "pass" ? "pass" : "hold";
    },
  },
  {
    id: "clean_window",
    label: "Clean window tracker",
    description: "Pass on transcript pass or all dynamic windows passing cleanly.",
    predict(row) {
      const features = rowFeatures(row);
      if (features.decision === "pass" || features.windowStatus === "complete") return "pass";
      return "hold";
    },
  },
  {
    id: "long_range_transcript_rescue",
    label: "Long-range transcript rescue",
    description:
      "Pass long recitations that reached the end with high window confidence despite transcript substitutions.",
    predict(row) {
      const features = rowFeatures(row);
      if (features.decision === "pass" || features.windowStatus === "complete") return "pass";
      if (
        features.expectedCount >= 60 &&
        features.windowStatus === "needs_audio" &&
        features.reachedEnd &&
        features.windowConfidence >= 0.88 &&
        features.score >= 0.77 &&
        features.offTargetExtraCount <= 4
      ) {
        return "pass";
      }
      return "hold";
    },
  },
  {
    id: "near_complete_lenient",
    label: "Near-complete lenient",
    description:
      "Pass if the tracker is near the end with very high score and only a tiny missing/substitution footprint.",
    predict(row) {
      const features = rowFeatures(row);
      if (features.decision === "pass" || features.windowStatus === "complete") return "pass";
      if (
        features.nearEnd &&
        features.score >= 0.96 &&
        features.offTargetExtraCount === 0 &&
        features.extraCount === 0 &&
        features.substituteCount <= 1 &&
        features.missingCount <= 1
      ) {
        return "pass";
      }
      return "hold";
    },
  },
  {
    id: "too_lenient_full_progress",
    label: "Too-lenient full progress",
    description:
      "Pass any attempt that reached the end with high window confidence. Included as a danger benchmark.",
    predict(row) {
      const features = rowFeatures(row);
      if (features.decision === "pass" || features.windowStatus === "complete") return "pass";
      if (
        features.reachedEnd &&
        features.windowStatus === "needs_audio" &&
        features.windowConfidence >= 0.88
      ) {
        return "pass";
      }
      return "hold";
    },
  },
];

function compactRow(row, predicted) {
  const features = rowFeatures(row);
  return {
    id: row.id,
    shortId: row.id.slice(0, 8),
    label: features.label,
    predicted,
    decision: features.decision,
    scope: features.scope,
    expectedCount: features.expectedCount,
    acceptedCount: features.acceptedCount,
    windowStatus: features.windowStatus,
    score: features.score,
    windowConfidence: features.windowConfidence,
    missingCount: features.missingCount,
    extraCount: features.extraCount,
    substituteCount: features.substituteCount,
    offTargetExtraCount: features.offTargetExtraCount,
  };
}

function increment(object, key) {
  object[key ?? "unknown"] = (object[key ?? "unknown"] ?? 0) + 1;
}

function summarizePolicy(policy, rows, options) {
  let knownRows = 0;
  let correct = 0;
  let correctRows = 0;
  let rescuedCorrect = 0;
  let notPassRows = 0;
  const matrix = {};
  const falsePasses = [];
  const falseRejects = [];
  const rescues = [];
  const byScope = {};

  for (const row of rows) {
    const actual = actualPassDecision(row);
    if (!actual) continue;
    const prediction = policy.predict(row);
    const predicted = prediction === "pass" ? "pass" : "not_pass";
    const features = rowFeatures(row);
    const scope = features.scope;
    knownRows += 1;
    if (actual === "pass") correctRows += 1;
    if (actual === "not_pass") notPassRows += 1;
    if (actual === predicted) correct += 1;
    increment(matrix, `${actual}:${predicted}`);

    if (!byScope[scope]) {
      byScope[scope] = {
        rows: 0,
        correct: 0,
        correctRows: 0,
        notPassRows: 0,
        falsePasses: 0,
        falseRejects: 0,
        rescuedCorrect: 0,
      };
    }
    const scopeStats = byScope[scope];
    scopeStats.rows += 1;
    if (actual === "pass") scopeStats.correctRows += 1;
    if (actual === "not_pass") scopeStats.notPassRows += 1;
    if (actual === predicted) scopeStats.correct += 1;

    const strictPassed = row.comparison?.decision === "pass";
    if (actual === "pass" && predicted === "pass" && !strictPassed) {
      rescuedCorrect += 1;
      scopeStats.rescuedCorrect += 1;
      rescues.push(compactRow(row, predicted));
    }
    if (actual === "not_pass" && predicted === "pass") {
      scopeStats.falsePasses += 1;
      falsePasses.push(compactRow(row, predicted));
    }
    if (actual === "pass" && predicted === "not_pass") {
      scopeStats.falseRejects += 1;
      falseRejects.push(compactRow(row, predicted));
    }
  }

  const falseRejectRate = correctRows === 0 ? null : falseRejects.length / correctRows;
  const passGate =
    falsePasses.length <= options.maxFalsePasses &&
    falseRejectRate !== null &&
    falseRejectRate <= options.maxFalseRejectRate;

  return {
    id: policy.id,
    label: policy.label,
    description: policy.description,
    knownRows,
    correct,
    accuracy: knownRows === 0 ? null : Number((correct / knownRows).toFixed(4)),
    correctRows,
    notPassRows,
    rescuedCorrect,
    falsePassCount: falsePasses.length,
    falseRejectCount: falseRejects.length,
    falseRejectRate: falseRejectRate === null ? null : Number(falseRejectRate.toFixed(4)),
    matrix,
    passGate,
    gate: {
      maxFalsePasses: options.maxFalsePasses,
      maxFalseRejectRate: options.maxFalseRejectRate,
    },
    byScope: Object.fromEntries(
      Object.entries(byScope)
        .map(([scope, stats]) => [
          scope,
          {
            ...stats,
            accuracy: stats.rows === 0 ? null : Number((stats.correct / stats.rows).toFixed(4)),
            falseRejectRate:
              stats.correctRows === 0
                ? null
                : Number((stats.falseRejects / stats.correctRows).toFixed(4)),
          },
        ])
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    falsePasses,
    falseRejects,
    rescues,
  };
}

function renderTable(headers, rows) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((value) => String(value ?? "")).join(" | ")} |`);
  return [headerLine, separator, ...body].join("\n");
}

function renderCompactRows(rows) {
  if (rows.length === 0) return "_None._";
  return renderTable(
    ["ID", "Label", "Decision", "Scope", "Window", "Progress", "Score", "Conf", "M/E/S"],
    rows.slice(-16).map((row) => [
      row.shortId,
      row.label,
      row.decision,
      row.scope,
      row.windowStatus,
      `${row.acceptedCount}/${row.expectedCount}`,
      Number.isFinite(row.score) ? row.score.toFixed(3) : "",
      Number.isFinite(row.windowConfidence) ? row.windowConfidence.toFixed(3) : "",
      `${row.missingCount}/${row.extraCount}/${row.substituteCount}`,
    ]),
  );
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Recite Lab Policy Simulation");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Policy version: ${report.policyVersion}`);
  lines.push(`Rows: ${report.rowCount}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(
    renderTable(
      [
        "Policy",
        "Accuracy",
        "Rescues",
        "False Pass",
        "False Reject",
        "FR Rate",
        "Gate",
      ],
      report.policies.map((policy) => [
        policy.id,
        policy.accuracy ?? "",
        policy.rescuedCorrect,
        policy.falsePassCount,
        policy.falseRejectCount,
        policy.falseRejectRate ?? "",
        policy.passGate ? "pass" : "hold",
      ]),
    ),
  );
  lines.push("");
  for (const policy of report.policies) {
    lines.push(`## ${policy.label}`);
    lines.push("");
    lines.push(policy.description);
    lines.push("");
    lines.push("By scope:");
    lines.push("");
    lines.push(
      renderTable(
        ["Scope", "Rows", "Accuracy", "Rescues", "False Pass", "False Reject", "FR Rate"],
        Object.entries(policy.byScope).map(([scope, stats]) => [
          scope,
          stats.rows,
          stats.accuracy ?? "",
          stats.rescuedCorrect,
          stats.falsePasses,
          stats.falseRejects,
          stats.falseRejectRate ?? "",
        ]),
      ),
    );
    lines.push("");
    lines.push("False passes:");
    lines.push("");
    lines.push(renderCompactRows(policy.falsePasses));
    lines.push("");
    lines.push("False rejects:");
    lines.push("");
    lines.push(renderCompactRows(policy.falseRejects));
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function compactPolicy(policy) {
  return {
    ...policy,
    falsePasses: policy.falsePasses,
    falseRejects: policy.falseRejects,
    rescues: policy.rescues,
  };
}

function printSummary(report) {
  console.log("Recite Lab policy simulation");
  console.log(`Rows: ${report.rowCount}`);
  for (const policy of report.policies) {
    console.log(
      `- ${policy.id}: accuracy=${policy.accuracy} rescues=${policy.rescuedCorrect} falsePass=${policy.falsePassCount} falseReject=${policy.falseRejectCount} gate=${policy.passGate ? "pass" : "hold"}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let rows = await readJsonl(DATASET_FILE);
  if (options.scope) rows = rows.filter((row) => rowScope(row) === options.scope);
  if (options.audioOnly) rows = rows.filter((row) => row.audio?.hasAudio);
  rows = rows.filter((row) => KNOWN_LABELS.has(row.labels?.effective ?? ""));

  const report = {
    generatedAt: new Date().toISOString(),
    policyVersion: POLICY_VERSION,
    datasetFile: path.relative(ROOT_DIR, DATASET_FILE),
    filters: {
      scope: options.scope,
      audioOnly: options.audioOnly,
    },
    rowCount: rows.length,
    policies: POLICIES.map((policy) => summarizePolicy(policy, rows, options)).map(compactPolicy),
  };

  if (options.write) {
    const outputFiles = getOutputFiles(options);
    await mkdir(ANALYSIS_DIR, { recursive: true });
    await writeFile(outputFiles.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(outputFiles.markdown, renderMarkdown(report), "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printSummary(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
