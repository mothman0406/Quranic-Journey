// Parchment color palettes — ported and expanded from noor-path quran-memorize.tsx.
// Do not import from @workspace/noor-path.

export type ThemeKey =
  | "madinah_day"
  | "ottoman_day"
  | "modern_day"
  | "classic_day"
  | "madinah_night"
  | "ottoman_night"
  | "modern_night"
  | "classic_night";

export type MushafTheme = {
  page: string;
  pageEdge: string;
  pageBorder: string;
  pageRule: string;
  pageLabel: string;
  pageText: string;
  pageMuted: string;
  markerBorder: string;
  markerText: string;
  markerSurface: string;
  activeHighlight: string;
  activeMarker: string;
  activeMarkerBg: string;
};

export const THEMES: Record<ThemeKey, MushafTheme> = {
  madinah_day: {
    // Original MUSHAF_PAGE_THEME — Madinah teal banner, warm parchment
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
  },
  ottoman_day: {
    // Ottoman maroon banner, amber-gold accent, warmer parchment
    page: "#fdf0e0",
    pageEdge: "#f2e4c8",
    pageBorder: "#d4a843",
    pageRule: "#d4a843",
    pageLabel: "#8f7d56",
    pageText: "#1f1a13",
    pageMuted: "#b09570",
    markerBorder: "#d4a843",
    markerText: "#86621a",
    markerSurface: "#fffaf0",
    activeHighlight: "rgba(212, 168, 67, 0.18)",
    activeMarker: "#9a7020",
    activeMarkerBg: "rgba(212, 168, 67, 0.24)",
  },
  modern_day: {
    // Modern navy banner, silver-blue accent, clean off-white parchment
    page: "#f8f6f2",
    pageEdge: "#ece8e0",
    pageBorder: "#a8b8c8",
    pageRule: "#a8b8c8",
    pageLabel: "#8f7d56",
    pageText: "#1f1a13",
    pageMuted: "#9a9898",
    markerBorder: "#a8b8c8",
    markerText: "#5a7088",
    markerSurface: "#fffaf0",
    activeHighlight: "rgba(168, 184, 200, 0.18)",
    activeMarker: "#4a6878",
    activeMarkerBg: "rgba(168, 184, 200, 0.24)",
  },
  classic_day: {
    // Classic forest banner, gold accent, standard parchment
    page: "#fdf6e3",
    pageEdge: "#f0e8c8",
    pageBorder: "#c9a84c",
    pageRule: "#c9a84c",
    pageLabel: "#8f7d56",
    pageText: "#1f1a13",
    pageMuted: "#b0a070",
    markerBorder: "#c9a84c",
    markerText: "#7a6018",
    markerSurface: "#fffaf0",
    activeHighlight: "rgba(201, 168, 76, 0.18)",
    activeMarker: "#8c7028",
    activeMarkerBg: "rgba(201, 168, 76, 0.24)",
  },
  madinah_night: {
    // Deep navy page, gold accent, warm off-white text
    page: "#1a1a2e",
    pageEdge: "#141422",
    pageBorder: "#c9a84c",
    pageRule: "#c9a84c",
    pageLabel: "#c9a84c",
    pageText: "#e8d5b0",
    pageMuted: "#8b7a5e",
    markerBorder: "#c9a84c",
    markerText: "#c9a84c",
    markerSurface: "#4a3e30",
    activeHighlight: "rgba(201, 168, 76, 0.18)",
    activeMarker: "#c9a84c",
    activeMarkerBg: "rgba(201, 168, 76, 0.24)",
  },
  ottoman_night: {
    // Very dark brown page, amber-gold accent, warm off-white text
    page: "#1a1208",
    pageEdge: "#130e06",
    pageBorder: "#d4a843",
    pageRule: "#d4a843",
    pageLabel: "#d4a843",
    pageText: "#e8d5b0",
    pageMuted: "#8b7a58",
    markerBorder: "#d4a843",
    markerText: "#d4a843",
    markerSurface: "#4a3820",
    activeHighlight: "rgba(212, 168, 67, 0.18)",
    activeMarker: "#d4a843",
    activeMarkerBg: "rgba(212, 168, 67, 0.24)",
  },
  modern_night: {
    // Near-black blue page, silver-blue accent, cool off-white text
    page: "#0f0f1a",
    pageEdge: "#0a0a12",
    pageBorder: "#a8b8c8",
    pageRule: "#a8b8c8",
    pageLabel: "#a8b8c8",
    pageText: "#dde8f0",
    pageMuted: "#6a7888",
    markerBorder: "#a8b8c8",
    markerText: "#a8b8c8",
    markerSurface: "#2a3a4a",
    activeHighlight: "rgba(168, 184, 200, 0.18)",
    activeMarker: "#a8b8c8",
    activeMarkerBg: "rgba(168, 184, 200, 0.24)",
  },
  classic_night: {
    // Dark forest green page, gold accent, warm off-white text
    page: "#0d1308",
    pageEdge: "#090e05",
    pageBorder: "#c9a84c",
    pageRule: "#c9a84c",
    pageLabel: "#c9a84c",
    pageText: "#e8d5b0",
    pageMuted: "#7a7258",
    markerBorder: "#c9a84c",
    markerText: "#c9a84c",
    markerSurface: "#3a4028",
    activeHighlight: "rgba(201, 168, 76, 0.18)",
    activeMarker: "#c9a84c",
    activeMarkerBg: "rgba(201, 168, 76, 0.24)",
  },
};

export const DEFAULT_THEME_KEY: ThemeKey = "madinah_day";

export const THEME_DISPLAY_NAMES: Record<ThemeKey, string> = {
  madinah_day: "Madinah",
  ottoman_day: "Ottoman",
  modern_day: "Modern",
  classic_day: "Classic",
  madinah_night: "Madinah Night",
  ottoman_night: "Ottoman Night",
  modern_night: "Modern Night",
  classic_night: "Classic Night",
};

// Re-export for any lingering importers; shape is identical to THEMES.madinah_day.
export const MUSHAF_PAGE_THEME = THEMES.madinah_day;

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
