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
const SWEEP_VERSION = "recite-lab-capture-sweep-v0.2";
const CURRENT_CAPTURE_GATE = { durationRatio: 0.44, heardRatio: 0.45, acceptedRatio: 0.9 };

const DURATION_RATIO_THRESHOLDS = [0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.55, 0.6, 0.64, 0.68];
const HEARD_RATIO_THRESHOLDS = [0.45, 0.5, 0.55];
const ACCEPTED_RATIO_THRESHOLDS = [0.9, 0.95, 0.98];

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    audioOnly: false,
    scope: null,
    maxFalsePasses: 0,
    maxFalseRejects: 0,
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
    } else if (arg === "--max-false-rejects") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--max-false-rejects must be followed by a number >= 0.");
      }
      options.maxFalseRejects = value;
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
    json: path.join(ANALYSIS_DIR, `capture-sweep${suffix}.json`),
    markdown: path.join(ANALYSIS_DIR, `capture-sweep${suffix}.md`),
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
  const diagnostics = row.verifierReplay?.diagnostics ?? {};
  const expectedCount = diagnostics.expectedCount ?? row.counts?.expected ?? 0;
  const acceptedCount = diagnostics.acceptedCount ?? row.window?.acceptedCount ?? 0;
  const heardCount = diagnostics.heardCount ?? row.counts?.heard ?? 0;
  const heardRatio = diagnostics.heardRatio ?? (expectedCount > 0 ? heardCount / expectedCount : null);
  const acceptedRatio =
    diagnostics.acceptedRatio ?? (expectedCount > 0 ? acceptedCount / expectedCount : null);

  return {
    expectedCount,
    acceptedCount,
    heardCount,
    heardRatio,
    acceptedRatio,
    durationRatio: diagnostics.durationRatio ?? null,
    decision: row.comparison?.decision ?? "unknown",
    windowStatus: row.window?.status ?? "unknown",
    score: row.comparison?.score ?? 0,
    windowConfidence: row.window?.confidence ?? 0,
    offTargetExtraCount: row.comparison?.offTargetExtraCount ?? 0,
    missingCount: row.counts?.missing ?? 0,
    extraCount: row.counts?.extra ?? 0,
    substituteCount: row.counts?.substitute ?? 0,
    label: row.labels?.effective ?? "unlabeled",
    scope: rowScope(row),
  };
}

function compactArabic(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064A]/g, "")
    .replace(/ا/g, "");
}

function finalTailAsrMerge(row, features) {
  if (
    features.expectedCount < 3 ||
    features.missingCount !== 1 ||
    features.extraCount !== 0 ||
    features.substituteCount !== 0 ||
    features.offTargetExtraCount !== 0 ||
    features.acceptedCount < features.expectedCount - 1 ||
    features.score < 0.94
  ) {
    return false;
  }

  const missingFinal = (row.comparison?.firstIssues ?? []).some(
    (issue) => issue?.type === "missing" && issue?.expectedIndex === features.expectedCount,
  );
  if (!missingFinal) return false;

  const expectedWords = Array.isArray(row.expectedWords) ? row.expectedWords : [];
  const heardTokens = Array.isArray(row.transcriptTokens) ? row.transcriptTokens : [];
  const previousExpected = expectedWords[features.expectedCount - 2] ?? "";
  const finalExpected = expectedWords[features.expectedCount - 1] ?? "";
  const finalHeard = heardTokens[heardTokens.length - 1] ?? "";
  const previousCompact = compactArabic(previousExpected);
  const finalCompact = compactArabic(finalExpected);
  const heardCompact = compactArabic(finalHeard);
  if (previousCompact.length < 2 || finalCompact.length < 3 || heardCompact.length < 3) {
    return false;
  }

  const previousPrefix = previousCompact.slice(0, Math.min(3, previousCompact.length));
  const finalSuffix = finalCompact.slice(-Math.min(3, finalCompact.length));
  return heardCompact.startsWith(previousPrefix) && heardCompact.endsWith(finalSuffix);
}

function longRangeTranscriptRescue(features) {
  return (
    features.expectedCount >= 60 &&
    features.windowStatus === "needs_audio" &&
    features.acceptedCount >= features.expectedCount &&
    features.windowConfidence >= 0.88 &&
    features.score >= 0.77 &&
    features.offTargetExtraCount <= 4
  );
}

function wouldCapture(features, gate) {
  if (features.durationRatio === null) return false;
  const durationLooksShort = features.durationRatio < gate.durationRatio;
  const sparseTranscript =
    features.heardRatio !== null && features.heardRatio <= gate.heardRatio;
  const lowProgress =
    (features.acceptedRatio !== null && features.acceptedRatio < gate.acceptedRatio) ||
    features.windowStatus === "off_track";
  return durationLooksShort && (sparseTranscript || lowProgress);
}

function predict(row, gate) {
  const features = rowFeatures(row);
  if (wouldCapture(features, gate)) return { prediction: "capture_issue", features };
  if (features.decision === "pass" || features.windowStatus === "complete") {
    return { prediction: "pass", features };
  }
  if (longRangeTranscriptRescue(features) || finalTailAsrMerge(row, features)) {
    return { prediction: "pass", features };
  }
  return { prediction: "hold", features };
}

function compactRow(row, prediction, features) {
  return {
    id: row.id,
    shortId: row.id.slice(0, 8),
    label: row.labels?.effective ?? null,
    prediction,
    scope: features.scope,
    decision: features.decision,
    windowStatus: features.windowStatus,
    progress: `${features.acceptedCount}/${features.expectedCount}`,
    durationRatio:
      features.durationRatio === null ? null : Number(features.durationRatio.toFixed(4)),
    heardRatio: features.heardRatio === null ? null : Number(features.heardRatio.toFixed(4)),
    acceptedRatio:
      features.acceptedRatio === null ? null : Number(features.acceptedRatio.toFixed(4)),
  };
}

function increment(object, key) {
  object[key ?? "unknown"] = (object[key ?? "unknown"] ?? 0) + 1;
}

function summarizeGate(rows, gate, options) {
  let knownRows = 0;
  let evaluatedRows = 0;
  let correct = 0;
  let passRows = 0;
  let evaluatedPassRows = 0;
  const matrix = {};
  const capturesByLabel = {};
  const capturesByScope = {};
  const falsePasses = [];
  const falseRejects = [];
  const capturePasses = [];
  const captureNotPasses = [];
  const rescues = [];

  for (const row of rows) {
    const actual = actualPassDecision(row);
    if (!actual) continue;
    const { prediction, features } = predict(row, gate);
    const predicted =
      prediction === "pass" ? "pass" : prediction === "capture_issue" ? "capture_issue" : "not_pass";
    knownRows += 1;
    if (actual === "pass") passRows += 1;
    increment(matrix, `${actual}:${predicted}`);

    if (predicted === "capture_issue") {
      increment(capturesByLabel, features.label);
      increment(capturesByScope, features.scope);
      if (actual === "pass") {
        capturePasses.push(compactRow(row, predicted, features));
      } else {
        captureNotPasses.push(compactRow(row, predicted, features));
        evaluatedRows += 1;
        correct += 1;
      }
      continue;
    }

    evaluatedRows += 1;
    if (actual === "pass") evaluatedPassRows += 1;
    if (actual === predicted) correct += 1;

    if (actual === "not_pass" && predicted === "pass") {
      falsePasses.push(compactRow(row, predicted, features));
    }
    if (actual === "pass" && predicted === "not_pass") {
      falseRejects.push(compactRow(row, predicted, features));
    }
    if (actual === "pass" && predicted === "pass" && features.decision !== "pass") {
      rescues.push(compactRow(row, predicted, features));
    }
  }

  const falseRejectRate =
    evaluatedPassRows === 0 ? null : falseRejects.length / evaluatedPassRows;
  const gatePass =
    falsePasses.length <= options.maxFalsePasses &&
    falseRejects.length <= options.maxFalseRejects;

  return {
    gate,
    knownRows,
    evaluatedRows,
    correct,
    accuracy: evaluatedRows === 0 ? null : Number((correct / evaluatedRows).toFixed(4)),
    passRows,
    evaluatedPassRows,
    captureCount: capturePasses.length + captureNotPasses.length,
    capturePassCount: capturePasses.length,
    captureNotPassCount: captureNotPasses.length,
    rescuedCorrectCount: rescues.length,
    falsePassCount: falsePasses.length,
    falseRejectCount: falseRejects.length,
    falseRejectRate: falseRejectRate === null ? null : Number(falseRejectRate.toFixed(4)),
    matrix,
    capturesByLabel,
    capturesByScope,
    gatePass,
    falsePasses,
    falseRejects,
    capturePasses,
    captureNotPasses,
    rescues,
  };
}

function buildCandidates() {
  const candidates = [];
  for (const durationRatio of DURATION_RATIO_THRESHOLDS) {
    for (const heardRatio of HEARD_RATIO_THRESHOLDS) {
      for (const acceptedRatio of ACCEPTED_RATIO_THRESHOLDS) {
        candidates.push({ durationRatio, heardRatio, acceptedRatio });
      }
    }
  }
  return candidates;
}

function rankSummaries(summaries) {
  return [...summaries].sort((a, b) => {
    const gatePassDelta = Number(b.gatePass) - Number(a.gatePass);
    if (gatePassDelta !== 0) return gatePassDelta;
    if (a.falsePassCount !== b.falsePassCount) return a.falsePassCount - b.falsePassCount;
    if (a.falseRejectCount !== b.falseRejectCount) return a.falseRejectCount - b.falseRejectCount;
    if (a.capturePassCount !== b.capturePassCount) return a.capturePassCount - b.capturePassCount;
    if (a.captureCount !== b.captureCount) return a.captureCount - b.captureCount;
    return b.accuracy - a.accuracy;
  });
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
    ["ID", "Label", "Pred", "Scope", "Window", "Progress", "Dur", "Heard", "Accepted"],
    rows.slice(-16).map((row) => [
      row.shortId,
      row.label,
      row.prediction,
      row.scope,
      row.windowStatus,
      row.progress,
      row.durationRatio,
      row.heardRatio,
      row.acceptedRatio,
    ]),
  );
}

function renderMarkdown(report) {
  const top = report.rankedSummaries.slice(0, 20);
  const current = report.currentGateSummary;
  const recommended = report.recommendedSummary;
  const lines = [];
  lines.push("# Recite Lab Capture Gate Sweep");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Sweep version: ${report.sweepVersion}`);
  lines.push(`Rows: ${report.rowCount}`);
  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  if (recommended) {
    lines.push(
      renderTable(
        [
          "Dur",
          "Heard",
          "Accepted",
          "Accuracy",
          "Eval",
          "Capture",
          "Correct Capture",
          "False Pass",
          "False Reject",
          "Gate",
        ],
        [
          [
            recommended.gate.durationRatio,
            recommended.gate.heardRatio,
            recommended.gate.acceptedRatio,
            recommended.accuracy,
            `${recommended.correct}/${recommended.evaluatedRows}`,
            recommended.captureCount,
            recommended.capturePassCount,
            recommended.falsePassCount,
            recommended.falseRejectCount,
            recommended.gatePass ? "pass" : "hold",
          ],
        ],
      ),
    );
  } else {
    lines.push("_No gate met the configured false-pass/false-reject limits._");
  }
  lines.push("");
  lines.push("## Current Gate");
  lines.push("");
  lines.push(
    renderTable(
      [
        "Dur",
        "Heard",
        "Accepted",
        "Accuracy",
        "Eval",
        "Capture",
        "Correct Capture",
        "False Pass",
        "False Reject",
        "Gate",
      ],
      [
        [
          current.gate.durationRatio,
          current.gate.heardRatio,
          current.gate.acceptedRatio,
          current.accuracy,
          `${current.correct}/${current.evaluatedRows}`,
          current.captureCount,
          current.capturePassCount,
          current.falsePassCount,
          current.falseRejectCount,
          current.gatePass ? "pass" : "hold",
        ],
      ],
    ),
  );
  lines.push("");
  lines.push("## Top Gates");
  lines.push("");
  lines.push(
    renderTable(
      [
        "Dur",
        "Heard",
        "Accepted",
        "Accuracy",
        "Eval",
        "Capture",
        "Correct Capture",
        "Not-Pass Capture",
        "False Pass",
        "False Reject",
        "Gate",
      ],
      top.map((summary) => [
        summary.gate.durationRatio,
        summary.gate.heardRatio,
        summary.gate.acceptedRatio,
        summary.accuracy,
        `${summary.correct}/${summary.evaluatedRows}`,
        summary.captureCount,
        summary.capturePassCount,
        summary.captureNotPassCount,
        summary.falsePassCount,
        summary.falseRejectCount,
        summary.gatePass ? "pass" : "hold",
      ]),
    ),
  );
  lines.push("");
  lines.push("## Recommended Captured Correct Rows");
  lines.push("");
  lines.push(renderCompactRows(recommended?.capturePasses ?? []));
  lines.push("");
  lines.push("## Recommended Captured Not-Pass Rows");
  lines.push("");
  lines.push(renderCompactRows(recommended?.captureNotPasses ?? []));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function stripRows(summary) {
  return {
    ...summary,
    falsePasses: summary.falsePasses.slice(-16),
    falseRejects: summary.falseRejects.slice(-16),
    capturePasses: summary.capturePasses.slice(-16),
    captureNotPasses: summary.captureNotPasses.slice(-16),
    rescues: summary.rescues.slice(-16),
  };
}

function printSummary(report) {
  const recommended = report.recommendedSummary;
  const current = report.currentGateSummary;
  console.log("Recite Lab capture gate sweep");
  console.log(`Rows: ${report.rowCount}`);
  if (recommended) {
    console.log(
      `Recommended: dur<${recommended.gate.durationRatio} heard<=${recommended.gate.heardRatio} accepted<${recommended.gate.acceptedRatio} capture=${recommended.captureCount} correctCapture=${recommended.capturePassCount} falsePass=${recommended.falsePassCount} falseReject=${recommended.falseRejectCount}`,
    );
  }
  console.log(
    `Current: dur<${current.gate.durationRatio} heard<=${current.gate.heardRatio} accepted<${current.gate.acceptedRatio} capture=${current.captureCount} correctCapture=${current.capturePassCount} falsePass=${current.falsePassCount} falseReject=${current.falseRejectCount}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let rows = await readJsonl(DATASET_FILE);
  if (options.scope) {
    rows = rows.filter((row) => rowScope(row) === options.scope);
  }
  if (options.audioOnly) {
    rows = rows.filter((row) => row.audio?.hasAudio);
  }
  rows = rows.filter((row) => KNOWN_LABELS.has(row.labels?.effective ?? ""));

  const candidates = buildCandidates();
  const summaries = candidates.map((gate) => summarizeGate(rows, gate, options));
  const rankedSummaries = rankSummaries(summaries);
  const currentGateSummary = summarizeGate(rows, CURRENT_CAPTURE_GATE, options);
  const recommendedSummary = rankedSummaries.find((summary) => summary.gatePass) ?? null;
  const report = {
    generatedAt: new Date().toISOString(),
    sweepVersion: SWEEP_VERSION,
    datasetFile: path.relative(ROOT_DIR, DATASET_FILE),
    filters: {
      audioOnly: options.audioOnly,
      scope: options.scope,
      maxFalsePasses: options.maxFalsePasses,
      maxFalseRejects: options.maxFalseRejects,
    },
    rowCount: rows.length,
    currentGateSummary,
    recommendedSummary,
    rankedSummaries,
  };
  const compactReport = {
    ...report,
    currentGateSummary: stripRows(currentGateSummary),
    recommendedSummary: recommendedSummary ? stripRows(recommendedSummary) : null,
    rankedSummaries: rankedSummaries.slice(0, 40).map(stripRows),
  };

  if (options.write) {
    await mkdir(ANALYSIS_DIR, { recursive: true });
    const outputFiles = getOutputFiles(options);
    await writeFile(outputFiles.markdown, renderMarkdown(report), "utf8");
    await writeFile(outputFiles.json, `${JSON.stringify(compactReport, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify(compactReport, null, 2));
    return;
  }

  printSummary(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
