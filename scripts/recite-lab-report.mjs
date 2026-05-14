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
const KNOWN_LABELS = new Set([...PASS_LABELS, ...NOT_PASS_LABELS, "noisy"]);

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function getReportFiles(options) {
  const suffixParts = [];
  if (options.scope) suffixParts.push(safeFilePart(options.scope));
  if (options.latest) suffixParts.push(`latest-${options.latest}`);
  if (options.audioOnly) suffixParts.push("audio-only");
  const suffix = suffixParts.length > 0 ? `-${suffixParts.join("-")}` : "";
  return {
    markdown: path.join(ANALYSIS_DIR, `report${suffix}.md`),
    json: path.join(ANALYSIS_DIR, `report${suffix}.json`),
  };
}

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    audioOnly: false,
    latest: null,
    scope: null,
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
    } else if (arg === "--latest") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--latest must be followed by a positive number.");
      }
      options.latest = value;
      index += 1;
    } else if (arg === "--scope") {
      const value = argv[index + 1];
      if (!value) throw new Error("--scope must be followed by a scope label.");
      options.scope = value;
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

function increment(object, key) {
  object[key ?? "unknown"] = (object[key ?? "unknown"] ?? 0) + 1;
}

function actualPassDecision(row) {
  const label = row.labels?.effective ?? "unlabeled";
  if (PASS_LABELS.has(label)) return "pass";
  if (NOT_PASS_LABELS.has(label)) return "not_pass";
  return null;
}

function predictedPassDecision(row) {
  return row.comparison?.decision === "pass" ? "pass" : "not_pass";
}

function passDecisionFromVerifier(verifier) {
  const status = verifier?.status;
  if (status === "pass") return "pass";
  if (status === "hold") return "not_pass";
  return null;
}

function verifierPassDecision(row) {
  return passDecisionFromVerifier(row.verifier);
}

function replayVerifierPassDecision(row) {
  return passDecisionFromVerifier(row.verifierReplay);
}

function exactPrediction(row) {
  return row.comparison?.decision ?? "unknown";
}

function expectedExactDecision(row) {
  const label = row.labels?.effective ?? "unlabeled";
  if (label === "correct") return "pass";
  if (label === "skip" || label === "repeat" || label === "wrong") return label;
  return null;
}

function numericValues(rows, pick) {
  return rows.map(pick).filter((value) => Number.isFinite(value));
}

function average(values) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return Number((sorted[lower] ?? 0).toFixed(1));
  const weight = index - lower;
  return Number((((sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight).toFixed(1)));
}

function summarizeRows(rows) {
  const byLabel = {};
  const byDecision = {};
  const byScope = {};
  const byWindowStatus = {};
  const byPhraseStatus = {};
  const byVerifierStatus = {};
  const byVerifierReason = {};
  const byVerifierPolicy = {};
  const byVerifierVersion = {};
  const byReplayVerifierStatus = {};
  const byReplayVerifierReason = {};
  const byReplayVerifierPolicy = {};
  const byReplayVerifierVersion = {};
  const byAudioUploadStatus = {};
  const byAlignmentVersion = {};
  const byWindowVersion = {};
  const passMatrix = {};
  const verifierMatrix = {};
  const replayVerifierMatrix = {};
  const exactMatrix = {};
  const falsePasses = [];
  const falseRejects = [];
  const verifierFalsePasses = [];
  const verifierFalseRejects = [];
  const verifierCaptureIssues = [];
  const replayVerifierFalsePasses = [];
  const replayVerifierFalseRejects = [];
  const replayVerifierCaptureIssues = [];
  const exactMismatches = [];
  let knownPassRows = 0;
  let correctPassRows = 0;
  let verifierRows = 0;
  let verifierEvaluatedRows = 0;
  let verifierCorrectRows = 0;
  let replayVerifierRows = 0;
  let replayVerifierEvaluatedRows = 0;
  let replayVerifierCorrectRows = 0;
  let knownExactRows = 0;
  let correctExactRows = 0;

  for (const row of rows) {
    const label = row.labels?.effective ?? "unlabeled";
    const decision = row.comparison?.decision ?? "unknown";
    const scope = row.expectedScope?.label ?? row.expectedScope?.mode ?? "unknown";
    const alignmentVersion =
      row.algorithmVersions?.alignment ?? row.comparison?.decisionVersion ?? "unknown";
    const windowVersion = row.algorithmVersions?.windowTracker ?? row.window?.version ?? "unknown";
    increment(byLabel, label);
    increment(byDecision, decision);
    increment(byScope, scope);
    increment(byWindowStatus, row.window?.status ?? "unknown");
    increment(byPhraseStatus, row.phrase?.status ?? "unknown");
    if (row.verifier) {
      increment(byVerifierStatus, row.verifier.status ?? "unknown");
      increment(byVerifierReason, row.verifier.reason ?? "unknown");
      increment(byVerifierPolicy, row.verifier.policyId ?? "unknown");
      increment(byVerifierVersion, row.verifier.version ?? "unknown");
    }
    if (row.verifierReplay) {
      increment(byReplayVerifierStatus, row.verifierReplay.status ?? "unknown");
      increment(byReplayVerifierReason, row.verifierReplay.reason ?? "unknown");
      increment(byReplayVerifierPolicy, row.verifierReplay.policyId ?? "unknown");
      increment(byReplayVerifierVersion, row.verifierReplay.version ?? "unknown");
    }
    increment(
      byAudioUploadStatus,
      row.audioUpload?.latestStatus ??
        (row.audio?.hasAudio ? "file_present" : row.audioUpload?.plan?.willUpload ? "missing_event" : "none"),
    );
    increment(byAlignmentVersion, alignmentVersion);
    increment(byWindowVersion, windowVersion);

    const actualPass = actualPassDecision(row);
    const predictedPass = predictedPassDecision(row);
    if (actualPass) {
      knownPassRows += 1;
      if (actualPass === predictedPass) correctPassRows += 1;
      increment(passMatrix, `${actualPass}:${predictedPass}`);
      if (actualPass === "not_pass" && predictedPass === "pass") falsePasses.push(row);
      if (actualPass === "pass" && predictedPass === "not_pass") falseRejects.push(row);
    }

    if (row.verifier) {
      verifierRows += 1;
      if (row.verifier.status === "capture_issue") verifierCaptureIssues.push(row);
      const verifierPredicted = verifierPassDecision(row);
      if (actualPass && verifierPredicted) {
        verifierEvaluatedRows += 1;
        if (actualPass === verifierPredicted) verifierCorrectRows += 1;
        increment(verifierMatrix, `${actualPass}:${verifierPredicted}`);
        if (actualPass === "not_pass" && verifierPredicted === "pass") verifierFalsePasses.push(row);
        if (actualPass === "pass" && verifierPredicted === "not_pass") verifierFalseRejects.push(row);
      }
    }

    if (row.verifierReplay) {
      replayVerifierRows += 1;
      if (row.verifierReplay.status === "capture_issue") replayVerifierCaptureIssues.push(row);
      const replayVerifierPredicted = replayVerifierPassDecision(row);
      if (actualPass && replayVerifierPredicted) {
        replayVerifierEvaluatedRows += 1;
        if (actualPass === replayVerifierPredicted) replayVerifierCorrectRows += 1;
        increment(replayVerifierMatrix, `${actualPass}:${replayVerifierPredicted}`);
        if (actualPass === "not_pass" && replayVerifierPredicted === "pass") {
          replayVerifierFalsePasses.push(row);
        }
        if (actualPass === "pass" && replayVerifierPredicted === "not_pass") {
          replayVerifierFalseRejects.push(row);
        }
      }
    }

    const expectedExact = expectedExactDecision(row);
    const predictedExact = exactPrediction(row);
    if (expectedExact) {
      knownExactRows += 1;
      if (expectedExact === predictedExact) correctExactRows += 1;
      increment(exactMatrix, `${expectedExact}:${predictedExact}`);
      if (expectedExact !== predictedExact) exactMismatches.push(row);
    }
  }

  const firstResultLatencyMs = numericValues(rows, (row) => row.timing?.firstResultLatencyMs);
  const audioDurationMs = numericValues(rows, (row) => row.timing?.audioDurationMs);
  const saveDelayMs = numericValues(rows, (row) => row.timing?.saveDelayMs);

  return {
    rowCount: rows.length,
    audioRows: rows.filter((row) => row.audio?.hasAudio).length,
    byLabel,
    byDecision,
    byScope,
    byWindowStatus,
    byPhraseStatus,
    byVerifierStatus,
    byVerifierReason,
    byVerifierPolicy,
    byVerifierVersion,
    byReplayVerifierStatus,
    byReplayVerifierReason,
    byReplayVerifierPolicy,
    byReplayVerifierVersion,
    byAudioUploadStatus,
    byAlignmentVersion,
    byWindowVersion,
    passNotPass: {
      knownRows: knownPassRows,
      correct: correctPassRows,
      accuracy:
        knownPassRows === 0 ? null : Number((correctPassRows / knownPassRows).toFixed(4)),
      matrix: passMatrix,
      falsePassCount: falsePasses.length,
      falseRejectCount: falseRejects.length,
    },
    verifierPolicy: {
      rows: verifierRows,
      evaluatedRows: verifierEvaluatedRows,
      correct: verifierCorrectRows,
      accuracy:
        verifierEvaluatedRows === 0
          ? null
          : Number((verifierCorrectRows / verifierEvaluatedRows).toFixed(4)),
      matrix: verifierMatrix,
      falsePassCount: verifierFalsePasses.length,
      falseRejectCount: verifierFalseRejects.length,
      captureIssueCount: verifierCaptureIssues.length,
    },
    verifierReplayPolicy: {
      rows: replayVerifierRows,
      evaluatedRows: replayVerifierEvaluatedRows,
      correct: replayVerifierCorrectRows,
      accuracy:
        replayVerifierEvaluatedRows === 0
          ? null
          : Number((replayVerifierCorrectRows / replayVerifierEvaluatedRows).toFixed(4)),
      matrix: replayVerifierMatrix,
      falsePassCount: replayVerifierFalsePasses.length,
      falseRejectCount: replayVerifierFalseRejects.length,
      captureIssueCount: replayVerifierCaptureIssues.length,
    },
    exact: {
      knownRows: knownExactRows,
      correct: correctExactRows,
      accuracy:
        knownExactRows === 0 ? null : Number((correctExactRows / knownExactRows).toFixed(4)),
      matrix: exactMatrix,
      mismatchCount: exactMismatches.length,
    },
    latency: {
      firstResultLatencyMs: {
        count: firstResultLatencyMs.length,
        avg: average(firstResultLatencyMs),
        p50: percentile(firstResultLatencyMs, 0.5),
        p90: percentile(firstResultLatencyMs, 0.9),
      },
      audioDurationMs: {
        count: audioDurationMs.length,
        avg: average(audioDurationMs),
        p50: percentile(audioDurationMs, 0.5),
        p90: percentile(audioDurationMs, 0.9),
      },
      saveDelayMs: {
        count: saveDelayMs.length,
        avg: average(saveDelayMs),
        p50: percentile(saveDelayMs, 0.5),
        p90: percentile(saveDelayMs, 0.9),
      },
    },
    falsePasses,
    falseRejects,
    verifierFalsePasses,
    verifierFalseRejects,
    verifierCaptureIssues,
    replayVerifierFalsePasses,
    replayVerifierFalseRejects,
    replayVerifierCaptureIssues,
    exactMismatches,
  };
}

function groupBy(rows, keyForRow) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyForRow(row) ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function compactRow(row) {
  return {
    id: row.id,
    shortId: row.id.slice(0, 8),
    savedAt: row.savedAt,
    label: row.labels?.effective ?? null,
    rawLabel: row.labels?.raw ?? null,
    decision: row.comparison?.decision ?? null,
    scope: row.expectedScope?.label ?? row.expectedScope?.mode ?? null,
    score: row.comparison?.score ?? null,
    verifierStatus: row.verifier?.status ?? null,
    verifierReason: row.verifier?.reason ?? null,
    verifierConfidence: row.verifier?.confidence ?? null,
    verifierRescuedBy: row.verifier?.rescuedBy ?? null,
    verifierPolicyId: row.verifier?.policyId ?? null,
    verifierVersion: row.verifier?.version ?? null,
    verifierDurationRatio: row.verifier?.diagnostics?.durationRatio ?? null,
    verifierDurationBaselineSource:
      row.verifier?.diagnostics?.durationBaselineSource ?? null,
    replayVerifierStatus: row.verifierReplay?.status ?? null,
    replayVerifierReason: row.verifierReplay?.reason ?? null,
    replayVerifierConfidence: row.verifierReplay?.confidence ?? null,
    replayVerifierRescuedBy: row.verifierReplay?.rescuedBy ?? null,
    replayVerifierPolicyId: row.verifierReplay?.policyId ?? null,
    replayVerifierVersion: row.verifierReplay?.version ?? null,
    replayVerifierDurationRatio: row.verifierReplay?.diagnostics?.durationRatio ?? null,
    replayVerifierDurationBaselineSource:
      row.verifierReplay?.diagnostics?.durationBaselineSource ?? null,
    audioUploadStatus: row.audioUpload?.latestStatus ?? null,
    audioUploadReason: row.audioUpload?.latestReason ?? null,
    audioUploadError: row.audioUpload?.latestError ?? null,
    windowStatus: row.window?.status ?? null,
    windowAccepted: row.window?.acceptedCount ?? null,
    expectedCount: row.counts?.expected ?? null,
    heardCount: row.counts?.heard ?? null,
    firstIssues: row.comparison?.firstIssues ?? [],
  };
}

function renderVerifierRows(rows, options = {}) {
  if (rows.length === 0) return "_None._";
  const useReplay = Boolean(options.replay);
  return renderTable(
    [
      "ID",
      "Label",
      "Verifier",
      "Reason",
      "Rescue",
      "Confidence",
      "Policy",
      "Dur",
      "Scope",
      "Window",
    ],
    rows.slice(-12).map((row) => {
      const compact = compactRow(row);
      const status = useReplay ? compact.replayVerifierStatus : compact.verifierStatus;
      const reason = useReplay ? compact.replayVerifierReason : compact.verifierReason;
      const rescuedBy = useReplay ? compact.replayVerifierRescuedBy : compact.verifierRescuedBy;
      const confidence = useReplay
        ? compact.replayVerifierConfidence
        : compact.verifierConfidence;
      const policyId = useReplay ? compact.replayVerifierPolicyId : compact.verifierPolicyId;
      const durationRatio = useReplay
        ? compact.replayVerifierDurationRatio
        : compact.verifierDurationRatio;
      const durationBaselineSource = useReplay
        ? compact.replayVerifierDurationBaselineSource
        : compact.verifierDurationBaselineSource;
      return [
        compact.shortId,
        compact.label,
        status,
        reason,
        rescuedBy,
        Number.isFinite(confidence) ? Number(confidence).toFixed(3) : "",
        policyId,
        Number.isFinite(durationRatio)
          ? `${Number(durationRatio).toFixed(2)}x ${durationBaselineSource ?? ""}`.trim()
          : "",
        compact.scope,
        `${compact.windowStatus ?? "?"} ${compact.windowAccepted ?? "?"}/${
          compact.expectedCount ?? "?"
        }`,
      ];
    }),
  );
}

function renderTable(headers, rows) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((value) => String(value ?? "")).join(" | ")} |`);
  return [headerLine, separator, ...body].join("\n");
}

function renderTopRows(rows) {
  if (rows.length === 0) return "_None._";
  return renderTable(
    ["ID", "Label", "Decision", "Scope", "Window", "Progress", "Score", "Issue"],
    rows.slice(-12).map((row) => {
      const compact = compactRow(row);
      const issue = compact.firstIssues?.[0];
      const issueText = issue
        ? `${issue.type ?? ""} ${issue.expected ?? ""}/${issue.heard ?? ""}`.trim()
        : "";
      return [
        compact.shortId,
        compact.label,
        compact.decision,
        compact.scope,
        compact.windowStatus,
        `${compact.windowAccepted ?? "?"}/${compact.expectedCount ?? "?"}`,
        Number.isFinite(compact.score) ? Number(compact.score).toFixed(3) : "",
        issueText,
      ];
    }),
  );
}

function buildScopeRows(rows) {
  const groups = [...groupBy(rows, (row) => row.expectedScope?.label ?? row.expectedScope?.mode).entries()];
  return groups
    .map(([scope, scopeRows]) => {
      const summary = summarizeRows(scopeRows);
      return [
        scope,
        summary.rowCount,
        summary.audioRows,
        summary.passNotPass.accuracy ?? "",
        summary.passNotPass.falsePassCount,
        summary.passNotPass.falseRejectCount,
        summary.latency.firstResultLatencyMs.p50 ?? "",
        summary.latency.firstResultLatencyMs.p90 ?? "",
      ];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function buildVersionRows(rows) {
  const groups = [
    ...groupBy(
      rows,
      (row) => row.algorithmVersions?.windowTracker ?? row.window?.version ?? "unknown",
    ).entries(),
  ];
  return groups
    .map(([version, versionRows]) => {
      const summary = summarizeRows(versionRows);
      return [
        version,
        summary.rowCount,
        summary.passNotPass.accuracy ?? "",
        summary.passNotPass.falsePassCount,
        summary.passNotPass.falseRejectCount,
        summary.latency.firstResultLatencyMs.p50 ?? "",
        summary.latency.firstResultLatencyMs.p90 ?? "",
      ];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function renderMarkdown(report) {
  const summary = report.summary;
  const lines = [];
  lines.push("# Recite Lab Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Dataset: ${report.datasetFile}`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(
    renderTable(
      ["Metric", "Value"],
      [
        ["Rows", summary.rowCount],
        ["Audio rows", summary.audioRows],
        ["Pass/not-pass accuracy", summary.passNotPass.accuracy ?? ""],
        ["False passes", summary.passNotPass.falsePassCount],
        ["False rejects", summary.passNotPass.falseRejectCount],
        ["Verifier rows", summary.verifierPolicy.rows],
        ["Verifier evaluated", summary.verifierPolicy.evaluatedRows],
        ["Verifier accuracy", summary.verifierPolicy.accuracy ?? ""],
        ["Verifier false passes", summary.verifierPolicy.falsePassCount],
        ["Verifier false rejects", summary.verifierPolicy.falseRejectCount],
        ["Verifier capture issues", summary.verifierPolicy.captureIssueCount],
        ["Replay verifier rows", summary.verifierReplayPolicy.rows],
        ["Replay verifier evaluated", summary.verifierReplayPolicy.evaluatedRows],
        ["Replay verifier accuracy", summary.verifierReplayPolicy.accuracy ?? ""],
        ["Replay verifier false passes", summary.verifierReplayPolicy.falsePassCount],
        ["Replay verifier false rejects", summary.verifierReplayPolicy.falseRejectCount],
        ["Replay verifier capture issues", summary.verifierReplayPolicy.captureIssueCount],
        ["Exact label accuracy", summary.exact.accuracy ?? ""],
        ["First result p50", `${summary.latency.firstResultLatencyMs.p50 ?? ""} ms`],
        ["First result p90", `${summary.latency.firstResultLatencyMs.p90 ?? ""} ms`],
      ],
    ),
  );
  lines.push("");
  lines.push("## By Scope");
  lines.push("");
  lines.push(
    renderTable(
      ["Scope", "Rows", "Audio", "Pass/Not", "False Pass", "False Reject", "P50 ms", "P90 ms"],
      report.scopeRows,
    ),
  );
  lines.push("");
  lines.push("## By Window Tracker Version");
  lines.push("");
  lines.push(
    renderTable(
      ["Version", "Rows", "Pass/Not", "False Pass", "False Reject", "P50 ms", "P90 ms"],
      report.versionRows,
    ),
  );
  lines.push("");
  lines.push("## Matrices");
  lines.push("");
  lines.push("Pass/not-pass:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.passNotPass.matrix, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Verifier policy:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.verifierPolicy.matrix, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Replay verifier policy:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.verifierReplayPolicy.matrix, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Verifier statuses:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byVerifierStatus, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Verifier reasons:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byVerifierReason, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Verifier policies:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byVerifierPolicy, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Verifier versions:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byVerifierVersion, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Replay verifier statuses:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byReplayVerifierStatus, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Replay verifier reasons:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byReplayVerifierReason, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Replay verifier policies:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byReplayVerifierPolicy, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Replay verifier versions:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byReplayVerifierVersion, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Audio upload statuses:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.byAudioUploadStatus, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("Exact labels:");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(summary.exact.matrix, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## False Passes");
  lines.push("");
  lines.push(renderTopRows(summary.falsePasses));
  lines.push("");
  lines.push("## False Rejects");
  lines.push("");
  lines.push(renderTopRows(summary.falseRejects));
  lines.push("");
  lines.push("## Verifier False Passes");
  lines.push("");
  lines.push(renderVerifierRows(summary.verifierFalsePasses));
  lines.push("");
  lines.push("## Verifier False Rejects");
  lines.push("");
  lines.push(renderVerifierRows(summary.verifierFalseRejects));
  lines.push("");
  lines.push("## Verifier Capture Issues");
  lines.push("");
  lines.push(renderVerifierRows(summary.verifierCaptureIssues));
  lines.push("");
  lines.push("## Replay Verifier False Passes");
  lines.push("");
  lines.push(renderVerifierRows(summary.replayVerifierFalsePasses, { replay: true }));
  lines.push("");
  lines.push("## Replay Verifier False Rejects");
  lines.push("");
  lines.push(renderVerifierRows(summary.replayVerifierFalseRejects, { replay: true }));
  lines.push("");
  lines.push("## Replay Verifier Capture Issues");
  lines.push("");
  lines.push(renderVerifierRows(summary.replayVerifierCaptureIssues, { replay: true }));
  lines.push("");
  lines.push("## Exact Mismatches");
  lines.push("");
  lines.push(renderTopRows(summary.exactMismatches));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function stripHeavyRows(summary) {
  return {
    ...summary,
    falsePasses: summary.falsePasses.map(compactRow),
    falseRejects: summary.falseRejects.map(compactRow),
    verifierFalsePasses: summary.verifierFalsePasses.map(compactRow),
    verifierFalseRejects: summary.verifierFalseRejects.map(compactRow),
    verifierCaptureIssues: summary.verifierCaptureIssues.map(compactRow),
    replayVerifierFalsePasses: summary.replayVerifierFalsePasses.map(compactRow),
    replayVerifierFalseRejects: summary.replayVerifierFalseRejects.map(compactRow),
    replayVerifierCaptureIssues: summary.replayVerifierCaptureIssues.map(compactRow),
    exactMismatches: summary.exactMismatches.map(compactRow),
  };
}

function printSummary(report) {
  const summary = report.summary;
  console.log("Recite Lab report");
  console.log(`Rows: ${summary.rowCount}, audio: ${summary.audioRows}`);
  console.log(
    `Pass/not-pass accuracy: ${summary.passNotPass.correct}/${summary.passNotPass.knownRows} (${summary.passNotPass.accuracy})`,
  );
  console.log(
    `False passes: ${summary.passNotPass.falsePassCount}, false rejects: ${summary.passNotPass.falseRejectCount}`,
  );
  if (summary.verifierPolicy.rows > 0) {
    console.log(
      `Verifier: ${summary.verifierPolicy.correct}/${summary.verifierPolicy.evaluatedRows} (${summary.verifierPolicy.accuracy}) falsePass=${summary.verifierPolicy.falsePassCount} falseReject=${summary.verifierPolicy.falseRejectCount} capture=${summary.verifierPolicy.captureIssueCount}`,
    );
  }
  if (summary.verifierReplayPolicy.rows > 0) {
    console.log(
      `Replay verifier: ${summary.verifierReplayPolicy.correct}/${summary.verifierReplayPolicy.evaluatedRows} (${summary.verifierReplayPolicy.accuracy}) falsePass=${summary.verifierReplayPolicy.falsePassCount} falseReject=${summary.verifierReplayPolicy.falseRejectCount} capture=${summary.verifierReplayPolicy.captureIssueCount}`,
    );
  }
  console.log(
    `First result latency p50/p90: ${summary.latency.firstResultLatencyMs.p50}/${summary.latency.firstResultLatencyMs.p90} ms`,
  );
  console.log("");
  console.log("By scope:");
  for (const row of report.scopeRows) {
    console.log(
      `- ${row[0]} rows=${row[1]} pass/not=${row[3]} falsePass=${row[4]} falseReject=${row[5]} p50=${row[6]}ms`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let rows = await readJsonl(DATASET_FILE);
  if (options.scope) {
    rows = rows.filter((row) => (row.expectedScope?.label ?? row.expectedScope?.mode) === options.scope);
  }
  if (options.latest) rows = rows.slice(-options.latest);
  if (options.audioOnly) rows = rows.filter((row) => row.audio?.hasAudio);
  rows = rows.filter((row) => KNOWN_LABELS.has(row.labels?.effective ?? ""));

  const summary = summarizeRows(rows);
  const report = {
    generatedAt: new Date().toISOString(),
    datasetFile: path.relative(ROOT_DIR, DATASET_FILE),
    filters: {
      scope: options.scope,
      latest: options.latest,
      audioOnly: options.audioOnly,
    },
    summary,
    scopeRows: buildScopeRows(rows),
    versionRows: buildVersionRows(rows),
  };
  const compactReport = {
    ...report,
    summary: stripHeavyRows(summary),
  };

  if (options.write) {
    const reportFiles = getReportFiles(options);
    await mkdir(ANALYSIS_DIR, { recursive: true });
    await writeFile(reportFiles.markdown, renderMarkdown(report), "utf8");
    await writeFile(reportFiles.json, `${JSON.stringify(compactReport, null, 2)}\n`, "utf8");
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
