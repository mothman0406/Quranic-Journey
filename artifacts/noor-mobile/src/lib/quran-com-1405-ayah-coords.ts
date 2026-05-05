// Per-page ayah rectangle data extracted from QuranEngine's hafs_1405 ayahinfo_1920.db.
// Rect coordinates are pixel-absolute in the native 1920x3106 page image space.
// Dev validation: bundled glyph data should span all 6,236 ayahs across 604 pages.

import ayahInfoJson from "../../assets/mushaf-pages/quran-com-1405/ayahinfo_1920.json";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
  TOTAL_QURAN_COM_1405_PAGES,
} from "./quran-com-1405-page-images";
import { fetchAyahWithWords } from "./quran";

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
const audioToGlyphPositionMapCache = new Map<string, Promise<number[] | null>>();

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

function getLikelyReciteableGlyphPositions(
  surah: number,
  ayah: number,
  reciteableWordCount: number,
): number[] | null {
  const glyphs = getQuranCom1405GlyphRectsForVerse(surah, ayah);
  if (glyphs.length === 0) return null;

  // QuranEngine stores waqf marks as tiny or negative-width glyph rects.
  // The final remaining glyph is the ayah marker, so the first N word-like
  // positions are the reciteable words in audio/display order.
  const wordLikeGlyphs = glyphs.filter((glyph) => {
    const [_glyphId, _line, _surah, _ayah, _position, minX, maxX] = glyph;
    return maxX - minX > MIN_WORD_HIT_WIDTH_PX;
  });
  if (wordLikeGlyphs.length < reciteableWordCount) return null;

  return wordLikeGlyphs.slice(0, reciteableWordCount).map((glyph) => glyph[4]);
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
    const reciteableWordCount = verse.words.filter(
      (word) => word.char_type_name === "word",
    ).length;
    if (reciteableWordCount <= 0) return null;

    return getLikelyReciteableGlyphPositions(surah, ayah, reciteableWordCount);
  })().catch(() => null);

  audioToGlyphPositionMapCache.set(verseKey, promise);
  return promise;
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
