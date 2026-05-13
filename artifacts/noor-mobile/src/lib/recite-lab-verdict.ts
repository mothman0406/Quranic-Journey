import type {
  ReciteLabComparison,
  ReciteLabWindowTracker,
} from "@/src/lib/recite-lab-align";

export const RECITE_LAB_VERDICT_VERSION = "recite-lab-verdict-v0.1";

export type ReciteLabVerifierStatus = "pass" | "hold" | "capture_issue";

export type ReciteLabVerifierReason =
  | "strict_pass"
  | "clean_window"
  | "capture_cutoff"
  | "long_range_rescue"
  | "final_tail_merge"
  | "needs_more_evidence";

export type ReciteLabVerifierVerdict = {
  status: ReciteLabVerifierStatus;
  reason: ReciteLabVerifierReason;
  message: string;
  confidence: number;
  rescuedBy: "transcript" | "window" | "policy" | null;
  version: string;
};

type ReciteLabVerifierInput = {
  expectedWords: string[];
  transcriptTokens: string[];
  comparison: ReciteLabComparison;
  windowTracker: ReciteLabWindowTracker;
  timing: {
    audioDurationMs: number | null;
  };
};

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064A]/g, "");
}

function compactArabic(value: string) {
  return normalizeArabic(value).replace(/ا/g, "");
}

function isLikelyCaptureCutoff({
  comparison,
  windowTracker,
  timing,
}: ReciteLabVerifierInput) {
  const expectedCount = comparison.expectedCount;
  if (expectedCount <= 0 || timing.audioDurationMs === null) return false;

  const minimumExpectedDurationMs = expectedCount * (expectedCount >= 60 ? 500 : 480);
  const durationLooksShort = timing.audioDurationMs < minimumExpectedDurationMs;
  const heardRatio = comparison.heardCount / expectedCount;
  const acceptedRatio = windowTracker.acceptedCount / expectedCount;
  const sparseTranscript = heardRatio <= 0.5;
  const lowProgress = acceptedRatio < 0.95 || windowTracker.status === "off_track";

  return durationLooksShort && (sparseTranscript || lowProgress);
}

function isLongRangeRescue({ comparison, windowTracker }: ReciteLabVerifierInput) {
  return (
    comparison.expectedCount >= 60 &&
    windowTracker.status === "needs_audio" &&
    windowTracker.acceptedCount >= comparison.expectedCount &&
    windowTracker.confidence >= 0.88 &&
    comparison.score >= 0.77 &&
    comparison.offTargetExtraCount <= 4
  );
}

function isFinalTailMerge({
  expectedWords,
  transcriptTokens,
  comparison,
  windowTracker,
}: ReciteLabVerifierInput) {
  if (
    comparison.expectedCount < 3 ||
    comparison.missingCount !== 1 ||
    comparison.extraCount !== 0 ||
    comparison.substituteCount !== 0 ||
    comparison.offTargetExtraCount !== 0 ||
    windowTracker.acceptedCount < comparison.expectedCount - 1 ||
    comparison.score < 0.94
  ) {
    return false;
  }

  const missingFinal = comparison.firstIssues.some(
    (issue) => issue.type === "missing" && issue.expectedIndex === comparison.expectedCount,
  );
  if (!missingFinal) return false;

  const previousExpected = expectedWords[comparison.expectedCount - 2] ?? "";
  const finalExpected = expectedWords[comparison.expectedCount - 1] ?? "";
  const finalHeard = transcriptTokens[transcriptTokens.length - 1] ?? "";
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

export function evaluateReciteLabVerifier(
  input: ReciteLabVerifierInput,
): ReciteLabVerifierVerdict {
  const { comparison, windowTracker } = input;

  if (isLikelyCaptureCutoff(input)) {
    return {
      status: "capture_issue",
      reason: "capture_cutoff",
      message: "Capture cut off before enough usable evidence.",
      confidence: Math.max(0, Math.min(1, windowTracker.confidence)),
      rescuedBy: null,
      version: RECITE_LAB_VERDICT_VERSION,
    };
  }

  if (comparison.decision === "pass") {
    return {
      status: "pass",
      reason: "strict_pass",
      message: "Transcript alignment passed.",
      confidence: Math.max(0, Math.min(1, comparison.score)),
      rescuedBy: "transcript",
      version: RECITE_LAB_VERDICT_VERSION,
    };
  }

  if (windowTracker.status === "complete") {
    return {
      status: "pass",
      reason: "clean_window",
      message: "All transcript windows passed cleanly.",
      confidence: Math.max(0, Math.min(1, windowTracker.confidence)),
      rescuedBy: "window",
      version: RECITE_LAB_VERDICT_VERSION,
    };
  }

  if (isLongRangeRescue(input)) {
    return {
      status: "pass",
      reason: "long_range_rescue",
      message: "Full long passage reached with strong window evidence.",
      confidence: Math.max(0, Math.min(1, Math.min(windowTracker.confidence, comparison.score))),
      rescuedBy: "policy",
      version: RECITE_LAB_VERDICT_VERSION,
    };
  }

  if (isFinalTailMerge(input)) {
    return {
      status: "pass",
      reason: "final_tail_merge",
      message: "Final word appears merged in the transcript.",
      confidence: Math.max(0, Math.min(1, comparison.score)),
      rescuedBy: "policy",
      version: RECITE_LAB_VERDICT_VERSION,
    };
  }

  return {
    status: "hold",
    reason: "needs_more_evidence",
    message: "Verifier is holding for more evidence.",
    confidence: Math.max(0, Math.min(1, Math.min(windowTracker.confidence, comparison.score))),
    rescuedBy: null,
    version: RECITE_LAB_VERDICT_VERSION,
  };
}
