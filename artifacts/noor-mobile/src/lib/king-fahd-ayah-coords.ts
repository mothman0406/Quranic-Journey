// Per-page ayah coordinate data from KFGQPC Hafs Mushaf.
// Format: { coordinates: [unused, [...page1Tuples], [...page2Tuples], ...] }
// Each page tuple is [sura, aya, x, y] in the upstream overlay coordinate space.

import ayaJson from "../../assets/mushaf-pages/kfgqpc-hafs/aya.json";
import specsJson from "../../assets/mushaf-pages/kfgqpc-hafs/specs.json";

export type KingFahdAyahCoord = readonly [
  sura: number,
  aya: number,
  x: number,
  y: number,
];

type AyaJson = { coordinates: ReadonlyArray<ReadonlyArray<KingFahdAyahCoord>> };

export type KingFahdPageSpecs = {
  defaultPageHeight: number;
  defaultMarginX: number;
  defaultPageWidth: number;
  defaultMarginY: number;
  defaultLineHeight: number;
  defaultNumberOfPages: number;
  defaultFirstPagesWidth: number;
  defaultFirstPagesMarginX: number;
  defaultFirstPagesMarginY: number;
  countBesmalAya: boolean;
};

const coords = ayaJson as unknown as AyaJson;

export const KING_FAHD_PAGE_SPECS = specsJson as KingFahdPageSpecs;

export function getAyahCoordsForPage(
  pageNumber: number,
): ReadonlyArray<KingFahdAyahCoord> {
  return coords.coordinates[pageNumber] ?? [];
}

export const PAGE_NATIVE_WIDTH = 456;
export const PAGE_NATIVE_HEIGHT = 672;
