import { stripAlPrefix, wordMatches } from "@/src/lib/recite";

export const RECITE_LAB_ALIGNMENT_VERSION = "recite-lab-align-v0.5";
export const RECITE_LAB_PHRASE_TRACKER_VERSION = "recite-lab-phrase-v0.2";
export const RECITE_LAB_WINDOW_TRACKER_VERSION = "recite-lab-window-v0.2";

export type ReciteLabAlignmentDecision =
  | "pass"
  | "repeat"
  | "skip"
  | "wrong"
  | "uncertain"
  | "empty";

export type ReciteLabAlignmentOpType = "match" | "missing" | "extra" | "substitute";

export type ReciteLabAlignmentOp = {
  type: ReciteLabAlignmentOpType;
  expected?: string;
  heard?: string;
  expectedIndex?: number;
  heardIndex?: number;
};

export type ReciteLabLiveStatus =
  | "waiting"
  | "advancing"
  | "complete"
  | "repeat"
  | "skip"
  | "mismatch";

export type ReciteLabLiveEventType = "match" | "repeat" | "skip" | "mismatch" | "extra";

export type ReciteLabLiveEvent = {
  type: ReciteLabLiveEventType;
  heard: string;
  heardIndex: number;
  expected?: string;
  expectedIndex?: number;
  skippedWords?: string[];
};

export type ReciteLabLiveProgress = {
  status: ReciteLabLiveStatus;
  acceptedCount: number;
  expectedCount: number;
  heardCount: number;
  comparableHeardCount: number;
  acceptedThroughWord: string | null;
  acceptedThroughIndex: number | null;
  nextExpectedWord: string | null;
  nextExpectedIndex: number | null;
  lastHeardWord: string | null;
  repeatCount: number;
  skippedCount: number;
  mismatchCount: number;
  leadingBismillahIgnored: boolean;
  progressRatio: number;
  holdReason: string;
  firstBlockingEvent: ReciteLabLiveEvent | null;
  recentEvents: ReciteLabLiveEvent[];
};

export type ReciteLabPhraseStatus =
  | "waiting"
  | "tracking"
  | "complete"
  | "repeat"
  | "uncertain"
  | "off_track";

export type ReciteLabPhraseTracker = {
  status: ReciteLabPhraseStatus;
  acceptedCount: number;
  expectedCount: number;
  heardCount: number;
  comparableHeardCount: number;
  matchedCount: number;
  missingBeforeCursorCount: number;
  extraBeforeCursorCount: number;
  substituteBeforeCursorCount: number;
  repeatedExpectedExtraCount: number;
  offTargetExtraCount: number;
  leadingBismillahIgnored: boolean;
  confidence: number;
  progressRatio: number;
  acceptedThroughWord: string | null;
  acceptedThroughIndex: number | null;
  nextExpectedWord: string | null;
  nextExpectedIndex: number | null;
  lastHeardWord: string | null;
  recentPhrase: string;
  holdReason: string;
  firstIssues: ReciteLabAlignmentOp[];
};

export type ReciteLabWindowStatus =
  | "waiting"
  | "tracking"
  | "complete"
  | "incomplete"
  | "needs_audio"
  | "off_track";

export type ReciteLabWindowDecision = "pass" | "uncertain" | "blocked" | "pending";

export type ReciteLabWindowSummary = {
  index: number;
  startExpectedIndex: number;
  endExpectedIndex: number;
  startWord: string | null;
  endWord: string | null;
  decision: ReciteLabWindowDecision;
  score: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  substituteCount: number;
  heardEvidenceCount: number;
  evaluatedExpectedCount: number;
};

export type ReciteLabWindowTracker = {
  status: ReciteLabWindowStatus;
  acceptedCount: number;
  expectedCount: number;
  heardCount: number;
  comparableHeardCount: number;
  windowSize: number;
  windowCount: number;
  passedWindowCount: number;
  uncertainWindowCount: number;
  blockedWindowCount: number;
  pendingWindowCount: number;
  leadingBismillahIgnored: boolean;
  confidence: number;
  progressRatio: number;
  acceptedThroughWord: string | null;
  acceptedThroughIndex: number | null;
  nextExpectedWord: string | null;
  nextExpectedIndex: number | null;
  currentWindow: ReciteLabWindowSummary | null;
  windows: ReciteLabWindowSummary[];
  holdReason: string;
};

export type ReciteLabComparison = {
  decision: ReciteLabAlignmentDecision;
  score: number;
  expectedCount: number;
  heardCount: number;
  comparableHeardCount: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  substituteCount: number;
  leadingExtraCount: number;
  trailingExtraCount: number;
  repeatedExpectedExtraCount: number;
  offTargetExtraCount: number;
  leadingBismillahIgnored: boolean;
  operations: ReciteLabAlignmentOp[];
  firstIssues: ReciteLabAlignmentOp[];
};

export type ReciteLabTokenAnalysis = {
  comparison: ReciteLabComparison;
  phraseTracker: ReciteLabPhraseTracker;
  windowTracker: ReciteLabWindowTracker;
};

type Cell = {
  cost: number;
  op: ReciteLabAlignmentOpType | "start";
};

const BISMILLAH_TOKENS = ["بسم", "الله", "الرحمان", "الرحيم"];
const LIVE_LOOKAHEAD_WORDS = 3;
const WINDOW_TRACKER_SIZE = 10;
const LIVE_SPEECH_EQUIVALENTS: Record<string, readonly string[]> = {
  نباني: ["نبهني"],
  نبهني: ["نباني"],
};

function areLiveSpeechEquivalent(a: string, b: string) {
  return LIVE_SPEECH_EQUIVALENTS[a]?.includes(b) || LIVE_SPEECH_EQUIVALENTS[b]?.includes(a) || false;
}

function labWordsMatch(heard: string, expected: string) {
  if (wordMatches(heard, expected, "")) return true;

  const heardNoAl = stripAlPrefix(heard);
  const expectedNoAl = stripAlPrefix(expected);
  return wordMatches(heardNoAl, expectedNoAl, "");
}

function finalTSafe(value: string) {
  return value.replace(/ت$/, "ه");
}

function editDistanceAtMostOne(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) {
      i += 1;
    } else if (b.length > a.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}

function liveWordsMatch(heard: string, expected: string) {
  if (!heard || !expected) return false;
  if (heard === expected || areLiveSpeechEquivalent(heard, expected)) return true;

  const heardNoAl = stripAlPrefix(heard);
  const expectedNoAl = stripAlPrefix(expected);
  if (heardNoAl === expectedNoAl) return true;

  const heardFinalT = finalTSafe(heard);
  const expectedFinalT = finalTSafe(expected);
  if (heardFinalT === expectedFinalT) return true;

  if (heard.length >= 4 && expected.length >= 4 && editDistanceAtMostOne(heard, expected)) {
    return true;
  }
  return (
    heardNoAl.length >= 4 &&
    expectedNoAl.length >= 4 &&
    editDistanceAtMostOne(heardNoAl, expectedNoAl)
  );
}

function startsWithBismillah(tokens: string[]) {
  if (tokens.length < BISMILLAH_TOKENS.length) return false;
  return BISMILLAH_TOKENS.every((expected, index) => labWordsMatch(tokens[index] ?? "", expected));
}

function getComparableHeardTokens(expectedWords: string[], heardTokens: string[]) {
  const expectedStartsWithBismillah = startsWithBismillah(expectedWords);
  const heardStartsWithBismillah = startsWithBismillah(heardTokens);
  const leadingBismillahIgnored = !expectedStartsWithBismillah && heardStartsWithBismillah;
  return {
    leadingBismillahIgnored,
    tokens: leadingBismillahIgnored ? heardTokens.slice(BISMILLAH_TOKENS.length) : heardTokens,
  };
}

function findLookaheadMatch(expectedWords: string[], heard: string, expectedIndex: number) {
  const end = Math.min(expectedWords.length, expectedIndex + LIVE_LOOKAHEAD_WORDS + 1);
  for (let index = expectedIndex + 1; index < end; index += 1) {
    if (liveWordsMatch(heard, expectedWords[index] ?? "")) return index;
  }
  return null;
}

function chooseCell(candidates: Cell[]) {
  const priority: Record<Cell["op"], number> = {
    start: 0,
    match: 1,
    substitute: 2,
    missing: 3,
    extra: 4,
  };

  return candidates.reduce((best, candidate) => {
    if (candidate.cost < best.cost) return candidate;
    if (candidate.cost === best.cost && priority[candidate.op] < priority[best.op]) {
      return candidate;
    }
    return best;
  });
}

function buildAlignment(expectedWords: string[], heardTokens: string[]) {
  const n = expectedWords.length;
  const m = heardTokens.length;
  const dp: Cell[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => ({ cost: Number.POSITIVE_INFINITY, op: "start" })),
  );

  dp[0][0] = { cost: 0, op: "start" };
  for (let i = 1; i <= n; i += 1) {
    dp[i][0] = { cost: dp[i - 1][0].cost + 1, op: "missing" };
  }
  for (let j = 1; j <= m; j += 1) {
    dp[0][j] = { cost: dp[0][j - 1].cost + 1, op: "extra" };
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const expected = expectedWords[i - 1] ?? "";
      const heard = heardTokens[j - 1] ?? "";
      const matches = labWordsMatch(heard, expected);
      dp[i][j] = chooseCell([
        {
          cost: dp[i - 1][j - 1].cost + (matches ? 0 : 1.25),
          op: matches ? "match" : "substitute",
        },
        { cost: dp[i - 1][j].cost + 1, op: "missing" },
        { cost: dp[i][j - 1].cost + 1, op: "extra" },
      ]);
    }
  }

  const operations: ReciteLabAlignmentOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const cell = dp[i][j];
    if (cell.op === "match" || cell.op === "substitute") {
      operations.push({
        type: cell.op,
        expected: expectedWords[i - 1],
        heard: heardTokens[j - 1],
        expectedIndex: i,
        heardIndex: j,
      });
      i -= 1;
      j -= 1;
    } else if (cell.op === "missing") {
      operations.push({
        type: "missing",
        expected: expectedWords[i - 1],
        expectedIndex: i,
      });
      i -= 1;
    } else {
      operations.push({
        type: "extra",
        heard: heardTokens[j - 1],
        heardIndex: j,
      });
      j -= 1;
    }
  }

  return operations.reverse();
}

function decide({
  expectedCount,
  comparableHeardCount,
  matchedCount,
  missingCount,
  extraCount,
  leadingExtraCount,
  repeatedExpectedExtraCount,
  offTargetExtraCount,
  substituteCount,
  score,
}: {
  expectedCount: number;
  comparableHeardCount: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  leadingExtraCount: number;
  repeatedExpectedExtraCount: number;
  offTargetExtraCount: number;
  substituteCount: number;
  score: number;
}): ReciteLabAlignmentDecision {
  if (comparableHeardCount === 0) return "empty";
  if (expectedCount === 0) return "uncertain";
  if (
    score >= 0.92 &&
    missingCount === 0 &&
    substituteCount === 0 &&
    (extraCount <= 1 || (extraCount === leadingExtraCount && leadingExtraCount <= 3))
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

  if (cleanRepeat) {
    return "repeat";
  }

  if (
    offTargetExtraCount >= 3 &&
    (substituteCount >= 1 || score < 0.65 || matchRatio < 0.85)
  ) {
    return "wrong";
  }

  if (substituteCount >= 3) return "wrong";
  if (missingCount >= 2 && substituteCount === 0 && missingCount >= extraCount) {
    return "skip";
  }
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

export function getReciteLabLiveProgress(
  expectedWords: string[],
  heardTokens: string[],
): ReciteLabLiveProgress {
  const { leadingBismillahIgnored, tokens: comparableHeardTokens } = getComparableHeardTokens(
    expectedWords,
    heardTokens,
  );
  let expectedIndex = 0;
  let repeatCount = 0;
  const skippedIndices = new Set<number>();
  let mismatchCount = 0;
  const events: ReciteLabLiveEvent[] = [];
  let firstBlockingEvent: ReciteLabLiveEvent | null = null;

  for (let heardOffset = 0; heardOffset < comparableHeardTokens.length; heardOffset += 1) {
    const heard = comparableHeardTokens[heardOffset] ?? "";
    const heardIndex = leadingBismillahIgnored ? heardOffset + BISMILLAH_TOKENS.length + 1 : heardOffset + 1;
    const expected = expectedWords[expectedIndex] ?? null;

    if (expected && liveWordsMatch(heard, expected)) {
      events.push({
        type: "match",
        heard,
        heardIndex,
        expected,
        expectedIndex: expectedIndex + 1,
      });
      expectedIndex += 1;
      continue;
    }

    const previousExpected = expectedIndex > 0 ? expectedWords[expectedIndex - 1] : null;
    if (previousExpected && liveWordsMatch(heard, previousExpected)) {
      repeatCount += 1;
      events.push({
        type: "repeat",
        heard,
        heardIndex,
        expected: previousExpected,
        expectedIndex,
      });
      continue;
    }

    if (expected) {
      const lookaheadIndex = findLookaheadMatch(expectedWords, heard, expectedIndex);
      if (lookaheadIndex !== null) {
        const skippedWords = expectedWords.slice(expectedIndex, lookaheadIndex);
        for (let index = expectedIndex; index < lookaheadIndex; index += 1) {
          skippedIndices.add(index);
        }
        const event: ReciteLabLiveEvent = {
          type: "skip",
          heard,
          heardIndex,
          expected: expectedWords[lookaheadIndex],
          expectedIndex: lookaheadIndex + 1,
          skippedWords,
        };
        firstBlockingEvent ??= event;
        events.push(event);
        continue;
      }

      mismatchCount += 1;
      const event: ReciteLabLiveEvent = {
        type: "mismatch",
        heard,
        heardIndex,
        expected,
        expectedIndex: expectedIndex + 1,
      };
      firstBlockingEvent ??= event;
      events.push(event);
      continue;
    }

    repeatCount += 1;
    events.push({
      type: "extra",
      heard,
      heardIndex,
      expected: expectedWords[expectedWords.length - 1],
      expectedIndex: expectedWords.length,
    });
  }

  const acceptedCount = Math.min(expectedIndex, expectedWords.length);
  const lastEvent = events[events.length - 1] ?? null;
  const skippedCount = skippedIndices.size;
  let status: ReciteLabLiveStatus = "waiting";
  let holdReason = "Waiting for recitation.";

  if (comparableHeardTokens.length === 0) {
    status = "waiting";
  } else if (acceptedCount >= expectedWords.length && expectedWords.length > 0) {
    status = "complete";
    holdReason = "All expected words accepted.";
  } else if (firstBlockingEvent?.type === "skip") {
    status = "skip";
    holdReason = "A later word matched before one or more expected words.";
  } else if (firstBlockingEvent?.type === "mismatch") {
    status = "mismatch";
    holdReason = "Heard word does not match the expected position.";
  } else if (lastEvent?.type === "mismatch") {
    status = "mismatch";
    holdReason = "Heard word does not match the expected position.";
  } else if (lastEvent?.type === "skip") {
    status = "skip";
    holdReason = "A later word matched before one or more expected words.";
  } else if (lastEvent?.type === "repeat" || lastEvent?.type === "extra") {
    status = "repeat";
    holdReason = "Repeated or extra word heard; cursor stays put.";
  } else if (lastEvent?.type === "match") {
    status = "advancing";
    holdReason = "Latest word accepted; cursor can advance.";
  } else if (mismatchCount > 0) {
    status = "mismatch";
    holdReason = "Heard word does not match the expected position.";
  } else if (skippedCount > 0) {
    status = "skip";
    holdReason = "A later word matched before one or more expected words.";
  }

  return {
    status,
    acceptedCount,
    expectedCount: expectedWords.length,
    heardCount: heardTokens.length,
    comparableHeardCount: comparableHeardTokens.length,
    acceptedThroughWord: acceptedCount > 0 ? expectedWords[acceptedCount - 1] ?? null : null,
    acceptedThroughIndex: acceptedCount > 0 ? acceptedCount : null,
    nextExpectedWord: acceptedCount < expectedWords.length ? expectedWords[acceptedCount] ?? null : null,
    nextExpectedIndex: acceptedCount < expectedWords.length ? acceptedCount + 1 : null,
    lastHeardWord: comparableHeardTokens[comparableHeardTokens.length - 1] ?? null,
    repeatCount,
    skippedCount,
    mismatchCount,
    leadingBismillahIgnored,
    progressRatio:
      expectedWords.length === 0 ? 0 : Math.max(0, Math.min(1, acceptedCount / expectedWords.length)),
    holdReason,
    firstBlockingEvent,
    recentEvents: events.slice(-5),
  };
}

function getOpsThroughExpectedIndex(operations: ReciteLabAlignmentOp[], expectedIndex: number) {
  return operations.filter((op) => {
    if (op.expectedIndex !== undefined) return op.expectedIndex <= expectedIndex;
    const heardIndex = op.heardIndex ?? Number.POSITIVE_INFINITY;
    const firstLaterExpected = operations.find(
      (candidate) =>
        candidate.expectedIndex !== undefined &&
        candidate.heardIndex !== undefined &&
        candidate.heardIndex > heardIndex,
    );
    return (firstLaterExpected?.expectedIndex ?? expectedIndex) <= expectedIndex;
  });
}

function decidePhraseStatus({
  acceptedCount,
  expectedCount,
  comparableHeardCount,
  confidence,
  missingBeforeCursorCount,
  substituteBeforeCursorCount,
  extraBeforeCursorCount,
  repeatedExpectedExtraCount,
  offTargetExtraCount,
}: {
  acceptedCount: number;
  expectedCount: number;
  comparableHeardCount: number;
  confidence: number;
  missingBeforeCursorCount: number;
  substituteBeforeCursorCount: number;
  extraBeforeCursorCount: number;
  repeatedExpectedExtraCount: number;
  offTargetExtraCount: number;
}): { status: ReciteLabPhraseStatus; holdReason: string } {
  if (comparableHeardCount === 0) {
    return { status: "waiting", holdReason: "Waiting for recitation." };
  }

  if (acceptedCount === 0 || confidence < 0.42) {
    return { status: "off_track", holdReason: "The heard phrase is not anchored to this range yet." };
  }

  const issueCount =
    missingBeforeCursorCount + substituteBeforeCursorCount + offTargetExtraCount;
  const cursorComplete = acceptedCount >= expectedCount && expectedCount > 0;
  const repeatDominant =
    extraBeforeCursorCount > 0 &&
    repeatedExpectedExtraCount >= Math.max(1, extraBeforeCursorCount - 1) &&
    offTargetExtraCount <= 1 &&
    confidence >= 0.72;

  if (cursorComplete && confidence >= 0.78 && issueCount === 0) {
    return repeatDominant
      ? { status: "repeat", holdReason: "Completed, with repeated expected words in the transcript." }
      : { status: "complete", holdReason: "Expected phrase reached." };
  }

  if (cursorComplete && confidence >= 0.78 && issueCount <= 2) {
    return {
      status: "uncertain",
      holdReason: "Phrase reached, but missing or substituted words need another signal.",
    };
  }

  if (repeatDominant) {
    return { status: "repeat", holdReason: "Tracking through a repeated expected phrase." };
  }

  if (confidence >= 0.72) {
    return { status: "tracking", holdReason: "Phrase context is strong enough to move the cursor." };
  }

  return {
    status: "uncertain",
    holdReason: "Some phrase context matched, but the signal is not clean yet.",
  };
}

function getDirectPrefixAcceptedCount(expectedWords: string[], heardTokens: string[]) {
  let acceptedCount = 0;
  const limit = Math.min(expectedWords.length, heardTokens.length);
  while (
    acceptedCount < limit &&
    liveWordsMatch(heardTokens[acceptedCount] ?? "", expectedWords[acceptedCount] ?? "")
  ) {
    acceptedCount += 1;
  }
  return acceptedCount;
}

export function getReciteLabPhraseTracker(
  expectedWords: string[],
  heardTokens: string[],
): ReciteLabPhraseTracker {
  const { leadingBismillahIgnored, tokens: comparableHeardTokens } = getComparableHeardTokens(
    expectedWords,
    heardTokens,
  );
  const operations = buildAlignment(expectedWords, comparableHeardTokens);
  const matchedOps = operations.filter((op) => op.type === "match" && op.expectedIndex !== undefined);
  const alignedAcceptedCount = Math.min(
    expectedWords.length,
    Math.max(0, ...matchedOps.map((op) => op.expectedIndex ?? 0)),
  );
  const alignedOpsThroughCursor = getOpsThroughExpectedIndex(operations, alignedAcceptedCount);
  const alignedMatchedCount = alignedOpsThroughCursor.filter((op) => op.type === "match").length;
  const alignedMissingCount = alignedOpsThroughCursor.filter((op) => op.type === "missing").length;
  const alignedExtraCount = alignedOpsThroughCursor.filter((op) => op.type === "extra").length;
  const alignedSubstituteCount = alignedOpsThroughCursor.filter(
    (op) => op.type === "substitute",
  ).length;
  const alignedErrorWeight =
    alignedMissingCount * 0.6 +
    alignedSubstituteCount * 0.75 +
    alignedExtraCount * 0.25;
  const alignedConfidence =
    alignedAcceptedCount === 0
      ? 0
      : Math.max(0, Math.min(1, (alignedMatchedCount - alignedErrorWeight) / alignedAcceptedCount));
  const prefixAcceptedCount = getDirectPrefixAcceptedCount(expectedWords, comparableHeardTokens);
  const usePrefixCursor =
    prefixAcceptedCount > 0 &&
    alignedAcceptedCount - comparableHeardTokens.length > 4 &&
    alignedConfidence < 0.72;
  const acceptedCount = usePrefixCursor ? prefixAcceptedCount : alignedAcceptedCount;
  const opsThroughCursor = usePrefixCursor
    ? Array.from({ length: acceptedCount }, (_, index) => ({
        type: "match" as const,
        expected: expectedWords[index],
        heard: comparableHeardTokens[index],
        expectedIndex: index + 1,
        heardIndex: index + 1,
      }))
    : alignedOpsThroughCursor;
  const matchedCount = opsThroughCursor.filter((op) => op.type === "match").length;
  const missingBeforeCursorCount = opsThroughCursor.filter((op) => op.type === "missing").length;
  const extraOps = opsThroughCursor.filter((op) => op.type === "extra");
  const extraBeforeCursorCount = extraOps.length;
  const substituteBeforeCursorCount = opsThroughCursor.filter(
    (op) => op.type === "substitute",
  ).length;
  const repeatedExpectedExtraCount = extraOps.filter((op) =>
    expectedWords.some((expected) => labWordsMatch(op.heard ?? "", expected)),
  ).length;
  const offTargetExtraCount = Math.max(0, extraBeforeCursorCount - repeatedExpectedExtraCount);
  const errorWeight =
    missingBeforeCursorCount * 0.6 +
    substituteBeforeCursorCount * 0.75 +
    offTargetExtraCount * 0.8 +
    Math.max(0, extraBeforeCursorCount - offTargetExtraCount) * 0.25;
  const confidence =
    acceptedCount === 0
      ? 0
      : Math.max(0, Math.min(1, (matchedCount - errorWeight) / acceptedCount));
  const { status, holdReason } = decidePhraseStatus({
    acceptedCount,
    expectedCount: expectedWords.length,
    comparableHeardCount: comparableHeardTokens.length,
    confidence,
    missingBeforeCursorCount,
    substituteBeforeCursorCount,
    extraBeforeCursorCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
  });

  return {
    status,
    acceptedCount,
    expectedCount: expectedWords.length,
    heardCount: heardTokens.length,
    comparableHeardCount: comparableHeardTokens.length,
    matchedCount,
    missingBeforeCursorCount,
    extraBeforeCursorCount,
    substituteBeforeCursorCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
    leadingBismillahIgnored,
    confidence,
    progressRatio:
      expectedWords.length === 0 ? 0 : Math.max(0, Math.min(1, acceptedCount / expectedWords.length)),
    acceptedThroughWord: acceptedCount > 0 ? expectedWords[acceptedCount - 1] ?? null : null,
    acceptedThroughIndex: acceptedCount > 0 ? acceptedCount : null,
    nextExpectedWord: acceptedCount < expectedWords.length ? expectedWords[acceptedCount] ?? null : null,
    nextExpectedIndex: acceptedCount < expectedWords.length ? acceptedCount + 1 : null,
    lastHeardWord: comparableHeardTokens[comparableHeardTokens.length - 1] ?? null,
    recentPhrase: comparableHeardTokens.slice(-8).join(" "),
    holdReason,
    firstIssues: opsThroughCursor.filter((op) => op.type !== "match").slice(0, 5),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getWindowDecision({
  matchedCount,
  missingCount,
  extraCount,
  substituteCount,
  evaluatedExpectedCount,
  score,
}: {
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  substituteCount: number;
  evaluatedExpectedCount: number;
  score: number;
}): ReciteLabWindowDecision {
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
}: {
  comparableHeardCount: number;
  expectedCount: number;
  acceptedCount: number;
  confidence: number;
  passedWindowCount: number;
  uncertainWindowCount: number;
  blockedWindowCount: number;
  pendingWindowCount: number;
}): { status: ReciteLabWindowStatus; holdReason: string } {
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

export function getReciteLabWindowTracker(
  expectedWords: string[],
  heardTokens: string[],
): ReciteLabWindowTracker {
  const { leadingBismillahIgnored, tokens: comparableHeardTokens } = getComparableHeardTokens(
    expectedWords,
    heardTokens,
  );
  const operations = buildAlignment(expectedWords, comparableHeardTokens);
  const lastEvidenceIndex = Math.max(
    0,
    ...operations
      .filter((op) => op.expectedIndex !== undefined && (op.type === "match" || op.type === "substitute"))
      .map((op) => op.expectedIndex ?? 0),
  );
  const windowCount =
    expectedWords.length === 0 ? 0 : Math.ceil(expectedWords.length / WINDOW_TRACKER_SIZE);
  const buckets = Array.from({ length: windowCount }, (_, index) => ({
    index,
    startExpectedIndex: index * WINDOW_TRACKER_SIZE + 1,
    endExpectedIndex: Math.min(expectedWords.length, (index + 1) * WINDOW_TRACKER_SIZE),
    matchedCount: 0,
    missingCount: 0,
    extraCount: 0,
    substituteCount: 0,
  }));
  let lastAnchoredExpectedIndex = 0;

  for (const op of operations) {
    const opExpectedIndex = op.expectedIndex ?? null;
    const anchorExpectedIndex =
      opExpectedIndex ??
      Math.max(1, Math.min(expectedWords.length, lastAnchoredExpectedIndex || 1));
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

  const windows: ReciteLabWindowSummary[] = buckets.map((bucket) => {
    const reachedWindow = lastEvidenceIndex >= bucket.startExpectedIndex;
    const reachedThrough = reachedWindow
      ? Math.min(bucket.endExpectedIndex, lastEvidenceIndex)
      : bucket.startExpectedIndex - 1;
    const evaluatedExpectedCount = reachedWindow
      ? Math.max(1, reachedThrough - bucket.startExpectedIndex + 1)
      : 0;
    const errorWeight =
      bucket.missingCount * 0.85 +
      bucket.substituteCount * 0.45 +
      bucket.extraCount * 0.35;
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
      startWord: expectedWords[bucket.startExpectedIndex - 1] ?? null,
      endWord: expectedWords[bucket.endExpectedIndex - 1] ?? null,
      decision,
      score,
      matchedCount: bucket.matchedCount,
      missingCount: bucket.missingCount,
      extraCount: bucket.extraCount,
      substituteCount: bucket.substituteCount,
      heardEvidenceCount: bucket.matchedCount + bucket.substituteCount + bucket.extraCount,
      evaluatedExpectedCount,
    };
  });

  const passedWindowCount = windows.filter((window) => window.decision === "pass").length;
  const uncertainWindowCount = windows.filter((window) => window.decision === "uncertain").length;
  const blockedWindowCount = windows.filter((window) => window.decision === "blocked").length;
  const pendingWindowCount = windows.filter((window) => window.decision === "pending").length;
  const acceptedCount = Math.min(expectedWords.length, Math.max(0, lastEvidenceIndex));
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
    comparableHeardCount: comparableHeardTokens.length,
    expectedCount: expectedWords.length,
    acceptedCount,
    confidence,
    passedWindowCount,
    uncertainWindowCount,
    blockedWindowCount,
    pendingWindowCount,
  });

  return {
    status,
    acceptedCount,
    expectedCount: expectedWords.length,
    heardCount: heardTokens.length,
    comparableHeardCount: comparableHeardTokens.length,
    windowSize: WINDOW_TRACKER_SIZE,
    windowCount,
    passedWindowCount,
    uncertainWindowCount,
    blockedWindowCount,
    pendingWindowCount,
    leadingBismillahIgnored,
    confidence,
    progressRatio:
      expectedWords.length === 0 ? 0 : Math.max(0, Math.min(1, acceptedCount / expectedWords.length)),
    acceptedThroughWord: acceptedCount > 0 ? expectedWords[acceptedCount - 1] ?? null : null,
    acceptedThroughIndex: acceptedCount > 0 ? acceptedCount : null,
    nextExpectedWord: acceptedCount < expectedWords.length ? expectedWords[acceptedCount] ?? null : null,
    nextExpectedIndex: acceptedCount < expectedWords.length ? acceptedCount + 1 : null,
    currentWindow,
    windows,
    holdReason,
  };
}

function buildComparisonFromOperations({
  expectedWords,
  heardTokens,
  comparableHeardTokens,
  leadingBismillahIgnored,
  operations,
}: {
  expectedWords: string[];
  heardTokens: string[];
  comparableHeardTokens: string[];
  leadingBismillahIgnored: boolean;
  operations: ReciteLabAlignmentOp[];
}): ReciteLabComparison {
  const matchedCount = operations.filter((op) => op.type === "match").length;
  const missingCount = operations.filter((op) => op.type === "missing").length;
  const extraOps = operations.filter((op) => op.type === "extra");
  const extraCount = extraOps.length;
  const substituteCount = operations.filter((op) => op.type === "substitute").length;
  const repeatedExpectedExtraCount = extraOps.filter((op) =>
    expectedWords.some((expected) => labWordsMatch(op.heard ?? "", expected)),
  ).length;
  const offTargetExtraCount = extraCount - repeatedExpectedExtraCount;
  const leadingExtraCount = operations.findIndex((op) => op.type !== "extra");
  const normalizedLeadingExtraCount = leadingExtraCount === -1 ? operations.length : leadingExtraCount;
  let trailingExtraCount = 0;
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    if (operations[index]?.type !== "extra") break;
    trailingExtraCount += 1;
  }
  const errorWeight = missingCount + extraCount * 0.65 + substituteCount * 1.15;
  const score =
    expectedWords.length === 0
      ? 0
      : Math.max(0, Math.min(1, 1 - errorWeight / expectedWords.length));
  const decision = decide({
    expectedCount: expectedWords.length,
    comparableHeardCount: comparableHeardTokens.length,
    matchedCount,
    missingCount,
    extraCount,
    leadingExtraCount: normalizedLeadingExtraCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
    substituteCount,
    score,
  });

  return {
    decision,
    score,
    expectedCount: expectedWords.length,
    heardCount: heardTokens.length,
    comparableHeardCount: comparableHeardTokens.length,
    matchedCount,
    missingCount,
    extraCount,
    substituteCount,
    leadingExtraCount: normalizedLeadingExtraCount,
    trailingExtraCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
    leadingBismillahIgnored,
    operations,
    firstIssues: operations.filter((op) => op.type !== "match").slice(0, 5),
  };
}

function buildPhraseTrackerFromOperations({
  expectedWords,
  heardTokens,
  comparableHeardTokens,
  leadingBismillahIgnored,
  operations,
}: {
  expectedWords: string[];
  heardTokens: string[];
  comparableHeardTokens: string[];
  leadingBismillahIgnored: boolean;
  operations: ReciteLabAlignmentOp[];
}): ReciteLabPhraseTracker {
  const matchedOps = operations.filter((op) => op.type === "match" && op.expectedIndex !== undefined);
  const alignedAcceptedCount = Math.min(
    expectedWords.length,
    Math.max(0, ...matchedOps.map((op) => op.expectedIndex ?? 0)),
  );
  const alignedOpsThroughCursor = getOpsThroughExpectedIndex(operations, alignedAcceptedCount);
  const alignedMatchedCount = alignedOpsThroughCursor.filter((op) => op.type === "match").length;
  const alignedMissingCount = alignedOpsThroughCursor.filter((op) => op.type === "missing").length;
  const alignedExtraCount = alignedOpsThroughCursor.filter((op) => op.type === "extra").length;
  const alignedSubstituteCount = alignedOpsThroughCursor.filter(
    (op) => op.type === "substitute",
  ).length;
  const alignedErrorWeight =
    alignedMissingCount * 0.6 +
    alignedSubstituteCount * 0.75 +
    alignedExtraCount * 0.25;
  const alignedConfidence =
    alignedAcceptedCount === 0
      ? 0
      : Math.max(0, Math.min(1, (alignedMatchedCount - alignedErrorWeight) / alignedAcceptedCount));
  const prefixAcceptedCount = getDirectPrefixAcceptedCount(expectedWords, comparableHeardTokens);
  const usePrefixCursor =
    prefixAcceptedCount > 0 &&
    alignedAcceptedCount - comparableHeardTokens.length > 4 &&
    alignedConfidence < 0.72;
  const acceptedCount = usePrefixCursor ? prefixAcceptedCount : alignedAcceptedCount;
  const opsThroughCursor = usePrefixCursor
    ? Array.from({ length: acceptedCount }, (_, index) => ({
        type: "match" as const,
        expected: expectedWords[index],
        heard: comparableHeardTokens[index],
        expectedIndex: index + 1,
        heardIndex: index + 1,
      }))
    : alignedOpsThroughCursor;
  const matchedCount = opsThroughCursor.filter((op) => op.type === "match").length;
  const missingBeforeCursorCount = opsThroughCursor.filter((op) => op.type === "missing").length;
  const extraOps = opsThroughCursor.filter((op) => op.type === "extra");
  const extraBeforeCursorCount = extraOps.length;
  const substituteBeforeCursorCount = opsThroughCursor.filter(
    (op) => op.type === "substitute",
  ).length;
  const repeatedExpectedExtraCount = extraOps.filter((op) =>
    expectedWords.some((expected) => labWordsMatch(op.heard ?? "", expected)),
  ).length;
  const offTargetExtraCount = Math.max(0, extraBeforeCursorCount - repeatedExpectedExtraCount);
  const errorWeight =
    missingBeforeCursorCount * 0.6 +
    substituteBeforeCursorCount * 0.75 +
    offTargetExtraCount * 0.8 +
    Math.max(0, extraBeforeCursorCount - offTargetExtraCount) * 0.25;
  const confidence =
    acceptedCount === 0
      ? 0
      : Math.max(0, Math.min(1, (matchedCount - errorWeight) / acceptedCount));
  const { status, holdReason } = decidePhraseStatus({
    acceptedCount,
    expectedCount: expectedWords.length,
    comparableHeardCount: comparableHeardTokens.length,
    confidence,
    missingBeforeCursorCount,
    substituteBeforeCursorCount,
    extraBeforeCursorCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
  });

  return {
    status,
    acceptedCount,
    expectedCount: expectedWords.length,
    heardCount: heardTokens.length,
    comparableHeardCount: comparableHeardTokens.length,
    matchedCount,
    missingBeforeCursorCount,
    extraBeforeCursorCount,
    substituteBeforeCursorCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
    leadingBismillahIgnored,
    confidence,
    progressRatio:
      expectedWords.length === 0 ? 0 : Math.max(0, Math.min(1, acceptedCount / expectedWords.length)),
    acceptedThroughWord: acceptedCount > 0 ? expectedWords[acceptedCount - 1] ?? null : null,
    acceptedThroughIndex: acceptedCount > 0 ? acceptedCount : null,
    nextExpectedWord: acceptedCount < expectedWords.length ? expectedWords[acceptedCount] ?? null : null,
    nextExpectedIndex: acceptedCount < expectedWords.length ? acceptedCount + 1 : null,
    lastHeardWord: comparableHeardTokens[comparableHeardTokens.length - 1] ?? null,
    recentPhrase: comparableHeardTokens.slice(-8).join(" "),
    holdReason,
    firstIssues: opsThroughCursor.filter((op) => op.type !== "match").slice(0, 5),
  };
}

function buildWindowTrackerFromOperations({
  expectedWords,
  heardTokens,
  comparableHeardTokens,
  leadingBismillahIgnored,
  operations,
}: {
  expectedWords: string[];
  heardTokens: string[];
  comparableHeardTokens: string[];
  leadingBismillahIgnored: boolean;
  operations: ReciteLabAlignmentOp[];
}): ReciteLabWindowTracker {
  const lastEvidenceIndex = Math.max(
    0,
    ...operations
      .filter((op) => op.expectedIndex !== undefined && (op.type === "match" || op.type === "substitute"))
      .map((op) => op.expectedIndex ?? 0),
  );
  const windowCount =
    expectedWords.length === 0 ? 0 : Math.ceil(expectedWords.length / WINDOW_TRACKER_SIZE);
  const buckets = Array.from({ length: windowCount }, (_, index) => ({
    index,
    startExpectedIndex: index * WINDOW_TRACKER_SIZE + 1,
    endExpectedIndex: Math.min(expectedWords.length, (index + 1) * WINDOW_TRACKER_SIZE),
    matchedCount: 0,
    missingCount: 0,
    extraCount: 0,
    substituteCount: 0,
  }));
  let lastAnchoredExpectedIndex = 0;

  for (const op of operations) {
    const opExpectedIndex = op.expectedIndex ?? null;
    const anchorExpectedIndex =
      opExpectedIndex ??
      Math.max(1, Math.min(expectedWords.length, lastAnchoredExpectedIndex || 1));
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

  const windows: ReciteLabWindowSummary[] = buckets.map((bucket) => {
    const reachedWindow = lastEvidenceIndex >= bucket.startExpectedIndex;
    const reachedThrough = reachedWindow
      ? Math.min(bucket.endExpectedIndex, lastEvidenceIndex)
      : bucket.startExpectedIndex - 1;
    const evaluatedExpectedCount = reachedWindow
      ? Math.max(1, reachedThrough - bucket.startExpectedIndex + 1)
      : 0;
    const errorWeight =
      bucket.missingCount * 0.85 +
      bucket.substituteCount * 0.45 +
      bucket.extraCount * 0.35;
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
      startWord: expectedWords[bucket.startExpectedIndex - 1] ?? null,
      endWord: expectedWords[bucket.endExpectedIndex - 1] ?? null,
      decision,
      score,
      matchedCount: bucket.matchedCount,
      missingCount: bucket.missingCount,
      extraCount: bucket.extraCount,
      substituteCount: bucket.substituteCount,
      heardEvidenceCount: bucket.matchedCount + bucket.substituteCount + bucket.extraCount,
      evaluatedExpectedCount,
    };
  });

  const passedWindowCount = windows.filter((window) => window.decision === "pass").length;
  const uncertainWindowCount = windows.filter((window) => window.decision === "uncertain").length;
  const blockedWindowCount = windows.filter((window) => window.decision === "blocked").length;
  const pendingWindowCount = windows.filter((window) => window.decision === "pending").length;
  const acceptedCount = Math.min(expectedWords.length, Math.max(0, lastEvidenceIndex));
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
    comparableHeardCount: comparableHeardTokens.length,
    expectedCount: expectedWords.length,
    acceptedCount,
    confidence,
    passedWindowCount,
    uncertainWindowCount,
    blockedWindowCount,
    pendingWindowCount,
  });

  return {
    status,
    acceptedCount,
    expectedCount: expectedWords.length,
    heardCount: heardTokens.length,
    comparableHeardCount: comparableHeardTokens.length,
    windowSize: WINDOW_TRACKER_SIZE,
    windowCount,
    passedWindowCount,
    uncertainWindowCount,
    blockedWindowCount,
    pendingWindowCount,
    leadingBismillahIgnored,
    confidence,
    progressRatio:
      expectedWords.length === 0 ? 0 : Math.max(0, Math.min(1, acceptedCount / expectedWords.length)),
    acceptedThroughWord: acceptedCount > 0 ? expectedWords[acceptedCount - 1] ?? null : null,
    acceptedThroughIndex: acceptedCount > 0 ? acceptedCount : null,
    nextExpectedWord: acceptedCount < expectedWords.length ? expectedWords[acceptedCount] ?? null : null,
    nextExpectedIndex: acceptedCount < expectedWords.length ? acceptedCount + 1 : null,
    currentWindow,
    windows,
    holdReason,
  };
}

export function analyzeReciteLabTokens(
  expectedWords: string[],
  heardTokens: string[],
): ReciteLabTokenAnalysis {
  const { leadingBismillahIgnored, tokens: comparableHeardTokens } = getComparableHeardTokens(
    expectedWords,
    heardTokens,
  );
  const operations = buildAlignment(expectedWords, comparableHeardTokens);
  const shared = {
    expectedWords,
    heardTokens,
    comparableHeardTokens,
    leadingBismillahIgnored,
    operations,
  };

  return {
    comparison: buildComparisonFromOperations(shared),
    phraseTracker: buildPhraseTrackerFromOperations(shared),
    windowTracker: buildWindowTrackerFromOperations(shared),
  };
}

export function compareReciteLabTokens(
  expectedWords: string[],
  heardTokens: string[],
): ReciteLabComparison {
  const { leadingBismillahIgnored, tokens: comparableHeardTokens } = getComparableHeardTokens(
    expectedWords,
    heardTokens,
  );
  const operations = buildAlignment(expectedWords, comparableHeardTokens);
  const matchedCount = operations.filter((op) => op.type === "match").length;
  const missingCount = operations.filter((op) => op.type === "missing").length;
  const extraOps = operations.filter((op) => op.type === "extra");
  const extraCount = extraOps.length;
  const substituteCount = operations.filter((op) => op.type === "substitute").length;
  const repeatedExpectedExtraCount = extraOps.filter((op) =>
    expectedWords.some((expected) => labWordsMatch(op.heard ?? "", expected)),
  ).length;
  const offTargetExtraCount = extraCount - repeatedExpectedExtraCount;
  const leadingExtraCount = operations.findIndex((op) => op.type !== "extra");
  const normalizedLeadingExtraCount = leadingExtraCount === -1 ? operations.length : leadingExtraCount;
  let trailingExtraCount = 0;
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    if (operations[index]?.type !== "extra") break;
    trailingExtraCount += 1;
  }
  const errorWeight = missingCount + extraCount * 0.65 + substituteCount * 1.15;
  const score =
    expectedWords.length === 0
      ? 0
      : Math.max(0, Math.min(1, 1 - errorWeight / expectedWords.length));
  const decision = decide({
    expectedCount: expectedWords.length,
    comparableHeardCount: comparableHeardTokens.length,
    matchedCount,
    missingCount,
    extraCount,
    leadingExtraCount: normalizedLeadingExtraCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
    substituteCount,
    score,
  });

  return {
    decision,
    score,
    expectedCount: expectedWords.length,
    heardCount: heardTokens.length,
    comparableHeardCount: comparableHeardTokens.length,
    matchedCount,
    missingCount,
    extraCount,
    substituteCount,
    leadingExtraCount: normalizedLeadingExtraCount,
    trailingExtraCount,
    repeatedExpectedExtraCount,
    offTargetExtraCount,
    leadingBismillahIgnored,
    operations,
    firstIssues: operations.filter((op) => op.type !== "match").slice(0, 5),
  };
}
