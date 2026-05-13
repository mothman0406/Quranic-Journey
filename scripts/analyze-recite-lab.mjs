import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ATTEMPTS_FILE = path.join(LAB_DIR, "attempts.jsonl");
const OVERRIDES_FILE = path.join(LAB_DIR, "label-overrides.json");
const AUDIO_DIR = path.join(LAB_DIR, "audio");
const ANALYSIS_DIR = path.join(LAB_DIR, "analysis");
const AUDIO_EXTENSIONS = [".wav", ".audio", ".m4a", ".aac", ".mp3", ".caf"];
const ANALYSIS_ALIGNMENT_VERSION = "recite-lab-align-v0.5";
const ANALYSIS_WINDOW_VERSION = "recite-lab-window-v0.2";
const WINDOW_TRACKER_SIZE = 10;

function parseArgs(argv) {
  const options = {
    latest: null,
    write: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--latest") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--latest must be followed by a positive number.");
      }
      options.latest = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function parseJsonLine(line, index) {
  try {
    return JSON.parse(line);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse attempts.jsonl line ${index + 1}: ${message}`);
  }
}

async function readAttempts() {
  if (!existsSync(ATTEMPTS_FILE)) return [];
  const content = await readFile(ATTEMPTS_FILE, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJsonLine);
}

async function readOverrides() {
  if (!existsSync(OVERRIDES_FILE)) return {};
  const content = await readFile(OVERRIDES_FILE, "utf8");
  const parsed = JSON.parse(content);
  return parsed?.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {};
}

async function readAudioIndex() {
  if (!existsSync(AUDIO_DIR)) return new Map();
  const files = await readdir(AUDIO_DIR);
  const index = new Map();

  for (const file of files) {
    const extension = path.extname(file);
    if (!AUDIO_EXTENSIONS.includes(extension)) continue;
    const id = path.basename(file, extension);
    const absolutePath = path.join(AUDIO_DIR, file);
    const metadataPath = path.join(AUDIO_DIR, `${id}.json`);
    let metadata = null;

    if (existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(await readFile(metadataPath, "utf8"));
      } catch {
        metadata = null;
      }
    }

    index.set(id, {
      file,
      path: path.relative(ROOT_DIR, absolutePath),
      metadataPath: existsSync(metadataPath) ? path.relative(ROOT_DIR, metadataPath) : null,
      bytes: metadata?.bytes ?? null,
      contentType: metadata?.contentType ?? null,
      receivedAt: metadata?.receivedAt ?? null,
    });
  }

  return index;
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function expectedDecisionForLabel(label) {
  switch (label) {
    case "correct":
      return "pass";
    case "skip":
      return "skip";
    case "repeat":
      return "repeat";
    case "wrong":
      return "wrong";
    default:
      return null;
  }
}

function stripAlPrefix(value) {
  return value.replace(/^ال/, "");
}

function finalTSafe(value) {
  return value.replace(/ت$/, "ه");
}

function compactAlef(value) {
  return value.replace(/ا/g, "");
}

function wordsEquivalent(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;

  const aNoAl = stripAlPrefix(a);
  const bNoAl = stripAlPrefix(b);
  if (aNoAl === bNoAl) return true;
  if (finalTSafe(a) === finalTSafe(b)) return true;
  return compactAlef(aNoAl) === compactAlef(bNoAl);
}

function decideCurrentComparison({
  expectedCount,
  comparableHeardCount,
  matchedCount,
  missingCount,
  extraCount,
  repeatedExpectedExtraCount,
  offTargetExtraCount,
  substituteCount,
  score,
}) {
  if (comparableHeardCount === 0) return "empty";
  if (expectedCount === 0) return "uncertain";
  if (
    score >= 0.92 &&
    missingCount === 0 &&
    substituteCount === 0 &&
    extraCount <= 1
  ) {
    return "pass";
  }

  const matchRatio = matchedCount / expectedCount;
  const cleanRepeat =
    extraCount > 0 &&
    repeatedExpectedExtraCount >= Math.max(1, extraCount - 1) &&
    substituteCount <= 1 &&
    missingCount <= 1 &&
    matchRatio >= 0.9;

  if (cleanRepeat) return "repeat";
  if (
    offTargetExtraCount >= 3 &&
    (substituteCount >= 1 || score < 0.65 || matchRatio < 0.85)
  ) {
    return "wrong";
  }

  if (substituteCount >= 3) return "wrong";
  if (missingCount >= 2 && substituteCount === 0 && missingCount >= extraCount) return "skip";
  if (matchRatio < 0.55) return "wrong";
  if (missingCount >= 1 && missingCount >= extraCount && missingCount >= substituteCount) {
    return "skip";
  }
  if (substituteCount >= 1) return "wrong";
  if (extraCount >= 2 && extraCount >= missingCount && extraCount >= substituteCount) {
    return "repeat";
  }
  if (extraCount > 0) return "repeat";
  if (missingCount > 0) return "skip";
  return "uncertain";
}

function getCurrentComparison(comparison, expectedWords) {
  const operations = Array.isArray(comparison.operations) ? comparison.operations : [];
  const expectedCount = comparison.expectedCount ?? expectedWords.length;
  const comparableHeardCount = comparison.comparableHeardCount ?? comparison.heardCount ?? null;
  const matchedCount = comparison.matchedCount ?? operations.filter((op) => op.type === "match").length;
  const missingCount = comparison.missingCount ?? operations.filter((op) => op.type === "missing").length;
  const extraOps = operations.filter((op) => op.type === "extra");
  const extraCount = comparison.extraCount ?? extraOps.length;
  const substituteCount =
    comparison.substituteCount ?? operations.filter((op) => op.type === "substitute").length;
  const repeatedExpectedExtraCount =
    comparison.repeatedExpectedExtraCount ??
    extraOps.filter((op) =>
      expectedWords.some((expected) => wordsEquivalent(op.heard ?? "", expected)),
    ).length;
  const offTargetExtraCount =
    comparison.offTargetExtraCount ?? Math.max(0, extraCount - repeatedExpectedExtraCount);
  const score =
    comparison.score ??
    (expectedCount === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            1 - (missingCount + extraCount * 0.65 + substituteCount * 1.15) / expectedCount,
          ),
        ));

  if (!comparison.decision || expectedCount === null || comparableHeardCount === null) {
    return {
      decision: comparison.decision ?? null,
      score,
      repeatedExpectedExtraCount,
      offTargetExtraCount,
      version: comparison.decision ? "payload" : null,
    };
  }

  return {
    decision: decideCurrentComparison({
      expectedCount,
      comparableHeardCount,
      matchedCount,
      missingCount,
      extraCount,
      repeatedExpectedExtraCount,
      offTargetExtraCount,
      substituteCount,
      score,
    }),
    score,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
    version: ANALYSIS_ALIGNMENT_VERSION,
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getWindowDecision({
  matchedCount,
  missingCount,
  extraCount,
  substituteCount,
  evaluatedExpectedCount,
  score,
}) {
  if (evaluatedExpectedCount === 0) return "pending";

  const matchedRatio = matchedCount / evaluatedExpectedCount;
  const uncertainSubstituteLimit = Math.max(2, Math.ceil(evaluatedExpectedCount * 0.45));

  if (
    missingCount === 0 &&
    extraCount <= 1 &&
    substituteCount === 0 &&
    score >= 0.82
  ) {
    return "pass";
  }

  if (
    missingCount <= 1 &&
    extraCount <= 2 &&
    substituteCount <= uncertainSubstituteLimit &&
    matchedRatio >= 0.42 &&
    score >= 0.56
  ) {
    return "uncertain";
  }

  if (matchedRatio >= 0.55 && score >= 0.52) return "uncertain";
  return "blocked";
}

function getWindowStatus({
  comparableHeardCount,
  expectedCount,
  acceptedCount,
  confidence,
  passedWindowCount,
  uncertainWindowCount,
  blockedWindowCount,
  pendingWindowCount,
}) {
  if (comparableHeardCount === 0) {
    return { status: "waiting", holdReason: "Waiting for recitation." };
  }

  const trackableWindowCount = passedWindowCount + uncertainWindowCount;
  const progressRatio = expectedCount === 0 ? 0 : acceptedCount / expectedCount;
  if (trackableWindowCount === 0 || confidence < 0.35) {
    return {
      status: "off_track",
      holdReason: "No reliable window is anchored to this passage yet.",
    };
  }

  if (acceptedCount >= expectedCount && expectedCount > 0) {
    if (blockedWindowCount > 0 || uncertainWindowCount > 0) {
      return {
        status: "needs_audio",
        holdReason: "Reached the end, but one or more windows need another signal.",
      };
    }

    return { status: "complete", holdReason: "All windows verified cleanly." };
  }

  if (pendingWindowCount > 0 && blockedWindowCount === 0) {
    return {
      status: "incomplete",
      holdReason: "Tracking is clean so far, but the capture ended before the range did.",
    };
  }

  if (pendingWindowCount > 0) {
    return {
      status: "incomplete",
      holdReason: "Tracking reached part of the range, but the capture ended before the rest.",
    };
  }

  if (acceptedCount < expectedCount && blockedWindowCount === 0) {
    return {
      status: "incomplete",
      holdReason: "Tracking is clean so far, but the expected range is not complete yet.",
    };
  }

  if (progressRatio >= 0.75 && blockedWindowCount > 0) {
    return {
      status: "needs_audio",
      holdReason: "The range was mostly reached, but the transcript windows need another signal.",
    };
  }

  if (blockedWindowCount > Math.max(1, trackableWindowCount)) {
    return {
      status: "off_track",
      holdReason: "Too many windows disagree with the expected passage.",
    };
  }

  return {
    status: "tracking",
    holdReason: "Window context is strong enough to move the cursor.",
  };
}

function getWindowTracker(comparison, expectedWords, transcriptTokens) {
  const operations = Array.isArray(comparison.operations) ? comparison.operations : [];
  const comparableHeardCount = comparison.comparableHeardCount ?? transcriptTokens.length;
  const expectedCount = expectedWords.length;
  if (operations.length === 0) {
    return {
      status: comparableHeardCount > 0 ? "off_track" : "waiting",
      holdReason: comparableHeardCount > 0 ? "No alignment operations were saved." : "Waiting for recitation.",
      acceptedCount: 0,
      expectedCount,
      heardCount: transcriptTokens.length,
      comparableHeardCount,
      windowSize: WINDOW_TRACKER_SIZE,
      windowCount: expectedCount === 0 ? 0 : Math.ceil(expectedCount / WINDOW_TRACKER_SIZE),
      passedWindowCount: 0,
      uncertainWindowCount: 0,
      blockedWindowCount: 0,
      pendingWindowCount: expectedCount === 0 ? 0 : Math.ceil(expectedCount / WINDOW_TRACKER_SIZE),
      confidence: 0,
      progressRatio: 0,
      currentWindow: null,
      version: ANALYSIS_WINDOW_VERSION,
    };
  }

  const lastEvidenceIndex = Math.max(
    0,
    ...operations
      .filter((op) => op.expectedIndex !== undefined && (op.type === "match" || op.type === "substitute"))
      .map((op) => op.expectedIndex ?? 0),
  );
  const windowCount = expectedCount === 0 ? 0 : Math.ceil(expectedCount / WINDOW_TRACKER_SIZE);
  const buckets = Array.from({ length: windowCount }, (_, index) => ({
    index,
    startExpectedIndex: index * WINDOW_TRACKER_SIZE + 1,
    endExpectedIndex: Math.min(expectedCount, (index + 1) * WINDOW_TRACKER_SIZE),
    matchedCount: 0,
    missingCount: 0,
    extraCount: 0,
    substituteCount: 0,
  }));
  let lastAnchoredExpectedIndex = 0;

  for (const op of operations) {
    const opExpectedIndex = op.expectedIndex ?? null;
    const anchorExpectedIndex =
      opExpectedIndex ?? Math.max(1, Math.min(expectedCount, lastAnchoredExpectedIndex || 1));
    const bucketIndex = Math.floor((anchorExpectedIndex - 1) / WINDOW_TRACKER_SIZE);
    const bucket = buckets[bucketIndex];
    if (!bucket) continue;

    if (op.type === "match") {
      bucket.matchedCount += 1;
    } else if (op.type === "substitute") {
      bucket.substituteCount += 1;
    } else if (op.type === "extra") {
      bucket.extraCount += 1;
    } else if ((op.expectedIndex ?? 0) <= lastEvidenceIndex) {
      bucket.missingCount += 1;
    }

    if (opExpectedIndex !== null) {
      lastAnchoredExpectedIndex = opExpectedIndex;
    }
  }

  const windows = buckets.map((bucket) => {
    const reachedWindow = lastEvidenceIndex >= bucket.startExpectedIndex;
    const reachedThrough = reachedWindow
      ? Math.min(bucket.endExpectedIndex, lastEvidenceIndex)
      : bucket.startExpectedIndex - 1;
    const evaluatedExpectedCount = reachedWindow
      ? Math.max(1, reachedThrough - bucket.startExpectedIndex + 1)
      : 0;
    const errorWeight =
      bucket.missingCount * 0.85 + bucket.substituteCount * 0.45 + bucket.extraCount * 0.35;
    const score =
      evaluatedExpectedCount === 0
        ? 0
        : clamp01(1 - errorWeight / Math.max(1, evaluatedExpectedCount));
    const decision = reachedWindow
      ? getWindowDecision({
          matchedCount: bucket.matchedCount,
          missingCount: bucket.missingCount,
          extraCount: bucket.extraCount,
          substituteCount: bucket.substituteCount,
          evaluatedExpectedCount,
          score,
        })
      : "pending";

    return {
      index: bucket.index + 1,
      startExpectedIndex: bucket.startExpectedIndex,
      endExpectedIndex: bucket.endExpectedIndex,
      decision,
      score,
      matchedCount: bucket.matchedCount,
      missingCount: bucket.missingCount,
      extraCount: bucket.extraCount,
      substituteCount: bucket.substituteCount,
      evaluatedExpectedCount,
    };
  });

  const passedWindowCount = windows.filter((window) => window.decision === "pass").length;
  const uncertainWindowCount = windows.filter((window) => window.decision === "uncertain").length;
  const blockedWindowCount = windows.filter((window) => window.decision === "blocked").length;
  const pendingWindowCount = windows.filter((window) => window.decision === "pending").length;
  const acceptedCount = Math.min(expectedCount, Math.max(0, lastEvidenceIndex));
  const evaluatedWindows = windows.filter((window) => window.decision !== "pending");
  const confidence =
    evaluatedWindows.length === 0
      ? 0
      : clamp01(
          evaluatedWindows.reduce((sum, window) => sum + window.score, 0) /
            evaluatedWindows.length,
        );
  const currentWindow =
    windows.find(
      (window) =>
        acceptedCount >= window.startExpectedIndex && acceptedCount <= window.endExpectedIndex,
    ) ??
    windows.find((window) => window.decision === "pending") ??
    windows[windows.length - 1] ??
    null;
  const { status, holdReason } = getWindowStatus({
    comparableHeardCount,
    expectedCount,
    acceptedCount,
    confidence,
    passedWindowCount,
    uncertainWindowCount,
    blockedWindowCount,
    pendingWindowCount,
  });

  return {
    status,
    holdReason,
    acceptedCount,
    expectedCount,
    heardCount: transcriptTokens.length,
    comparableHeardCount,
    windowSize: WINDOW_TRACKER_SIZE,
    windowCount,
    passedWindowCount,
    uncertainWindowCount,
    blockedWindowCount,
    pendingWindowCount,
    confidence,
    progressRatio: expectedCount === 0 ? 0 : clamp01(acceptedCount / expectedCount),
    currentWindow,
    windows,
    version: ANALYSIS_WINDOW_VERSION,
  };
}

function summarizeIssue(issue) {
  if (!issue || typeof issue !== "object") return null;
  return {
    type: issue.type ?? null,
    expected: issue.expected ?? null,
    heard: issue.heard ?? null,
    expectedIndex: issue.expectedIndex ?? null,
    heardIndex: issue.heardIndex ?? null,
  };
}

function toDatasetRow(record, overrides, audioIndex) {
  const payload = record.payload ?? {};
  const override = overrides[record.id] ?? null;
  const rawLabel = payload.label ?? "unlabeled";
  const effectiveLabel = typeof override === "string" ? override : override?.label ?? rawLabel;
  const comparison = payload.comparison ?? {};
  const expectedWords = payload.expectedWords ?? [];
  const currentComparison = getCurrentComparison(comparison, expectedWords);
  const liveProgress = payload.liveProgress ?? {};
  const phraseTracker = payload.phraseTracker ?? {};
  const usePayloadWindowTracker =
    payload.windowTracker?.status &&
    payload.algorithmVersions?.windowTracker === ANALYSIS_WINDOW_VERSION;
  const windowTracker = usePayloadWindowTracker
    ? { ...payload.windowTracker, version: "payload" }
    : getWindowTracker(comparison, expectedWords, payload.transcriptTokens ?? []);
  const route = payload.route ?? {};
  const expectedScope = payload.expectedScope ?? null;
  const timing = payload.timing ?? {};
  const audio = audioIndex.get(record.id) ?? null;
  const expectedDecision = expectedDecisionForLabel(effectiveLabel);
  const rawDecision = comparison.decision ?? null;
  const decision = currentComparison.decision ?? rawDecision;

  return {
    id: record.id,
    savedAt: record.savedAt ?? null,
    source: record.source ?? null,
    route: {
      surahNumber: route.surahNumber ?? null,
      ayahStart: route.ayahStart ?? null,
      ayahEnd: route.ayahEnd ?? null,
      endSurahNumber: route.endSurahNumber ?? null,
      page: route.page ?? null,
      mushafViewMode: route.mushafViewMode ?? null,
    },
    expectedScope: expectedScope
      ? {
          mode: expectedScope.mode ?? null,
          surahNumber: expectedScope.surahNumber ?? null,
          ayahStart: expectedScope.ayahStart ?? null,
          ayahEnd: expectedScope.ayahEnd ?? null,
          label: expectedScope.label ?? null,
          routeAyahStart: expectedScope.routeAyahStart ?? null,
          routeAyahEnd: expectedScope.routeAyahEnd ?? null,
        }
      : {
          mode: "legacy",
          surahNumber: route.surahNumber ?? null,
          ayahStart: route.ayahStart ?? null,
          ayahEnd: route.ayahEnd ?? null,
          label:
            route.surahNumber && route.ayahStart
              ? `${route.surahNumber}:${route.ayahStart}${route.ayahEnd && route.ayahEnd !== route.ayahStart ? `-${route.ayahEnd}` : ""}`
              : null,
          routeAyahStart: route.ayahStart ?? null,
          routeAyahEnd: route.ayahEnd ?? null,
        },
    labels: {
      raw: rawLabel,
      effective: effectiveLabel,
      overridden: rawLabel !== effectiveLabel,
      overrideReason: override && typeof override === "object" ? override.reason ?? null : null,
    },
    algorithmVersions: payload.algorithmVersions ?? {},
    saveMode: payload.saveMode ?? null,
    transcript: payload.transcript ?? "",
    normalizedTranscript: payload.normalizedTranscript ?? "",
    transcriptTokens: payload.transcriptTokens ?? [],
    expectedWords,
    counts: {
      expected: payload.expectedWordCount ?? comparison.expectedCount ?? null,
      heard: payload.heardTokenCount ?? comparison.heardCount ?? null,
      accepted: liveProgress.acceptedCount ?? null,
      matched: comparison.matchedCount ?? null,
      missing: comparison.missingCount ?? null,
      extra: comparison.extraCount ?? null,
      substitute: comparison.substituteCount ?? null,
    },
    live: {
      status: liveProgress.status ?? null,
      holdReason: liveProgress.holdReason ?? null,
      firstBlockingEvent: summarizeIssue(liveProgress.firstBlockingEvent),
    },
    phrase: {
      status: phraseTracker.status ?? null,
      holdReason: phraseTracker.holdReason ?? null,
      acceptedCount: phraseTracker.acceptedCount ?? null,
      confidence: phraseTracker.confidence ?? null,
      missingBeforeCursorCount: phraseTracker.missingBeforeCursorCount ?? null,
      extraBeforeCursorCount: phraseTracker.extraBeforeCursorCount ?? null,
      substituteBeforeCursorCount: phraseTracker.substituteBeforeCursorCount ?? null,
      recentPhrase: phraseTracker.recentPhrase ?? null,
    },
    window: {
      status: windowTracker.status ?? null,
      holdReason: windowTracker.holdReason ?? null,
      acceptedCount: windowTracker.acceptedCount ?? null,
      confidence: windowTracker.confidence ?? null,
      windowCount: windowTracker.windowCount ?? null,
      passedWindowCount: windowTracker.passedWindowCount ?? null,
      uncertainWindowCount: windowTracker.uncertainWindowCount ?? null,
      blockedWindowCount: windowTracker.blockedWindowCount ?? null,
      pendingWindowCount: windowTracker.pendingWindowCount ?? null,
      currentWindow: windowTracker.currentWindow ?? null,
      version: windowTracker.version ?? null,
    },
    comparison: {
      decision,
      rawDecision,
      decisionVersion: currentComparison.version,
      score: currentComparison.score ?? comparison.score ?? null,
      repeatedExpectedExtraCount: currentComparison.repeatedExpectedExtraCount,
      offTargetExtraCount: currentComparison.offTargetExtraCount,
      firstIssues: Array.isArray(comparison.firstIssues)
        ? comparison.firstIssues.slice(0, 5).map(summarizeIssue)
        : [],
    },
    timing: {
      firstResultLatencyMs: timing.firstResultLatencyMs ?? null,
      recognitionDurationMs: timing.recognitionDurationMs ?? null,
      audioDurationMs: timing.audioDurationMs ?? null,
      saveDelayMs: timing.saveDelayMs ?? null,
    },
    audio: {
      hasAudio: Boolean(audio),
      file: audio?.path ?? null,
      metadataFile: audio?.metadataPath ?? null,
      bytes: audio?.bytes ?? null,
      contentType: audio?.contentType ?? null,
      receivedAt: audio?.receivedAt ?? null,
    },
    review: {
      expectedDecision,
      labelDecisionMismatch: Boolean(expectedDecision && decision && expectedDecision !== decision),
      missingAudio: !audio,
    },
  };
}

function buildSummary(rows, totalRawAttempts) {
  const byEffectiveLabel = {};
  const byRawLabel = {};
  const byDecision = {};
  const byRawDecision = {};
  const byExpectedScopeMode = {};
  const byPhraseStatus = {};
  const byWindowStatus = {};
  const audioByEffectiveLabel = {};
  const audioByDecision = {};
  const audioByPhraseStatus = {};
  const audioByWindowStatus = {};
  const audioLabelDecisionMatrix = {};
  const labelDecisionMatrix = {};
  const needsReview = [];
  let withAudio = 0;
  let overridden = 0;

  for (const row of rows) {
    increment(byEffectiveLabel, row.labels.effective);
    increment(byRawLabel, row.labels.raw);
    increment(byDecision, row.comparison.decision ?? "unknown");
    increment(byRawDecision, row.comparison.rawDecision ?? "unknown");
    increment(byExpectedScopeMode, row.expectedScope.mode ?? "unknown");
    increment(byPhraseStatus, row.phrase.status ?? "unknown");
    increment(byWindowStatus, row.window.status ?? "unknown");
    if (row.audio.hasAudio) {
      withAudio += 1;
      increment(audioByEffectiveLabel, row.labels.effective);
      increment(audioByDecision, row.comparison.decision ?? "unknown");
      increment(audioByPhraseStatus, row.phrase.status ?? "unknown");
      increment(audioByWindowStatus, row.window.status ?? "unknown");
      increment(
        audioLabelDecisionMatrix,
        `${row.labels.effective}:${row.comparison.decision ?? "unknown"}`,
      );
    }
    if (row.labels.overridden) overridden += 1;

    const matrixKey = `${row.labels.effective}:${row.comparison.decision ?? "unknown"}`;
    increment(labelDecisionMatrix, matrixKey);

    if (row.labels.overridden || row.review.labelDecisionMismatch || row.review.missingAudio) {
      needsReview.push({
        id: row.id,
        savedAt: row.savedAt,
        rawLabel: row.labels.raw,
        effectiveLabel: row.labels.effective,
        decision: row.comparison.decision,
        liveStatus: row.live.status,
        score: row.comparison.score,
        firstIssues: row.comparison.firstIssues,
        reason: row.labels.overridden
          ? "label_override"
          : row.review.missingAudio
            ? "missing_audio"
            : "label_decision_mismatch",
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    attemptsFile: path.relative(ROOT_DIR, ATTEMPTS_FILE),
    overridesFile: path.relative(ROOT_DIR, OVERRIDES_FILE),
    audioDir: path.relative(ROOT_DIR, AUDIO_DIR),
    totalRawAttempts,
    analyzedAttempts: rows.length,
    withAudio,
    missingAudio: rows.length - withAudio,
    overridden,
    byRawLabel,
    byEffectiveLabel,
    byDecision,
    byRawDecision,
    byExpectedScopeMode,
    byPhraseStatus,
    byWindowStatus,
    audioByEffectiveLabel,
    audioByDecision,
    audioByPhraseStatus,
    audioByWindowStatus,
    audioLabelDecisionMatrix,
    labelDecisionMatrix,
    needsReview,
  };
}

function toAudioManifestRow(row) {
  return {
    id: row.id,
    audioFile: row.audio.file,
    audioBytes: row.audio.bytes,
    audioContentType: row.audio.contentType,
    label: row.labels.effective,
    rawLabel: row.labels.raw,
    expectedDecision: row.review.expectedDecision,
    currentDecision: row.comparison.decision,
    rawPayloadDecision: row.comparison.rawDecision,
    decisionVersion: row.comparison.decisionVersion,
    labelDecisionMismatch: row.review.labelDecisionMismatch,
    savedAt: row.savedAt,
    route: row.route,
    expectedScope: row.expectedScope,
    expectedWordCount: row.counts.expected,
    heardTokenCount: row.counts.heard,
    acceptedCount: row.counts.accepted,
    phraseAcceptedCount: row.phrase.acceptedCount,
    phraseStatus: row.phrase.status,
    phraseConfidence: row.phrase.confidence,
    windowAcceptedCount: row.window.acceptedCount,
    windowStatus: row.window.status,
    windowConfidence: row.window.confidence,
    windowCount: row.window.windowCount,
    windowPassedCount: row.window.passedWindowCount,
    windowUncertainCount: row.window.uncertainWindowCount,
    windowBlockedCount: row.window.blockedWindowCount,
    windowPendingCount: row.window.pendingWindowCount,
    score: row.comparison.score,
    missingCount: row.counts.missing,
    extraCount: row.counts.extra,
    substituteCount: row.counts.substitute,
    repeatedExpectedExtraCount: row.comparison.repeatedExpectedExtraCount,
    offTargetExtraCount: row.comparison.offTargetExtraCount,
    firstResultLatencyMs: row.timing.firstResultLatencyMs,
    audioDurationMs: row.timing.audioDurationMs,
    transcript: row.transcript,
    normalizedTranscript: row.normalizedTranscript,
    transcriptTokens: row.transcriptTokens,
    expectedWords: row.expectedWords,
  };
}

function buildAudioBaseline(rows) {
  const audioRows = rows.filter((row) => row.audio.hasAudio);
  const byLabel = {};
  const byDecision = {};
  const matrix = {};
  let knownLabels = 0;
  let matchingKnownLabels = 0;

  for (const row of audioRows) {
    increment(byLabel, row.labels.effective);
    increment(byDecision, row.comparison.decision ?? "unknown");
    increment(matrix, `${row.labels.effective}:${row.comparison.decision ?? "unknown"}`);

    if (row.review.expectedDecision) {
      knownLabels += 1;
      if (row.review.expectedDecision === row.comparison.decision) {
        matchingKnownLabels += 1;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    alignmentVersion: ANALYSIS_ALIGNMENT_VERSION,
    audioRows: audioRows.length,
    knownLabels,
    matchingKnownLabels,
    knownLabelAccuracy:
      knownLabels === 0 ? null : Number((matchingKnownLabels / knownLabels).toFixed(4)),
    byLabel,
    byDecision,
    labelDecisionMatrix: matrix,
  };
}

function printTextSummary(summary, rows) {
  const latest = rows.slice(-8).map((row) => {
    const shortId = row.id.slice(0, 8);
    const audio = row.audio.hasAudio ? "audio" : "no-audio";
    const override = row.labels.overridden ? `${row.labels.raw}->${row.labels.effective}` : row.labels.effective;
    return `${shortId} ${override} scope=${row.expectedScope.label ?? row.expectedScope.mode} decision=${row.comparison.decision} window=${row.window.status} windowAccepted=${row.window.acceptedCount}/${row.counts.expected} phrase=${row.phrase.status} live=${row.live.status} ${audio}`;
  });

  console.log("Recite Lab analysis");
  console.log(`Attempts: ${summary.analyzedAttempts}/${summary.totalRawAttempts}`);
  console.log(`Audio: ${summary.withAudio} present, ${summary.missingAudio} missing`);
  console.log(`Overrides: ${summary.overridden}`);
  console.log(`Effective labels: ${JSON.stringify(summary.byEffectiveLabel)}`);
  console.log(`Decisions: ${JSON.stringify(summary.byDecision)}`);
  console.log(`Phrase: ${JSON.stringify(summary.byPhraseStatus)}`);
  console.log(`Window: ${JSON.stringify(summary.byWindowStatus)}`);
  console.log(`Scopes: ${JSON.stringify(summary.byExpectedScopeMode)}`);
  console.log(`Audio labels: ${JSON.stringify(summary.audioByEffectiveLabel)}`);
  console.log("");
  console.log("Latest:");
  for (const line of latest) console.log(`- ${line}`);

  if (summary.needsReview.length > 0) {
    console.log("");
    console.log("Needs review:");
    for (const item of summary.needsReview.slice(-12)) {
      console.log(
        `- ${item.id.slice(0, 8)} ${item.reason} label=${item.rawLabel}->${item.effectiveLabel} decision=${item.decision}`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [attempts, overrides, audioIndex] = await Promise.all([
    readAttempts(),
    readOverrides(),
    readAudioIndex(),
  ]);
  const selectedAttempts = options.latest ? attempts.slice(-options.latest) : attempts;
  const rows = selectedAttempts.map((record) => toDatasetRow(record, overrides, audioIndex));
  const summary = buildSummary(rows, attempts.length);
  const audioManifestRows = rows.filter((row) => row.audio.hasAudio).map(toAudioManifestRow);
  const audioBaseline = buildAudioBaseline(rows);

  if (options.write) {
    await mkdir(ANALYSIS_DIR, { recursive: true });
    await writeFile(
      path.join(ANALYSIS_DIR, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(ANALYSIS_DIR, "dataset.jsonl"),
      `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
    await writeFile(
      path.join(ANALYSIS_DIR, "audio-manifest.jsonl"),
      `${audioManifestRows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
    await writeFile(
      path.join(ANALYSIS_DIR, "audio-baseline.json"),
      `${JSON.stringify(audioBaseline, null, 2)}\n`,
      "utf8",
    );
  }

  if (options.json) {
    console.log(JSON.stringify({ summary, audioBaseline, rows }, null, 2));
    return;
  }

  printTextSummary(summary, rows);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
