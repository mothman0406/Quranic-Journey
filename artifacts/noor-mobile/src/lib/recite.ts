// Strips Arabic diacritics (harakat) for fuzzy matching.
// Tashkeel range: U+064B..U+065F, U+0670 (alef khanjariah), shadda U+0651, sukun U+0652.
// Also strips tatweel U+0640 and removes any non-Arabic-letter chars.
export function normalizeArabic(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[^\u0621-\u063A\u0641-\u064A\u0671-\u06D3]/g, "")
    .trim();
}

// Levenshtein distance, capped at maxDist for early termination.
export function editDistanceUpTo(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1).fill(0).map((_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// True if heard string contains the expected word (with fuzzy tolerance).
// `heard` is the most recent transcript window (last ~5 words of partial transcript).
// `expected` is the next word the user should say.
export function matchesExpectedWord(heard: string, expected: string): boolean {
  const ne = normalizeArabic(expected);
  if (!ne) return false;
  const nh = normalizeArabic(heard);
  if (!nh) return false;

  // Direct substring match
  if (nh.includes(ne)) return true;

  // Fuzzy match: try each "word" (Arabic letter run) in heard against expected
  const heardWords = nh.match(/[\u0621-\u063A\u0641-\u064A\u0671-\u06D3]+/g) ?? [];
  const tolerance = ne.length <= 3 ? 0 : ne.length <= 5 ? 1 : 2;
  for (const hw of heardWords) {
    if (editDistanceUpTo(hw, ne, tolerance) <= tolerance) return true;
  }
  return false;
}
