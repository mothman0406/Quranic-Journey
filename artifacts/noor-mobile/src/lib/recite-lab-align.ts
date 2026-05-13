import { stripAlPrefix, wordMatches } from "@/src/lib/recite";

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
  leadingBismillahIgnored: boolean;
  operations: ReciteLabAlignmentOp[];
  firstIssues: ReciteLabAlignmentOp[];
};

type Cell = {
  cost: number;
  op: ReciteLabAlignmentOpType | "start";
};

const BISMILLAH_TOKENS = ["بسم", "الله", "الرحمان", "الرحيم"];

function labWordsMatch(heard: string, expected: string) {
  if (wordMatches(heard, expected, "")) return true;

  const heardNoAl = stripAlPrefix(heard);
  const expectedNoAl = stripAlPrefix(expected);
  return wordMatches(heardNoAl, expectedNoAl, "");
}

function startsWithBismillah(tokens: string[]) {
  if (tokens.length < BISMILLAH_TOKENS.length) return false;
  return BISMILLAH_TOKENS.every((expected, index) => labWordsMatch(tokens[index] ?? "", expected));
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
  substituteCount,
  score,
}: {
  expectedCount: number;
  comparableHeardCount: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  substituteCount: number;
  score: number;
}): ReciteLabAlignmentDecision {
  if (comparableHeardCount === 0) return "empty";
  if (expectedCount === 0) return "uncertain";
  if (score >= 0.92 && missingCount === 0 && substituteCount === 0 && extraCount <= 1) {
    return "pass";
  }

  const matchRatio = matchedCount / expectedCount;
  if (extraCount >= 2 && extraCount >= missingCount && extraCount >= substituteCount) {
    return "repeat";
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
  if (extraCount > 0) return "repeat";
  if (missingCount > 0) return "skip";
  return "uncertain";
}

export function compareReciteLabTokens(
  expectedWords: string[],
  heardTokens: string[],
): ReciteLabComparison {
  const expectedStartsWithBismillah = startsWithBismillah(expectedWords);
  const heardStartsWithBismillah = startsWithBismillah(heardTokens);
  const leadingBismillahIgnored = !expectedStartsWithBismillah && heardStartsWithBismillah;
  const comparableHeardTokens = leadingBismillahIgnored
    ? heardTokens.slice(BISMILLAH_TOKENS.length)
    : heardTokens;
  const operations = buildAlignment(expectedWords, comparableHeardTokens);
  const matchedCount = operations.filter((op) => op.type === "match").length;
  const missingCount = operations.filter((op) => op.type === "missing").length;
  const extraCount = operations.filter((op) => op.type === "extra").length;
  const substituteCount = operations.filter((op) => op.type === "substitute").length;
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
    leadingBismillahIgnored,
    operations,
    firstIssues: operations.filter((op) => op.type !== "match").slice(0, 5),
  };
}
