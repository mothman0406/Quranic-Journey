import {
  BAYAAN_MUSHAF_DIVIDER,
  BAYAAN_MUSHAF_HEADER,
  BAYAAN_PAGE_THEME,
  BAYAAN_SURAH_DIVIDER_CHAR,
  getBayaanSurahGlyph,
} from "@/components/mushaf/bayaan/bayaan-constants";

export function BayaanSurahBanner({
  surahNumber,
  surahName,
}: {
  surahNumber: number;
  surahName: string;
}) {
  const surahGlyph = getBayaanSurahGlyph(surahNumber);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        margin: "0.22em 0 0.04em",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(100%, 13.4em)",
          minHeight: "1.72em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: BAYAAN_MUSHAF_DIVIDER,
            fontSize: "1.78em",
            lineHeight: 1,
            color: BAYAAN_PAGE_THEME.pageRule,
            pointerEvents: "none",
          }}
        >
          {BAYAAN_SURAH_DIVIDER_CHAR}
        </span>
        <span
          dir="rtl"
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: surahGlyph
              ? BAYAAN_MUSHAF_HEADER
              : '"Scheherazade New", "Amiri Quran", serif',
            fontSize: surahGlyph ? "1.02em" : "0.86em",
            lineHeight: 1,
            color: BAYAAN_PAGE_THEME.pageLabel,
            whiteSpace: "nowrap",
            letterSpacing: 0,
          }}
        >
          {surahGlyph || surahName}
        </span>
      </div>
    </div>
  );
}
