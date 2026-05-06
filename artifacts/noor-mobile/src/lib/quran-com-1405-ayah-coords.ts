// Per-page ayah rectangle data extracted from QuranEngine's hafs_1405 ayahinfo_1920.db.
// Rect coordinates are pixel-absolute in the native 1920x3106 page image space.
// Dev validation: bundled glyph data should span all 6,236 ayahs across 604 pages.

import ayahInfoJson from "../../assets/mushaf-pages/quran-com-1405/ayahinfo_1920.json";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
  TOTAL_QURAN_COM_1405_PAGES,
} from "./quran-com-1405-page-images";
import { fetchAyahWithWords, type ApiWord } from "./quran";

// Extractor tuple order: [surah, ayah, line, minX, maxX, minY, maxY, glyphCount].
export type QuranCom1405AyahRect = readonly [
  surah: number,
  ayah: number,
  line: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  glyphCount: number,
];

// Per-glyph (per-word) data tuple: [glyphId, line, surah, ayah, position, minX, maxX, minY, maxY]
export type QuranCom1405GlyphRect = readonly [
  glyphId: number,
  line: number,
  surah: number,
  ayah: number,
  position: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
];

// Normalized word rect: [surah, ayah, position, line, minX, maxX, minY, maxY]
export type QuranCom1405WordRect = readonly [
  surah: number,
  ayah: number,
  position: number,
  line: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
];

type QuranCom1405PageCoords = {
  glyphs?: ReadonlyArray<QuranCom1405GlyphRect>;
  ayahRects: ReadonlyArray<QuranCom1405AyahRect>;
};

type QuranCom1405AyahInfo = {
  pages: Record<string, QuranCom1405PageCoords | undefined>;
};

const ayahInfo = ayahInfoJson as unknown as QuranCom1405AyahInfo;
const MIN_WORD_HIT_WIDTH_PX = 24;
const RUB_EL_HIZB_MARK = "۞";
const audioToGlyphPositionMapCache = new Map<string, Promise<number[] | null>>();
let wordPageCache: Map<string, number> | null = null;

export const QURAN_COM_1405_NATIVE_WIDTH = QURAN_COM_1405_PAGE_WIDTH;
export const QURAN_COM_1405_NATIVE_HEIGHT = QURAN_COM_1405_PAGE_HEIGHT;

export function getQuranCom1405AyahRectsForPage(
  pageNumber: number,
): ReadonlyArray<QuranCom1405AyahRect> {
  return ayahInfo.pages[String(pageNumber)]?.ayahRects ?? [];
}

export function getQuranCom1405WordRectsForPage(
  pageNumber: number,
): ReadonlyArray<QuranCom1405WordRect> {
  const rawGlyphs = ayahInfo.pages[String(pageNumber)]?.glyphs;
  if (!rawGlyphs) return [];

  return rawGlyphs.map((glyph) => {
    const [_glyphId, line, surah, ayah, position, rawMinX, rawMaxX, minY, maxY] = glyph;

    let minX = Math.min(rawMinX, rawMaxX);
    let maxX = Math.max(rawMinX, rawMaxX);

    if (maxX - minX < MIN_WORD_HIT_WIDTH_PX) {
      const center = (minX + maxX) / 2;
      minX = center - MIN_WORD_HIT_WIDTH_PX / 2;
      maxX = center + MIN_WORD_HIT_WIDTH_PX / 2;
    }

    return [surah, ayah, position, line, minX, maxX, minY, maxY] as const;
  });
}

function ensureWordPageCache() {
  if (wordPageCache) return;
  const cache = new Map<string, number>();
  for (const [pageStr, pageData] of Object.entries(ayahInfo.pages)) {
    if (!pageData?.glyphs) continue;
    const pageNumber = Number(pageStr);
    if (!Number.isInteger(pageNumber)) continue;
    for (const glyph of pageData.glyphs) {
      const surah = glyph[2];
      const ayah = glyph[3];
      const position = glyph[4];
      const key = `${surah}:${ayah}:${position}`;
      if (!cache.has(key)) {
        cache.set(key, pageNumber);
      }
    }
  }
  wordPageCache = cache;
}

function getQuranCom1405GlyphRectsForVerse(
  surah: number,
  ayah: number,
): QuranCom1405GlyphRect[] {
  const glyphs: QuranCom1405GlyphRect[] = [];

  for (const page of Object.values(ayahInfo.pages)) {
    for (const glyph of page?.glyphs ?? []) {
      if (glyph[2] === surah && glyph[3] === ayah) {
        glyphs.push(glyph);
      }
    }
  }

  return glyphs.sort((a, b) => a[4] - b[4]);
}

function hasRubElHizbMark(word: ApiWord): boolean {
  return word.text_uthmani.includes(RUB_EL_HIZB_MARK);
}

function getLikelyReciteableGlyphPositions(
  surah: number,
  ayah: number,
  reciteableWords: ReadonlyArray<ApiWord>,
): number[] | null {
  const glyphs = getQuranCom1405GlyphRectsForVerse(surah, ayah);
  if (glyphs.length === 0) return null;

  // QuranEngine stores waqf marks as tiny or negative-width glyph rects.
  // It also stores non-recited ornaments with the verse's surah/ayah: ayah
  // markers are usually the final word-like glyph, while Quran.com's `۞`
  // rub-el-hizb marker is split into its own glyph before the marked word.
  // Skip that standalone marker while preserving real same-sized short words.
  const wordLikeGlyphs = glyphs.filter((glyph) => {
    const [_glyphId, _line, _surah, _ayah, _position, minX, maxX] = glyph;
    return maxX - minX > MIN_WORD_HIT_WIDTH_PX;
  });
  if (wordLikeGlyphs.length < reciteableWords.length) return null;

  const markedWordCount = reciteableWords.filter(hasRubElHizbMark).length;
  const canAccountForStandaloneMarks =
    markedWordCount > 0 &&
    wordLikeGlyphs.length >= reciteableWords.length + markedWordCount + 1;

  const positions: number[] = [];
  let glyphIndex = 0;
  for (const word of reciteableWords) {
    if (canAccountForStandaloneMarks && hasRubElHizbMark(word)) {
      glyphIndex += 1;
    }

    const glyph = wordLikeGlyphs[glyphIndex];
    if (!glyph) return null;
    positions.push(glyph[4]);
    glyphIndex += 1;
  }

  return positions;
}

// Maps audio-segment wordIdx (1-based, reciteable-only order) to QPC2 glyph position.
// Returns null if mapping unavailable for this ayah.
export async function getAudioToGlyphPositionMap(
  surah: number,
  ayah: number,
): Promise<number[] | null> {
  const verseKey = `${surah}:${ayah}`;
  const cached = audioToGlyphPositionMapCache.get(verseKey);
  if (cached) return cached;

  const promise = (async () => {
    const verse = await fetchAyahWithWords(verseKey);
    const reciteableWords = verse.words.filter(
      (word) => word.char_type_name === "word",
    );
    if (reciteableWords.length <= 0) return null;

    return getLikelyReciteableGlyphPositions(surah, ayah, reciteableWords);
  })().catch(() => null);

  audioToGlyphPositionMapCache.set(verseKey, promise);
  return promise;
}

export function getQuranCom1405PageForWord(
  surah: number,
  ayah: number,
  position: number,
): number | null {
  ensureWordPageCache();
  return wordPageCache?.get(`${surah}:${ayah}:${position}`) ?? null;
}

export function getQuranCom1405PageForVerse(
  surah: number,
  ayah: number,
): number | null {
  return getQuranCom1405PageForWord(surah, ayah, 1);
}

if (__DEV__) {
  const seenAyahs = new Set<string>();
  const pageNumbers = Object.keys(ayahInfo.pages);

  for (const page of pageNumbers) {
    for (const glyph of ayahInfo.pages[page]?.glyphs ?? []) {
      seenAyahs.add(`${glyph[2]}:${glyph[3]}`);
    }
  }

  if (
    pageNumbers.length !== TOTAL_QURAN_COM_1405_PAGES ||
    seenAyahs.size !== 6236
  ) {
    console.warn(
      `[quran-com-1405] Expected ${TOTAL_QURAN_COM_1405_PAGES} pages and 6236 ayahs; found ${pageNumbers.length} pages and ${seenAyahs.size} ayahs.`,
    );
  }
}
