// Parchment color palette ported from noor-path bayaan-constants.ts.
// Values copied directly — do not import from @workspace/noor-path.
export const MUSHAF_PAGE_THEME = {
  page: "#fffdf8",
  pageEdge: "#f5efe0",
  pageBorder: "#d7ccb2",
  pageRule: "#cdbb8b",
  pageLabel: "#8f7d56",
  pageText: "#1f1a13",
  pageMuted: "#b0a184",
  markerBorder: "#bea15c",
  markerText: "#866622",
  markerSurface: "#fffaf0",
  activeHighlight: "rgba(190, 161, 92, 0.18)",
  activeMarker: "#9c7b31",
  activeMarkerBg: "rgba(190, 161, 92, 0.24)",
} as const;

export const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const;

export function getJuzForPage(pageNumber: number): number {
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i--) {
    if (pageNumber >= JUZ_START_PAGES[i]) return i + 1;
  }
  return 1;
}
