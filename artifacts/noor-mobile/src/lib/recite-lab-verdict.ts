import type {
  ReciteLabComparison,
  ReciteLabWindowTracker,
} from "@/src/lib/recite-lab-align";

export const RECITE_LAB_VERDICT_VERSION = "recite-lab-verdict-v0.3";
export const RECITE_LAB_VERDICT_POLICY_ID = "capture_tail_long_rescue";
const CAPTURE_DURATION_RATIO_THRESHOLD = 0.44;
const CAPTURE_HEARD_RATIO_THRESHOLD = 0.45;
const CAPTURE_ACCEPTED_RATIO_THRESHOLD = 0.9;

const DURATION_BASELINES_MS: Record<string, { count: number; medianDurationMs: number }> = {
  "1:1-3": { count: 2, medianDurationMs: 26140 },
  "1:1-4": { count: 1, medianDurationMs: 39344 },
  "1:1-6": { count: 1, medianDurationMs: 39344 },
  "1:1-7": { count: 54, medianDurationMs: 28629 },
  "1:3-7": { count: 1, medianDurationMs: 23697 },
  "66:1-7": { count: 5, medianDurationMs: 99713 },
};

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
  policyId: string;
  diagnostics: ReciteLabVerifierDiagnostics;
  version: string;
};

export type ReciteLabVerifierDiagnostics = {
  expectedCount: number;
  heardCount: number;
  acceptedCount: number;
  heardRatio: number | null;
  acceptedRatio: number | null;
  audioDurationMs: number | null;
  durationBaselineMs: number | null;
  durationBaselineSource: "scope" | "fallback" | "none";
  durationRatio: number | null;
  reachedEnd: boolean;
  nearEnd: boolean;
  comparisonDecision: string;
  windowStatus: string;
  comparisonScore: number;
  windowConfidence: number;
  missingCount: number;
  extraCount: number;
  substituteCount: number;
  offTargetExtraCount: number;
};

type ReciteLabVerifierInput = {
  expectedWords: string[];
  transcriptTokens: string[];
  comparison: ReciteLabComparison;
  windowTracker: ReciteLabWindowTracker;
  expectedScopeLabel?: string | null;
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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getDurationBaselineMs(input: ReciteLabVerifierInput) {
  const scopeBaseline = input.expectedScopeLabel
    ? DURATION_BASELINES_MS[input.expectedScopeLabel]
    : null;
  if (scopeBaseline?.medianDurationMs) {
    return {
      durationBaselineMs: scopeBaseline.medianDurationMs,
      durationBaselineSource: "scope" as const,
    };
  }

  const expectedCount = input.comparison.expectedCount;
  if (expectedCount <= 0) {
    return {
      durationBaselineMs: null,
      durationBaselineSource: "none" as const,
    };
  }

  return {
    durationBaselineMs: expectedCount * (expectedCount >= 60 ? 800 : 850),
    durationBaselineSource: "fallback" as const,
  };
}

function buildDiagnostics(input: ReciteLabVerifierInput): ReciteLabVerifierDiagnostics {
  const { comparison, windowTracker, timing } = input;
  const expectedCount = comparison.expectedCount;
  const heardRatio = expectedCount > 0 ? comparison.heardCount / expectedCount : null;
  const acceptedRatio = expectedCount > 0 ? windowTracker.acceptedCount / expectedCount : null;
  const nearEnd =
    expectedCount > 0 &&
    windowTracker.acceptedCount >= expectedCount - Math.max(1, Math.ceil(expectedCount * 0.04));
  const { durationBaselineMs, durationBaselineSource } = getDurationBaselineMs(input);
  const durationRatio =
    durationBaselineMs && timing.audioDurationMs !== null
      ? timing.audioDurationMs / durationBaselineMs
      : null;

  return {
    expectedCount,
    heardCount: comparison.heardCount,
    acceptedCount: windowTracker.acceptedCount,
    heardRatio,
    acceptedRatio,
    audioDurationMs: timing.audioDurationMs,
    durationBaselineMs,
    durationBaselineSource,
    durationRatio,
    reachedEnd: expectedCount > 0 && windowTracker.acceptedCount >= expectedCount,
    nearEnd,
    comparisonDecision: comparison.decision,
    windowStatus: windowTracker.status,
    comparisonScore: comparison.score,
    windowConfidence: windowTracker.confidence,
    missingCount: comparison.missingCount,
    extraCount: comparison.extraCount,
    substituteCount: comparison.substituteCount,
    offTargetExtraCount: comparison.offTargetExtraCount,
  };
}

function isLikelyCaptureCutoff(diagnostics: ReciteLabVerifierDiagnostics) {
  if (diagnostics.durationRatio === null) return false;

  const durationLooksShort = diagnostics.durationRatio < CAPTURE_DURATION_RATIO_THRESHOLD;
  const sparseTranscript =
    diagnostics.heardRatio !== null && diagnostics.heardRatio <= CAPTURE_HEARD_RATIO_THRESHOLD;
  const lowProgress =
    (diagnostics.acceptedRatio !== null &&
      diagnostics.acceptedRatio < CAPTURE_ACCEPTED_RATIO_THRESHOLD) ||
    diagnostics.windowStatus === "off_track";

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

function makeVerdict(
  verdict: Omit<ReciteLabVerifierVerdict, "diagnostics" | "policyId" | "version">,
  diagnostics: ReciteLabVerifierDiagnostics,
): ReciteLabVerifierVerdict {
  return {
    ...verdict,
    confidence: clamp01(verdict.confidence),
    diagnostics,
    policyId: RECITE_LAB_VERDICT_POLICY_ID,
    version: RECITE_LAB_VERDICT_VERSION,
  };
}

export function evaluateReciteLabVerifier(
  input: ReciteLabVerifierInput,
): ReciteLabVerifierVerdict {
  const { comparison, windowTracker } = input;
  const diagnostics = buildDiagnostics(input);

  if (isLikelyCaptureCutoff(diagnostics)) {
    return makeVerdict(
      {
        status: "capture_issue",
        reason: "capture_cutoff",
        message: "Capture cut off before enough usable evidence.",
        confidence: windowTracker.confidence,
        rescuedBy: null,
      },
      diagnostics,
    );
  }

  if (comparison.decision === "pass") {
    return makeVerdict(
      {
        status: "pass",
        reason: "strict_pass",
        message: "Transcript alignment passed.",
        confidence: comparison.score,
        rescuedBy: "transcript",
      },
      diagnostics,
    );
  }

  if (windowTracker.status === "complete") {
    return makeVerdict(
      {
        status: "pass",
        reason: "clean_window",
        message: "All transcript windows passed cleanly.",
        confidence: windowTracker.confidence,
        rescuedBy: "window",
      },
      diagnostics,
    );
  }

  if (isLongRangeRescue(input)) {
    return makeVerdict(
      {
        status: "pass",
        reason: "long_range_rescue",
        message: "Full long passage reached with strong window evidence.",
        confidence: Math.min(windowTracker.confidence, comparison.score),
        rescuedBy: "policy",
      },
      diagnostics,
    );
  }

  if (isFinalTailMerge(input)) {
    return makeVerdict(
      {
        status: "pass",
        reason: "final_tail_merge",
        message: "Final word appears merged in the transcript.",
        confidence: comparison.score,
        rescuedBy: "policy",
      },
      diagnostics,
    );
  }

  return makeVerdict(
    {
      status: "hold",
      reason: "needs_more_evidence",
      message: "Verifier is holding for more evidence.",
      confidence: Math.min(windowTracker.confidence, comparison.score),
      rescuedBy: null,
    },
    diagnostics,
  );
}
