// Per-page ayah rectangle data extracted from QuranEngine's hafs_1405 ayahinfo_1920.db.
// Rect coordinates are pixel-absolute in the native 1920x3106 page image space.

import ayahInfoJson from "../../assets/mushaf-pages/quran-com-1405/ayahinfo_1920.json";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
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

type QuranCom1405PageCoords = {
  ayahRects: ReadonlyArray<QuranCom1405AyahRect>;
};

type QuranCom1405AyahInfo = {
  pages: Record<string, QuranCom1405PageCoords | undefined>;
};

const ayahInfo = ayahInfoJson as unknown as QuranCom1405AyahInfo;

export const QURAN_COM_1405_NATIVE_WIDTH = QURAN_COM_1405_PAGE_WIDTH;
export const QURAN_COM_1405_NATIVE_HEIGHT = QURAN_COM_1405_PAGE_HEIGHT;

export function getQuranCom1405AyahRectsForPage(
  pageNumber: number,
): ReadonlyArray<QuranCom1405AyahRect> {
  return ayahInfo.pages[String(pageNumber)]?.ayahRects ?? [];
}
