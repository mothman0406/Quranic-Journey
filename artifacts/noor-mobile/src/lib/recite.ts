// Strip Arabic diacritics AND normalize letter variants for fuzzy matching.
// iOS speech recognition returns plain Arabic — no hamza variants, no
// ta-marbuta, no ya-with-hamza, no presentation forms. Quranic Uthmani text
// has all of these. Without normalization, transcripts almost never match.
export function stripTashkeel(s: string): string {
  let r = s;
  // Dagger alif
  r = r.replace(/\u0670/g, "ا");
  // Tashkeel (harakat) and other combining marks
  r = r.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  // Tatweel
  r = r.replace(/[ـ]/g, "");
  // Arabic presentation forms — decompose
  r = r.replace(/[\uFB50-\uFDFF]/g, (c) => c.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""));
  // Alef variants → bare alef
  r = r.replace(/[أإآاٱ]/g, "ا");
  // Alef maqsura → ya
  r = r.replace(/ى/g, "ي");
  // Ta marbuta → ha
  r = r.replace(/ة/g, "ه");
  // Waw with hamza → waw
  r = r.replace(/ؤ/g, "و");
  // Ya with hamza → ya
  r = r.replace(/ئ/g, "ي");
  // Quranic small letters
  r = r.replace(/\u06E5/g, "و").replace(/\u06E6/g, "ي");
  // Standalone hamza — drop
  r = r.replace(/ء/g, "");
  // Anything outside Arabic block — drop
  r = r.replace(/[^\u0600-\u06FF\s]/g, "");
  // Collapse repeated mada (long vowels)
  r = r.replace(/ا+/g, "ا").replace(/و+/g, "و").replace(/ي+/g, "ي");
  return r.trim();
}

// Quranic pause marks, sajda marks, and verse-end glyphs — these tokens are
// not real words and should be skipped when iterating expected words.
export const SKIP_CHARS = /^[\u06D6-\u06ED\u0600-\u0605\u061B\u061E\u061F\u06DD\u06DE\u06DF]+$/;

// True if any token in `heardWord` could plausibly match `expectedWord`.
// Both inputs should already be stripTashkeel-normalized.
function isSubsequence(short: string, long: string): boolean {
  let i = 0;
  for (const c of long) {
    if (c === short[i]) i++;
    if (i === short.length) return true;
  }
  return short.length === 0;
}

const stripNW = (w: string): string => w.replace(/[نو]/g, "");

// Multi-predicate match. Returns true if heard word looks like expected word
// across any of: equality, substring (either direction), subsequence (either
// direction), noun-vowel-stripped equality, or word-final ت→ه swap.
// `lastMatched` prevents re-matching the same word from a growing partial
// transcript — pass the previously-matched normalized heard word, or "" for none.
export function wordMatches(
  heardNorm: string,
  expectedNorm: string,
  lastMatched: string,
): boolean {
  if (!heardNorm || !expectedNorm) return false;
  // Reject 1-char matches unless equal — too noisy
  if (heardNorm.length === 1 && heardNorm !== expectedNorm) return false;
  // Already counted this exact word
  if (heardNorm === lastMatched) return false;

  if (
    heardNorm === expectedNorm ||
    heardNorm.includes(expectedNorm) ||
    expectedNorm.includes(heardNorm) ||
    isSubsequence(heardNorm, expectedNorm) ||
    isSubsequence(expectedNorm, heardNorm)
  ) return true;

  const hStripped = stripNW(heardNorm);
  const eStripped = stripNW(expectedNorm);
  if (hStripped.length > 0 && eStripped.length > 0 && hStripped === eStripped) return true;

  // Word-final ت → ه (handles Uthmani نعمت vs spoken نعمة)
  const hT = heardNorm.replace(/ت$/, "ه");
  const eT = expectedNorm.replace(/ت$/, "ه");
  return hT === eT || hT.includes(eT) || eT.includes(hT);
}

// Strip leading "ال" if doing so leaves a meaningful root (≥2 chars).
// iOS commonly drops the "al-" prefix when recognizing.
export function stripAlPrefix(w: string): string {
  if (w.startsWith("ال") && w.length - 2 >= 2) return w.slice(2);
  return w;
}

// Tokenize a normalized transcript into Arabic-letter runs.
export function tokenize(s: string): string[] {
  return s.match(/[\u0600-\u06FF]+/g) ?? [];
}
