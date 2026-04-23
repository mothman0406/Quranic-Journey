export const BAYAAN_MUSHAF_TEXT =
  '"BayaanDigitalKhatt", "KFGQPC Hafs", "Amiri Quran", serif';
export const BAYAAN_MUSHAF_HEADER =
  '"BayaanSurahQCF", "BayaanDigitalKhatt", "KFGQPC Hafs", serif';
export const BAYAAN_MUSHAF_DIVIDER = '"BayaanQuranCommon", serif';
export const BAYAAN_SURAH_DIVIDER_CHAR = "\uE000";
export const BAYAAN_BASMALLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
export const BAYAAN_PAGE_THEME = {
  screen: "#efe8da",
  screenTint: "#f7f2e7",
  screenText: "#1c1912",
  chromeBorder: "#d8cfbb",
  chromeMuted: "#7d7157",
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

export const BAYAAN_QCF_SURAH_CODEPOINTS = [
  0xfc45, 0xfc46, 0xfc47, 0xfc4a, 0xfc4b, 0xfc4e, 0xfc4f, 0xfc51, 0xfc52,
  0xfc53, 0xfc55, 0xfc56, 0xfc58, 0xfc5a, 0xfc5b, 0xfc5c, 0xfc5d, 0xfc5e,
  0xfc61, 0xfc62, 0xfc64, 0xfb51, 0xfb52, 0xfb54, 0xfb55, 0xfb57, 0xfb58,
  0xfb5a, 0xfb5b, 0xfb5d, 0xfb5e, 0xfb60, 0xfb61, 0xfb63, 0xfb64, 0xfb66,
  0xfb67, 0xfb69, 0xfb6a, 0xfb6c, 0xfb6d, 0xfb6f, 0xfb70, 0xfb72, 0xfb73,
  0xfb75, 0xfb76, 0xfb78, 0xfb79, 0xfb7b, 0xfb7c, 0xfb7e, 0xfb7f, 0xfb81,
  0xfb82, 0xfb84, 0xfb85, 0xfb87, 0xfb88, 0xfb8a, 0xfb8b, 0xfb8d, 0xfb8e,
  0xfb90, 0xfb91, 0xfb93, 0xfb94, 0xfb96, 0xfb97, 0xfb99, 0xfb9a, 0xfb9c,
  0xfb9d, 0xfb9f, 0xfba0, 0xfba2, 0xfba3, 0xfba5, 0xfba6, 0xfba8, 0xfba9,
  0xfbab, 0xfbac, 0xfbae, 0xfbaf, 0xfbb1, 0xfbb2, 0xfbb4, 0xfbb5, 0xfbb7,
  0xfbb8, 0xfbba, 0xfbbb, 0xfbbd, 0xfbbe, 0xfbc0, 0xfbc1, 0xfbd3, 0xfbd4,
  0xfbd6, 0xfbd7, 0xfbd9, 0xfbda, 0xfbdc, 0xfbdd, 0xfbdf, 0xfbe0, 0xfbe2,
  0xfbe3, 0xfbe5, 0xfbe6, 0xfbe8, 0xfbe9, 0xfbeb,
] as const;

export const TAJWEED_CSS = `
@font-face {
  font-family: "BayaanDigitalKhatt";
  src: url("/fonts/bayaan/digital-khatt.otf") format("opentype");
  font-display: swap;
}
@font-face {
  font-family: "BayaanQuranCommon";
  src: url("/fonts/bayaan/quran-common.ttf") format("truetype");
  font-display: swap;
}
@font-face {
  font-family: "BayaanSurahQCF";
  src: url("/fonts/bayaan/surah-name-qcf.ttf") format("truetype");
  font-display: swap;
}
.mushaf-page tajweed {
  color: inherit;
}
.mushaf-page .ham_wasl,
.mushaf-page .slnt,
.mushaf-page .lam_shamsiyya,
.mushaf-page .lam_shamsiyyah { color: #8f7d56; }
.mushaf-page .madda_normal { color: #c2410c; }
.mushaf-page .madda_permissible { color: #ea580c; }
.mushaf-page .madda_necessary,
.mushaf-page .madda_obligatory { color: #dc2626; }
.mushaf-page .qalaqah { color: #16a34a; }
.mushaf-page .ikhafa_shafawi,
.mushaf-page .ikhafa,
.mushaf-page .iqlab { color: #2563eb; }
.mushaf-page .idgham_ghunna,
.mushaf-page .idgham_ghunnah,
.mushaf-page .ghunna,
.mushaf-page .ghunnah { color: #7c3aed; }
.mushaf-page .idgham_wo_ghunna,
.mushaf-page .idgham_wo_ghunnah,
.mushaf-page .idgham_mutajanisayn,
.mushaf-page .idgham_mutaqaribain,
.mushaf-page .idgham_shafawi { color: #0f766e; }
`;

export function getJuzForPage(pageNumber: number): number {
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i -= 1) {
    if (pageNumber >= JUZ_START_PAGES[i]) return i + 1;
  }
  return 1;
}

export function getBayaanSurahGlyph(surahNumber: number): string {
  const codepoint = BAYAAN_QCF_SURAH_CODEPOINTS[surahNumber - 1];
  return codepoint ? String.fromCodePoint(codepoint) : "";
}
