/**
 * quran-meta.ts
 * Complete static lookup tables for the Medina Mushaf (Hafs 'an 'Asim, 15-line layout).
 * No external API calls — all data is embedded here.
 */
import { db } from "@workspace/db";
import { quranVersesTable } from "@workspace/db/schema";
import {
  PAGE_TO_FIRST_VERSE_GENERATED,
  SURAH_START_PAGES_GENERATED,
} from "./generated-mushaf-tables.js";

export interface VerseRef {
  surah: number;
  ayah: number;
}

export interface PageTargetResult {
  endSurah: number;
  endAyah: number;
  actualPages: number;
  snapReason: 'surah_end' | 'juz' | 'hizb_quarter' | 'page_end' | 'verse_split';
}

// ─── Surah verse counts (114 surahs, index 0 = Surah 1) ──────────────────────
export const SURAH_VERSE_COUNTS: number[] = [
  7,286,200,176,120,165,206,75,129,109,
  123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,
  28,28,20,56,40,31,50,40,46,42,
  29,19,36,25,22,17,19,26,30,20,
  15,21,11,8,8,19,5,8,8,11,
  11,8,3,9,5,4,7,3,6,3,
  5,4,5,6,5,8,3,3,6,3,
];
SURAH_VERSE_COUNTS.length = 114;

// ─── Page to first verse (604 pages, index 0 = page 1) ───────────────────────
export const PAGE_TO_FIRST_VERSE: VerseRef[] = PAGE_TO_FIRST_VERSE_GENERATED.map(
  (verse) => ({ surah: verse.surah, ayah: verse.ayah }),
);

// ─── Surah start pages (index 0 = Surah 1) ────────────────────────────────────
export const SURAH_START_PAGES: number[] = [...SURAH_START_PAGES_GENERATED];

// ─── Juz boundaries (30 juz, index 0 = Juz 1) ────────────────────────────────
export const JUZ_STARTS: VerseRef[] = [
  {surah:1,ayah:1},{surah:2,ayah:142},{surah:2,ayah:253},{surah:3,ayah:93},{surah:4,ayah:24},
  {surah:4,ayah:148},{surah:5,ayah:82},{surah:6,ayah:111},{surah:7,ayah:88},{surah:8,ayah:41},
  {surah:9,ayah:93},{surah:11,ayah:6},{surah:12,ayah:53},{surah:15,ayah:1},{surah:17,ayah:1},
  {surah:18,ayah:75},{surah:21,ayah:1},{surah:23,ayah:1},{surah:25,ayah:21},{surah:27,ayah:56},
  {surah:29,ayah:46},{surah:33,ayah:31},{surah:36,ayah:28},{surah:39,ayah:32},{surah:41,ayah:47},
  {surah:46,ayah:1},{surah:51,ayah:31},{surah:58,ayah:1},{surah:67,ayah:1},{surah:78,ayah:1},
];

// ─── Hizb quarter boundaries (240 quarters = 60 hizb × 4) ────────────────────
export const HIZB_QUARTER_STARTS: VerseRef[] = [
  {surah:1,ayah:1},{surah:2,ayah:25},{surah:2,ayah:38},{surah:2,ayah:50},
  {surah:2,ayah:60},{surah:2,ayah:75},{surah:2,ayah:92},{surah:2,ayah:106},
  {surah:2,ayah:121},{surah:2,ayah:135},{surah:2,ayah:148},{surah:2,ayah:160},
  {surah:2,ayah:169},{surah:2,ayah:182},{surah:2,ayah:191},{surah:2,ayah:202},
  {surah:2,ayah:211},{surah:2,ayah:224},{surah:2,ayah:234},{surah:2,ayah:246},
  {surah:2,ayah:254},{surah:2,ayah:263},{surah:2,ayah:272},{surah:2,ayah:283},
  {surah:3,ayah:1},{surah:3,ayah:15},{surah:3,ayah:26},{surah:3,ayah:38},
  {surah:3,ayah:52},{surah:3,ayah:64},{surah:3,ayah:77},{surah:3,ayah:93},
  {surah:3,ayah:102},{surah:3,ayah:114},{surah:3,ayah:133},{surah:3,ayah:152},
  {surah:3,ayah:171},{surah:3,ayah:186},{surah:4,ayah:1},{surah:4,ayah:12},
  {surah:4,ayah:24},{surah:4,ayah:36},{surah:4,ayah:48},{surah:4,ayah:59},
  {surah:4,ayah:72},{surah:4,ayah:88},{surah:4,ayah:100},{surah:4,ayah:114},
  {surah:4,ayah:128},{surah:4,ayah:141},{surah:4,ayah:155},{surah:4,ayah:170},
  {surah:5,ayah:1},{surah:5,ayah:13},{surah:5,ayah:28},{surah:5,ayah:41},
  {surah:5,ayah:53},{surah:5,ayah:66},{surah:5,ayah:82},{surah:5,ayah:96},
  {surah:5,ayah:109},{surah:6,ayah:1},{surah:6,ayah:20},{surah:6,ayah:35},
  {surah:6,ayah:53},{surah:6,ayah:70},{surah:6,ayah:91},{surah:6,ayah:111},
  {surah:6,ayah:125},{surah:6,ayah:141},{surah:6,ayah:152},{surah:6,ayah:161},
  {surah:7,ayah:1},{surah:7,ayah:28},{surah:7,ayah:47},{surah:7,ayah:66},
  {surah:7,ayah:88},{surah:7,ayah:110},{surah:7,ayah:128},{surah:7,ayah:148},
  {surah:7,ayah:168},{surah:7,ayah:186},{surah:7,ayah:196},{surah:8,ayah:1},
  {surah:8,ayah:25},{surah:8,ayah:41},{surah:8,ayah:54},{surah:8,ayah:68},
  {surah:9,ayah:1},{surah:9,ayah:21},{surah:9,ayah:38},{surah:9,ayah:58},
  {surah:9,ayah:75},{surah:9,ayah:93},{surah:9,ayah:111},{surah:9,ayah:122},
  {surah:10,ayah:1},{surah:10,ayah:26},{surah:10,ayah:53},{surah:10,ayah:72},
  {surah:10,ayah:90},{surah:11,ayah:6},{surah:11,ayah:24},{surah:11,ayah:43},
  {surah:11,ayah:62},{surah:11,ayah:84},{surah:11,ayah:107},{surah:12,ayah:7},
  {surah:12,ayah:30},{surah:12,ayah:53},{surah:12,ayah:77},{surah:12,ayah:101},
  {surah:13,ayah:1},{surah:13,ayah:19},{surah:14,ayah:1},{surah:14,ayah:22},
  {surah:15,ayah:1},{surah:15,ayah:50},{surah:16,ayah:1},{surah:16,ayah:33},
  {surah:16,ayah:72},{surah:16,ayah:100},{surah:17,ayah:1},{surah:17,ayah:27},
  {surah:17,ayah:56},{surah:17,ayah:80},{surah:18,ayah:1},{surah:18,ayah:29},
  {surah:18,ayah:54},{surah:18,ayah:75},{surah:18,ayah:99},{surah:19,ayah:22},
  {surah:19,ayah:52},{surah:20,ayah:1},{surah:20,ayah:52},{surah:20,ayah:99},
  {surah:21,ayah:1},{surah:21,ayah:29},{surah:21,ayah:57},{surah:21,ayah:83},
  {surah:22,ayah:1},{surah:22,ayah:25},{surah:22,ayah:47},{surah:22,ayah:66},
  {surah:23,ayah:1},{surah:23,ayah:36},{surah:23,ayah:75},{surah:24,ayah:1},
  {surah:24,ayah:21},{surah:24,ayah:37},{surah:24,ayah:55},{surah:25,ayah:1},
  {surah:25,ayah:22},{surah:25,ayah:47},{surah:26,ayah:1},{surah:26,ayah:52},
  {surah:26,ayah:112},{surah:26,ayah:175},{surah:27,ayah:16},{surah:27,ayah:56},
  {surah:27,ayah:82},{surah:28,ayah:22},{surah:28,ayah:52},{surah:29,ayah:1},
  {surah:29,ayah:26},{surah:29,ayah:46},{surah:30,ayah:12},{surah:30,ayah:41},
  {surah:31,ayah:1},{surah:31,ayah:22},{surah:32,ayah:12},{surah:33,ayah:1},
  {surah:33,ayah:24},{surah:33,ayah:51},{surah:34,ayah:8},{surah:34,ayah:31},
  {surah:35,ayah:1},{surah:35,ayah:24},{surah:36,ayah:14},{surah:36,ayah:41},
  {surah:37,ayah:1},{surah:37,ayah:62},{surah:37,ayah:122},{surah:38,ayah:1},
  {surah:38,ayah:37},{surah:39,ayah:8},{surah:39,ayah:32},{surah:39,ayah:64},
  {surah:40,ayah:22},{surah:40,ayah:51},{surah:41,ayah:9},{surah:41,ayah:38},
  {surah:42,ayah:1},{surah:42,ayah:27},{surah:43,ayah:1},{surah:43,ayah:46},
  {surah:44,ayah:1},{surah:45,ayah:1},{surah:45,ayah:23},{surah:46,ayah:11},
  {surah:47,ayah:1},{surah:47,ayah:21},{surah:48,ayah:11},{surah:49,ayah:1},
  {surah:49,ayah:12},{surah:50,ayah:16},{surah:51,ayah:1},{surah:51,ayah:31},
  {surah:52,ayah:1},{surah:52,ayah:33},{surah:53,ayah:24},{surah:54,ayah:1},
  {surah:54,ayah:33},{surah:55,ayah:24},{surah:56,ayah:1},{surah:56,ayah:52},
  {surah:57,ayah:1},{surah:57,ayah:22},{surah:58,ayah:10},{surah:59,ayah:1},
  {surah:59,ayah:16},{surah:61,ayah:1},{surah:62,ayah:7},{surah:64,ayah:1},
  {surah:65,ayah:1},{surah:66,ayah:1},{surah:67,ayah:1},{surah:68,ayah:1},
  {surah:69,ayah:1},{surah:70,ayah:16},{surah:72,ayah:1},{surah:73,ayah:1},
  {surah:74,ayah:1},{surah:75,ayah:1},{surah:76,ayah:1},{surah:77,ayah:1},
  {surah:78,ayah:1},{surah:80,ayah:1},{surah:82,ayah:1},{surah:85,ayah:1},
];

// ─── DB-backed verse→page cache ───────────────────────────────────────────────

export const versePageCache = new Map<string, number>();
export const pageLastVerseCache = new Map<number, VerseRef>();
let cacheLoaded = false;

export async function ensureVersePageCache(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const rows = await db.select({
      surahNumber: quranVersesTable.surahNumber,
      ayahNumber: quranVersesTable.ayahNumber,
      pageNumber: quranVersesTable.pageNumber,
    }).from(quranVersesTable);
    for (const row of rows) {
      versePageCache.set(`${row.surahNumber}:${row.ayahNumber}`, row.pageNumber);
    }
    console.log(`[quran-meta] Loaded ${versePageCache.size} verse→page mappings from DB`);
    for (const [key, page] of versePageCache) {
      const [s, a] = key.split(":").map(Number);
      const existing = pageLastVerseCache.get(page);
      if (!existing || s > existing.surah || (s === existing.surah && a > existing.ayah)) {
        pageLastVerseCache.set(page, { surah: s, ayah: a });
      }
    }
    console.log(`[quran-meta] Built page→lastVerse map for ${pageLastVerseCache.size} pages`);
  } catch (err) {
    console.error("[quran-meta] Failed to load verse page cache from DB:", err);
  }
}

// ─── Helper functions ─────────────────────────────────────────────────────────

export function compareVerseRefs(a: VerseRef, b: VerseRef): number {
  if (a.surah !== b.surah) return a.surah - b.surah;
  return a.ayah - b.ayah;
}

export function lastAyahOfSurah(surah: number): number {
  return SURAH_VERSE_COUNTS[surah - 1] ?? 0;
}

export function nextVerse(surah: number, ayah: number): VerseRef | null {
  const count = SURAH_VERSE_COUNTS[surah - 1];
  if (!count) return null;
  if (ayah < count) return { surah, ayah: ayah + 1 };
  if (surah < 114) return { surah: surah + 1, ayah: 1 };
  return null;
}

/** Get the page number (1-indexed) that contains surah:ayah */
export function getPageForVerse(surah: number, ayah: number): number {
  if (surah < 1 || surah > 114) return 1;

  const surahStartPage = SURAH_START_PAGES[surah - 1] ?? 1;

  if (versePageCache.size > 0) {
    for (let a = ayah; a >= 1; a--) {
      const p = versePageCache.get(`${surah}:${a}`);
      if (p !== undefined) return p;
    }
  }

  // Static fallback (before cache loads)
  if (ayah <= 1) return surahStartPage ?? 1;
  let lo = 0, hi = PAGE_TO_FIRST_VERSE.length - 1, result = surahStartPage ?? 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = PAGE_TO_FIRST_VERSE[mid];
    if (v.surah < surah || (v.surah === surah && v.ayah <= ayah)) { result = mid + 1; lo = mid + 1; }
    else hi = mid - 1;
  }
  return Math.max(result, surahStartPage ?? 1);
}

/**
 * Returns the fractional page position of a verse.
 * atEnd=false → start of the verse slot; atEnd=true → end of the verse slot.
 * Allows sub-page precision when multiple surah ends share the same integer page.
 */
function getFractionalPage(surah: number, ayah: number, atEnd = false): number {
  const intPage = getPageForVerse(surah, ayah);
  let pageStart = PAGE_TO_FIRST_VERSE[intPage - 1];
  if (versePageCache.size > 0) {
    let firstFromCache: VerseRef | null = null;
    for (const [key, page] of versePageCache) {
      if (page !== intPage) continue;
      const [s, a] = key.split(":").map(Number);
      if (!firstFromCache || s < firstFromCache.surah || (s === firstFromCache.surah && a < firstFromCache.ayah)) {
        firstFromCache = { surah: s, ayah: a };
      }
    }
    pageStart = firstFromCache ?? pageStart;
  }
  if (!pageStart) return atEnd ? intPage + 1 : intPage;

  let idx = -1;
  let total = 0;
  let cur: VerseRef = { surah: pageStart.surah, ayah: pageStart.ayah };

  for (let i = 0; i < 300; i++) {
    if (cur.surah === surah && cur.ayah === ayah) idx = total;
    total++;
    const n = nextVerse(cur.surah, cur.ayah);
    if (!n || getPageForVerse(n.surah, n.ayah) > intPage) break;
    cur = n;
  }

  if (idx < 0 || total === 0) return atEnd ? intPage + 1 : intPage;
  return intPage + (atEnd ? idx + 1 : idx) / total;
}

/**
 * Given a start position and page budget, find the best stopping point.
 * Priority: surah_end > juz > hizb_quarter > page_end > verse_split
 */
export function resolvePageTarget(
  startSurah: number,
  startAyah: number,
  pagesTarget: number
): PageTargetResult {
  const startPage = getPageForVerse(startSurah, startAyah);
  const targetPage = startPage + pagesTarget;
  const hardStopPage = startPage + pagesTarget * 1.05;

  type Candidate = VerseRef & { reason: PageTargetResult['snapReason']; page: number };
  const candidates: Candidate[] = [];
  const start: VerseRef = { surah: startSurah, ayah: startAyah };

  // Surah ends within budget — only snap to surah end if it fits within targetPage (no overshoot for surah ends)
  for (let s = startSurah; s <= 114; s++) {
    const lastAyah = SURAH_VERSE_COUNTS[s - 1];
    const endRef: VerseRef = { surah: s, ayah: lastAyah };
    if (compareVerseRefs(endRef, start) <= 0) continue;
    const endPage = getPageForVerse(s, lastAyah);
    if (endPage > hardStopPage) break;
    if (endPage < targetPage) {
      candidates.push({ ...endRef, reason: 'surah_end', page: endPage });
    }
  }

  // Juz boundaries
  for (const juz of JUZ_STARTS) {
    if (compareVerseRefs(juz, start) <= 0) continue;
    const p = getPageForVerse(juz.surah, juz.ayah);
    if (p > hardStopPage) break;
    candidates.push({ ...juz, reason: 'juz', page: p });
  }

  // Hizb quarter boundaries
  for (const hq of HIZB_QUARTER_STARTS) {
    if (compareVerseRefs(hq, start) <= 0) continue;
    const p = getPageForVerse(hq.surah, hq.ayah);
    if (p > hardStopPage) break;
    candidates.push({ ...hq, reason: 'hizb_quarter', page: p });
  }

  // Page ends — use DB-backed reverse map if available, fall back to static array
  const lastFullPage = Math.floor(targetPage) - 1;
  for (let p = startPage; p <= Math.min(lastFullPage, 604); p++) {
    let ref: VerseRef | null = null;
    if (pageLastVerseCache.size > 0) {
      ref = pageLastVerseCache.get(p) ?? null;
    } else {
      const nextIdx = p;
      if (nextIdx < PAGE_TO_FIRST_VERSE.length) {
        const nf = PAGE_TO_FIRST_VERSE[nextIdx];
        let es = nf.surah;
        let ea = nf.ayah - 1;
        if (ea < 1) { es -= 1; ea = SURAH_VERSE_COUNTS[es - 1] ?? 1; }
        ref = { surah: es, ayah: ea };
      }
    }
    if (ref && compareVerseRefs(ref, start) > 0) {
      candidates.push({ ...ref, reason: 'page_end', page: p });
    }
  }

  if (candidates.length > 0) {
    const PRIORITY: Record<PageTargetResult['snapReason'], number> = {
      surah_end: 0, juz: 1, hizb_quarter: 2, page_end: 3, verse_split: 4,
    };
    const startFrac = getFractionalPage(startSurah, startAyah);
    const targetFrac = startFrac + pagesTarget;
    candidates.sort((a, b) => {
      const dp = PRIORITY[a.reason] - PRIORITY[b.reason];
      if (dp !== 0) return dp;
      const aFrac = getFractionalPage(a.surah, a.ayah, true);
      const bFrac = getFractionalPage(b.surah, b.ayah, true);
      return Math.abs(aFrac - targetFrac) - Math.abs(bFrac - targetFrac);
    });
    const best = candidates[0];
    const bestFrac = getFractionalPage(best.surah, best.ayah, true);
    return {
      endSurah: best.surah,
      endAyah: best.ayah,
      actualPages: Math.max(0, bestFrac - startFrac),
      snapReason: best.reason,
    };
  }

  // Fallback: split verses of start page in half
  const pfv = versePageCache.size > 0
    ? (() => {
        let first: VerseRef | null = null;
        for (const [key, page] of versePageCache) {
          if (page === startPage) {
            const [s, a] = key.split(":").map(Number);
            if (!first || s < first.surah || (s === first.surah && a < first.ayah)) {
              first = { surah: s, ayah: a };
            }
          }
        }
        return first ?? PAGE_TO_FIRST_VERSE[startPage - 1];
      })()
    : PAGE_TO_FIRST_VERSE[startPage - 1];

  const pageVerses: VerseRef[] = [];
  let cur: VerseRef = { surah: pfv.surah, ayah: pfv.ayah };
  const endOfPage: VerseRef = pageLastVerseCache.size > 0
    ? (pageLastVerseCache.get(startPage) ?? { surah: 114, ayah: 6 })
    : startPage < 604
      ? (() => {
          const nf = PAGE_TO_FIRST_VERSE[startPage];
          let es = nf.surah; let ea = nf.ayah - 1;
          if (ea < 1) { es -= 1; ea = SURAH_VERSE_COUNTS[es - 1] ?? 1; }
          return { surah: es, ayah: ea };
        })()
      : { surah: 114, ayah: 6 };
  for (let i = 0; i < 50; i++) {
    pageVerses.push({ ...cur });
    if (compareVerseRefs(cur, endOfPage) >= 0) break;
    const n = nextVerse(cur.surah, cur.ayah);
    if (!n) break;
    cur = n;
  }
  const mid = pageVerses[Math.floor(pageVerses.length / 2)] ?? start;
  const final = compareVerseRefs(mid, start) > 0 ? mid : (pageVerses[pageVerses.length - 1] ?? start);
  return { endSurah: final.surah, endAyah: final.ayah, actualPages: 0.5, snapReason: 'verse_split' };
}

export function resolveSurahScopedPageTarget(
  startSurah: number,
  startAyah: number,
  pagesTarget: number
): PageTargetResult {
  const startPage = getPageForVerse(startSurah, startAyah);
  const targetPage = startPage + pagesTarget;
  const hardStopPage = startPage + pagesTarget * 1.05;
  const lastAyah = SURAH_VERSE_COUNTS[startSurah - 1];

  type Candidate = VerseRef & { reason: PageTargetResult['snapReason']; page: number };
  const candidates: Candidate[] = [];
  const start: VerseRef = { surah: startSurah, ayah: startAyah };
  const endRef: VerseRef = { surah: startSurah, ayah: lastAyah };

  if (compareVerseRefs(endRef, start) > 0) {
    const endPage = getPageForVerse(startSurah, lastAyah);
    if (endPage <= hardStopPage && endPage < targetPage) {
      candidates.push({ ...endRef, reason: 'surah_end', page: endPage });
    }
  }

  for (const juz of JUZ_STARTS) {
    if (juz.surah !== startSurah || compareVerseRefs(juz, start) <= 0) continue;
    const p = getPageForVerse(juz.surah, juz.ayah);
    if (p > hardStopPage) break;
    candidates.push({ ...juz, reason: 'juz', page: p });
  }

  for (const hq of HIZB_QUARTER_STARTS) {
    if (hq.surah !== startSurah || compareVerseRefs(hq, start) <= 0) continue;
    const p = getPageForVerse(hq.surah, hq.ayah);
    if (p > hardStopPage) break;
    candidates.push({ ...hq, reason: 'hizb_quarter', page: p });
  }

  const lastFullPage = Math.floor(targetPage) - 1;
  for (let p = startPage; p <= Math.min(lastFullPage, 604); p++) {
    let ref: VerseRef | null = null;
    if (pageLastVerseCache.size > 0) {
      ref = pageLastVerseCache.get(p) ?? null;
    } else {
      const nextIdx = p;
      if (nextIdx < PAGE_TO_FIRST_VERSE.length) {
        const nf = PAGE_TO_FIRST_VERSE[nextIdx];
        let es = nf.surah;
        let ea = nf.ayah - 1;
        if (ea < 1) { es -= 1; ea = SURAH_VERSE_COUNTS[es - 1] ?? 1; }
        ref = { surah: es, ayah: ea };
      }
    }
    if (ref && ref.surah === startSurah && compareVerseRefs(ref, start) > 0) {
      candidates.push({ ...ref, reason: 'page_end', page: p });
    }
  }

  if (candidates.length > 0) {
    const PRIORITY: Record<PageTargetResult['snapReason'], number> = {
      surah_end: 0, juz: 1, hizb_quarter: 2, page_end: 3, verse_split: 4,
    };
    const startFrac = getFractionalPage(startSurah, startAyah);
    const targetFrac = startFrac + pagesTarget;
    candidates.sort((a, b) => {
      const dp = PRIORITY[a.reason] - PRIORITY[b.reason];
      if (dp !== 0) return dp;
      const aFrac = getFractionalPage(a.surah, a.ayah, true);
      const bFrac = getFractionalPage(b.surah, b.ayah, true);
      return Math.abs(aFrac - targetFrac) - Math.abs(bFrac - targetFrac);
    });
    const best = candidates[0];
    const bestFrac = getFractionalPage(best.surah, best.ayah, true);
    return {
      endSurah: best.surah,
      endAyah: best.ayah,
      actualPages: Math.max(0, bestFrac - startFrac),
      snapReason: best.reason,
    };
  }

  const pfv = versePageCache.size > 0
    ? (() => {
        let first: VerseRef | null = null;
        for (const [key, page] of versePageCache) {
          if (page === startPage) {
            const [s, a] = key.split(":").map(Number);
            if (!first || s < first.surah || (s === first.surah && a < first.ayah)) {
              first = { surah: s, ayah: a };
            }
          }
        }
        return first ?? PAGE_TO_FIRST_VERSE[startPage - 1];
      })()
    : PAGE_TO_FIRST_VERSE[startPage - 1];

  const pageVerses: VerseRef[] = [];
  let cur: VerseRef = { surah: Math.max(pfv.surah, startSurah), ayah: pfv.surah === startSurah ? pfv.ayah : 1 };
  const endOfPage: VerseRef = pageLastVerseCache.size > 0
    ? (pageLastVerseCache.get(startPage) ?? endRef)
    : startPage < 604
      ? (() => {
          const nf = PAGE_TO_FIRST_VERSE[startPage];
          let es = nf.surah; let ea = nf.ayah - 1;
          if (ea < 1) { es -= 1; ea = SURAH_VERSE_COUNTS[es - 1] ?? 1; }
          return { surah: es, ayah: ea };
        })()
      : endRef;

  for (let i = 0; i < 50; i++) {
    if (cur.surah !== startSurah || compareVerseRefs(cur, endRef) > 0) break;
    pageVerses.push({ ...cur });
    if (compareVerseRefs(cur, endOfPage) >= 0) break;
    const n = nextVerse(cur.surah, cur.ayah);
    if (!n) break;
    cur = n;
  }

  const mid = pageVerses[Math.floor(pageVerses.length / 2)] ?? endRef;
  const final = compareVerseRefs(mid, start) > 0 ? mid : (pageVerses[pageVerses.length - 1] ?? endRef);
  return { endSurah: startSurah, endAyah: final.ayah, actualPages: 0.5, snapReason: 'verse_split' };
}

export function resolveStrictSurahScopedPageTarget(
  startSurah: number,
  startAyah: number,
  pagesTarget: number,
): PageTargetResult {
  const safePagesTarget = Math.max(pagesTarget, 0.25);
  const start: VerseRef = { surah: startSurah, ayah: startAyah };
  const lastAyah = SURAH_VERSE_COUNTS[startSurah - 1];
  const surahEnd: VerseRef = { surah: startSurah, ayah: lastAyah };
  const startFrac = getFractionalPage(startSurah, startAyah);
  const targetFrac = startFrac + safePagesTarget;
  const surahEndFrac = getFractionalPage(startSurah, lastAyah, true);

  if (surahEndFrac <= targetFrac + 1e-9) {
    return {
      endSurah: startSurah,
      endAyah: lastAyah,
      actualPages: Math.max(0, surahEndFrac - startFrac),
      snapReason: "surah_end",
    };
  }

  const startPage = getPageForVerse(startSurah, startAyah);
  let bestPageEnd: VerseRef | null = null;
  let bestPageEndFrac = -Infinity;

  for (let page = startPage; page <= 604; page += 1) {
    let pageEnd: VerseRef | null = null;
    if (pageLastVerseCache.size > 0) {
      pageEnd = pageLastVerseCache.get(page) ?? null;
    } else if (page < 604) {
      const nextFirstVerse = PAGE_TO_FIRST_VERSE[page];
      let endSurah = nextFirstVerse.surah;
      let endAyah = nextFirstVerse.ayah - 1;
      if (endAyah < 1) {
        endSurah -= 1;
        endAyah = SURAH_VERSE_COUNTS[endSurah - 1] ?? 1;
      }
      pageEnd = { surah: endSurah, ayah: endAyah };
    } else {
      pageEnd = { surah: 114, ayah: 6 };
    }

    if (!pageEnd || pageEnd.surah !== startSurah || compareVerseRefs(pageEnd, start) <= 0) {
      if (pageEnd && pageEnd.surah > startSurah) break;
      continue;
    }

    const endFrac = getFractionalPage(pageEnd.surah, pageEnd.ayah, true);
    if (endFrac <= targetFrac + 1e-9 && endFrac > bestPageEndFrac) {
      bestPageEnd = pageEnd;
      bestPageEndFrac = endFrac;
      continue;
    }

    if (endFrac > targetFrac) break;
  }

  if (bestPageEnd) {
    return {
      endSurah: bestPageEnd.surah,
      endAyah: bestPageEnd.ayah,
      actualPages: Math.max(0, bestPageEndFrac - startFrac),
      snapReason: "page_end",
    };
  }

  let bestVerse = start;
  let bestVerseFrac = getFractionalPage(start.surah, start.ayah, true);
  let current: VerseRef | null = start;

  while (current && current.surah === startSurah) {
    const endFrac = getFractionalPage(current.surah, current.ayah, true);
    if (endFrac > targetFrac + 1e-9) break;
    if (compareVerseRefs(current, start) >= 0) {
      bestVerse = current;
      bestVerseFrac = endFrac;
    }
    current = nextVerse(current.surah, current.ayah);
  }

  return {
    endSurah: startSurah,
    endAyah: bestVerse.ayah,
    actualPages: Math.max(0, bestVerseFrac - startFrac),
    snapReason: "verse_split",
  };
}
