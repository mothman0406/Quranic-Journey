// Per-page ayah rectangle data extracted from QuranEngine's hafs_1405 ayahinfo_1920.db.
// Rect coordinates are pixel-absolute in the native 1920x3106 page image space.
// Dev validation: bundled glyph data should span all 6,236 ayahs across 604 pages.

import ayahInfoJson from "../../assets/mushaf-pages/quran-com-1405/ayahinfo_1920.json";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
  TOTAL_QURAN_COM_1405_PAGES,
} from "./quran-com-1405-page-images";

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
