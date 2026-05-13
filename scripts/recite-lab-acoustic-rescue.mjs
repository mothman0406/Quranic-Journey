import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ANALYSIS_DIR = path.join(LAB_DIR, "analysis");
const DEFAULT_MANIFEST_FILE = path.join(ANALYSIS_DIR, "audio-manifest.jsonl");
const DEFAULT_SIMILARITY_FILE = path.join(ANALYSIS_DIR, "acoustic-similarity-results.jsonl");
const RESULTS_FILE = path.join(ANALYSIS_DIR, "acoustic-rescue-results.jsonl");
const SUMMARY_FILE = path.join(ANALYSIS_DIR, "acoustic-rescue-summary.json");
const EXPERIMENT_VERSION = "recite-lab-acoustic-rescue-v0.1";
const KNOWN_LABELS = new Set(["correct", "skip", "repeat", "wrong"]);

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    refreshSimilarity: false,
    manifestFile: DEFAULT_MANIFEST_FILE,
    similarityFile: DEFAULT_SIMILARITY_FILE,
    scopeLabel: "1:1-7",
    maxFalseRescues: 0,
    threshold: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--refresh-similarity") {
      options.refreshSimilarity = true;
    } else if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value) throw new Error("--manifest must be followed by a path.");
      options.manifestFile = path.resolve(ROOT_DIR, value);
      index += 1;
    } else if (arg === "--similarity") {
      const value = argv[index + 1];
      if (!value) throw new Error("--similarity must be followed by a path.");
      options.similarityFile = path.resolve(ROOT_DIR, value);
      index += 1;
    } else if (arg === "--scope") {
      const value = argv[index + 1];
      if (!value) throw new Error("--scope must be followed by a scope label.");
      options.scopeLabel = value;
      index += 1;
    } else if (arg === "--max-false-rescues") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--max-false-rescues must be followed by a number >= 0.");
      }
      options.maxFalseRescues = value;
      index += 1;
    } else if (arg === "--threshold") {
      const value = Number.parseFloat(argv[index + 1] ?? "");
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--threshold must be followed by a positive number.");
      }
      options.threshold = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function readJsonl(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing JSONL file: ${path.relative(ROOT_DIR, filePath)}`);
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

function refreshSimilarity(options) {
  const scriptPath = path.join(SCRIPT_DIR, "recite-lab-acoustic-similarity.mjs");
  const result = spawnSync(
    process.execPath,
    [scriptPath, "--write", "--scope", options.scopeLabel],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      `Could not refresh acoustic similarity scores.${stderr ? `\n${stderr}` : ""}${
        stdout ? `\n${stdout}` : ""
      }`,
    );
  }
}

function expectedPassForLabel(label) {
  if (label === "correct") return "pass";
  if (label === "skip" || label === "repeat" || label === "wrong") return "not_pass";
  return null;
}

function isNearCompleteCandidate(row) {
  if (!KNOWN_LABELS.has(row.label)) {
    return { eligible: false, reason: "unknown_label" };
  }
  if (row.currentDecision === "pass") {
    return { eligible: false, reason: "already_passed_by_transcript" };
  }

  const expectedCount = row.expectedWordCount ?? 0;
  const heardCount = row.heardTokenCount ?? 0;
  const score = row.score ?? 0;
  const missingCount = row.missingCount ?? 0;
  const extraCount = row.extraCount ?? 0;
  const substituteCount = row.substituteCount ?? 0;
  const issueCount = missingCount + extraCount + substituteCount;
  const phraseAcceptedCount = row.phraseAcceptedCount ?? 0;
  const phraseConfidence = row.phraseConfidence ?? score;
  const phraseStatus = row.phraseStatus ?? null;
  const reachedEnd =
    expectedCount > 0 &&
    (phraseAcceptedCount >= expectedCount - 1 || heardCount >= expectedCount - 1);
  const phraseLooksClose =
    (phraseStatus === "uncertain" || phraseStatus === "complete") && phraseConfidence >= 0.84;
  const transcriptLooksClose = score >= 0.88;

  if (!reachedEnd) {
    return { eligible: false, reason: "did_not_reach_end" };
  }
  if (!phraseLooksClose && !transcriptLooksClose) {
    return { eligible: false, reason: "not_close_enough" };
  }
  if (issueCount > 2) {
    return { eligible: false, reason: "too_many_transcript_issues" };
  }
  if (substituteCount > 1) {
    return { eligible: false, reason: "too_many_substitutions" };
  }
  if (extraCount > 1) {
    return { eligible: false, reason: "too_many_extras" };
  }

  return { eligible: true, reason: "near_complete_blocked_attempt" };
}

function summarizePredictions(predictions) {
  const matrix = {};
  let correct = 0;

  for (const prediction of predictions) {
    const actual = prediction.actual ?? "unknown";
    const predicted = prediction.predicted ?? "unknown";
    matrix[`${actual}:${predicted}`] = (matrix[`${actual}:${predicted}`] ?? 0) + 1;
    if (actual === predicted) correct += 1;
  }

  return {
    total: predictions.length,
    correct,
    accuracy: predictions.length === 0 ? null : Number((correct / predictions.length).toFixed(4)),
    matrix,
    mismatches: predictions.filter((prediction) => prediction.actual !== prediction.predicted),
  };
}

function calibrateThreshold(candidateRows, options) {
  const eligible = candidateRows.filter(
    (row) => row.isRescueCandidate && row.expectedPassDecision && Number.isFinite(row.distance),
  );
  const positives = eligible.filter((row) => row.expectedPassDecision === "pass");
  const negatives = eligible.filter((row) => row.expectedPassDecision === "not_pass");

  if (positives.length === 0) {
    return {
      threshold: null,
      reason: "no_correct_rescue_candidates",
      positiveCandidates: 0,
      negativeCandidates: negatives.length,
    };
  }

  const candidates = [...new Set(eligible.map((row) => row.distance))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let best = null;

  for (const threshold of candidates) {
    const rescued = eligible.filter((row) => row.distance <= threshold);
    const trueRescues = rescued.filter((row) => row.expectedPassDecision === "pass").length;
    const falseRescues = rescued.filter((row) => row.expectedPassDecision === "not_pass").length;
    const missedCorrect = positives.length - trueRescues;
    if (falseRescues > options.maxFalseRescues) continue;

    const candidate = {
      threshold,
      trueRescues,
      falseRescues,
      missedCorrect,
      positiveCandidates: positives.length,
      negativeCandidates: negatives.length,
    };
    if (
      !best ||
      candidate.trueRescues > best.trueRescues ||
      (candidate.trueRescues === best.trueRescues &&
        candidate.falseRescues < best.falseRescues) ||
      (candidate.trueRescues === best.trueRescues &&
        candidate.falseRescues === best.falseRescues &&
        candidate.threshold < best.threshold)
    ) {
      best = candidate;
    }
  }

  return best ?? {
    threshold: null,
    reason: "no_threshold_satisfies_false_rescue_limit",
    positiveCandidates: positives.length,
    negativeCandidates: negatives.length,
  };
}

function buildRows(manifestRows, similarityRows, options) {
  const similarityById = new Map(similarityRows.map((row) => [row.id, row]));
  return manifestRows
    .filter((row) => (row.expectedScope?.label ?? null) === options.scopeLabel)
    .filter((row) => KNOWN_LABELS.has(row.label))
    .map((row) => {
      const similarity = similarityById.get(row.id) ?? null;
      const eligibility = isNearCompleteCandidate(row);
      return {
        id: row.id,
        label: row.label,
        expectedPassDecision: expectedPassForLabel(row.label),
        currentDecision: row.currentDecision,
        phraseStatus: row.phraseStatus ?? null,
        phraseConfidence: row.phraseConfidence ?? null,
        phraseAcceptedCount: row.phraseAcceptedCount ?? null,
        expectedWordCount: row.expectedWordCount ?? null,
        heardTokenCount: row.heardTokenCount ?? null,
        score: row.score ?? null,
        missingCount: row.missingCount ?? null,
        extraCount: row.extraCount ?? null,
        substituteCount: row.substituteCount ?? null,
        firstResultLatencyMs: row.firstResultLatencyMs ?? null,
        audioDurationMs: row.audioDurationMs ?? null,
        audioFile: row.audioFile,
        isRescueCandidate: eligibility.eligible,
        rescueCandidateReason: eligibility.reason,
        distance: similarity?.distance ?? null,
        acousticDistance: similarity?.acousticDistance ?? null,
        durationPenalty: similarity?.durationPenalty ?? null,
        framePenalty: similarity?.framePenalty ?? null,
        nearestReferences: similarity?.nearestReferences?.slice(0, 3) ?? [],
      };
    });
}

function applyHybridDecision(rows, threshold) {
  return rows.map((row) => {
    const transcriptPass = row.currentDecision === "pass";
    const acousticRescued =
      !transcriptPass &&
      row.isRescueCandidate &&
      threshold !== null &&
      Number.isFinite(row.distance) &&
      row.distance <= threshold;

    return {
      ...row,
      acousticRescueDecision: acousticRescued ? "rescue_pass" : "hold",
      hybridPassDecision: transcriptPass || acousticRescued ? "pass" : "not_pass",
    };
  });
}

function countBy(rows, keyForRow) {
  const counts = {};
  for (const row of rows) {
    const key = keyForRow(row) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function buildSummary(rows, options, calibratedThreshold) {
  const manualThreshold = options.threshold;
  const selectedThreshold =
    manualThreshold ?? calibratedThreshold.threshold ?? null;
  const rowsWithHybrid = applyHybridDecision(rows, selectedThreshold);
  const primaryPredictions = rows.map((row) => ({
    id: row.id,
    actual: row.expectedPassDecision,
    predicted: row.currentDecision === "pass" ? "pass" : "not_pass",
    label: row.label,
  }));
  const hybridPredictions = rowsWithHybrid.map((row) => ({
    id: row.id,
    actual: row.expectedPassDecision,
    predicted: row.hybridPassDecision,
    label: row.label,
  }));
  const rescueCandidates = rowsWithHybrid.filter((row) => row.isRescueCandidate);
  const acousticRescues = rowsWithHybrid.filter(
    (row) => row.acousticRescueDecision === "rescue_pass",
  );

  return {
    generatedAt: new Date().toISOString(),
    experimentVersion: EXPERIMENT_VERSION,
    manifestFile: path.relative(ROOT_DIR, options.manifestFile),
    similarityFile: path.relative(ROOT_DIR, options.similarityFile),
    scopeLabel: options.scopeLabel,
    maxFalseRescues: options.maxFalseRescues,
    threshold: selectedThreshold,
    thresholdSource: manualThreshold !== null ? "manual" : calibratedThreshold.threshold ? "calibrated" : "none",
    calibratedThreshold,
    rowCount: rows.length,
    scoredRows: rows.filter((row) => Number.isFinite(row.distance)).length,
    byLabel: countBy(rows, (row) => row.label),
    byCurrentDecision: countBy(rows, (row) => row.currentDecision),
    candidateCount: rescueCandidates.length,
    candidatesByLabel: countBy(rescueCandidates, (row) => row.label),
    candidateReasons: countBy(rows, (row) => row.rescueCandidateReason),
    acousticRescueCount: acousticRescues.length,
    acousticRescuesByLabel: countBy(acousticRescues, (row) => row.label),
    primaryPassVsNotPass: summarizePredictions(primaryPredictions),
    hybridPassVsNotPass: summarizePredictions(hybridPredictions),
    falseRescues: acousticRescues.filter((row) => row.expectedPassDecision !== "pass"),
    missedCorrectCandidates: rescueCandidates.filter(
      (row) => row.expectedPassDecision === "pass" && row.acousticRescueDecision !== "rescue_pass",
    ),
  };
}

function printSummary(summary, rows) {
  const candidates = rows.filter((row) => row.isRescueCandidate);

  console.log("Recite Lab acoustic rescue");
  console.log(`Scope: ${summary.scopeLabel}`);
  console.log(`Rows: ${summary.rowCount}, scored: ${summary.scoredRows}`);
  console.log(`Candidates: ${summary.candidateCount} ${JSON.stringify(summary.candidatesByLabel)}`);
  console.log(
    `Threshold: ${
      summary.threshold === null ? "none" : summary.threshold.toFixed(4)
    } (${summary.thresholdSource})`,
  );
  if (summary.calibratedThreshold.reason) {
    console.log(`Calibration note: ${summary.calibratedThreshold.reason}`);
  }
  console.log(
    `Primary pass/not-pass: ${summary.primaryPassVsNotPass.correct}/${summary.primaryPassVsNotPass.total} (${summary.primaryPassVsNotPass.accuracy})`,
  );
  console.log(
    `Hybrid pass/not-pass: ${summary.hybridPassVsNotPass.correct}/${summary.hybridPassVsNotPass.total} (${summary.hybridPassVsNotPass.accuracy})`,
  );
  console.log(`Acoustic rescues: ${summary.acousticRescueCount}`);
  console.log(`False rescues: ${summary.falseRescues.length}`);

  if (candidates.length > 0) {
    console.log("");
    console.log("Rescue candidates:");
    for (const row of candidates.slice(-12)) {
      const distance = Number.isFinite(row.distance) ? row.distance.toFixed(4) : "n/a";
      const score = Number.isFinite(row.score) ? row.score.toFixed(3) : "n/a";
      console.log(
        `- ${row.id.slice(0, 8)} label=${row.label} current=${row.currentDecision} phrase=${
          row.phraseStatus ?? "none"
        } score=${score} issues=m${row.missingCount}/e${row.extraCount}/s${
          row.substituteCount
        } distance=${distance} rescue=${row.acousticRescueDecision}`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.refreshSimilarity) refreshSimilarity(options);

  const [manifestRows, similarityRows] = await Promise.all([
    readJsonl(options.manifestFile),
    readJsonl(options.similarityFile),
  ]);
  const rows = buildRows(manifestRows, similarityRows, options);
  const calibratedThreshold = calibrateThreshold(rows, options);
  const threshold = options.threshold ?? calibratedThreshold.threshold ?? null;
  const rowsWithHybrid = applyHybridDecision(rows, threshold);
  const summary = buildSummary(rows, options, calibratedThreshold);

  if (options.write) {
    await mkdir(ANALYSIS_DIR, { recursive: true });
    await writeFile(
      RESULTS_FILE,
      `${rowsWithHybrid.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
    await writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify({ summary, rows: rowsWithHybrid }, null, 2));
    return;
  }

  printSummary(summary, rowsWithHybrid);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
