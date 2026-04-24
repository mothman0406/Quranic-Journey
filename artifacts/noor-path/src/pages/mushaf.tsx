import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BayaanMushafPageCard } from "@/components/mushaf/bayaan/BayaanMushafPageCard";
import { BayaanSurahBanner } from "@/components/mushaf/bayaan/BayaanSurahBanner";
import { useBayaanMushafFit } from "@/components/mushaf/bayaan/useBayaanMushafFit";
import {
  BAYAAN_PAGE_THEME,
  TAJWEED_CSS,
} from "@/components/mushaf/bayaan/bayaan-constants";
import { getArabicSurahNamesForPage } from "@/components/mushaf/bayaan/bayaan-utils";

const TOTAL_PAGES = 604;
const QURAN_API = "https://api.quran.com/api/v4";

interface Word {
  id: number;
  position: number;
  text_uthmani: string;
  char_type_name: string;
  page_number: number;
  line_number: number;
}

interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;
  hizb_number: number;
  rub_el_hizb_number: number;
  ruku_number: number;
  manzil_number: number;
  page_number: number;
  juz_number: number;
  text_uthmani: string;
  words: Word[];
}

interface PageData {
  verses: Verse[];
  meta: {
    filters: { page: number };
  };
}

interface LineWord {
  id: number;
  text: string;
  type: "word" | "end";
  verseKey: string;
  verseNumber: number;
}

interface Chapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name: { name: string };
  verses_count: number;
  bismillah_pre: boolean;
  pages: [number, number];
}

interface Juz {
  id: number;
  juz_number: number;
  first_verse_id: number;
  last_verse_id: number;
  verse_mapping: Record<string, string>;
  verses_count: number;
}

async function fetchPage(page: number): Promise<PageData> {
  const r = await fetch(
    `${QURAN_API}/verses/by_page/${page}?words=true&fields=text_uthmani&word_fields=text_uthmani,char_type_name,line_number,page_number`,
  );
  if (!r.ok) throw new Error(`Failed to fetch page ${page}: ${r.status}`);
  return r.json();
}

async function fetchChapters(): Promise<{ chapters: Chapter[] }> {
  const r = await fetch(`${QURAN_API}/chapters?language=en`);
  if (!r.ok) throw new Error(`Failed to fetch chapters: ${r.status}`);
  return r.json();
}

async function fetchJuzs(): Promise<{ juzs: Juz[] }> {
  const r = await fetch(`${QURAN_API}/juzs`);
  if (!r.ok) throw new Error(`Failed to fetch juzs: ${r.status}`);
  return r.json();
}

function buildPageLines(verses: Verse[]): Map<number, LineWord[]> {
  const lines = new Map<number, LineWord[]>();
  for (const verse of verses) {
    for (const word of verse.words) {
      const ln = word.line_number;
      if (!lines.has(ln)) lines.set(ln, []);
      lines.get(ln)!.push({
        id: word.id,
        text: word.text_uthmani,
        type: word.char_type_name === "end" ? "end" : "word",
        verseKey: verse.verse_key,
        verseNumber: verse.verse_number,
      });
    }
  }
  return lines;
}

function getSurahStartLines(verses: Verse[]): Set<number> {
  const surahLines = new Set<number>();
  for (const verse of verses) {
    if (verse.verse_number === 1 && verse.words.length > 0) {
      surahLines.add(verse.words[0].line_number);
    }
  }
  return surahLines;
}

function getSurahForLine(lineNum: number, verses: Verse[]): number | null {
  for (const verse of verses) {
    if (verse.verse_number === 1) {
      const firstWord = verse.words[0];
      if (firstWord && firstWord.line_number === lineNum) {
        return parseInt(verse.verse_key.split(":")[0]);
      }
    }
  }
  return null;
}

const JUZ_START_PAGES: Record<number, number> = {
  1: 1,   2: 22,  3: 42,  4: 62,  5: 82,
  6: 102, 7: 121, 8: 142, 9: 162, 10: 182,
  11: 201, 12: 222, 13: 242, 14: 262, 15: 282,
  16: 302, 17: 322, 18: 342, 19: 362, 20: 382,
  21: 402, 22: 422, 23: 442, 24: 462, 25: 482,
  26: 502, 27: 522, 28: 542, 29: 562, 30: 582,
};

function buildJuzPageMap(juzs: Juz[], chapters: Chapter[]): Map<number, number> {
  const map = new Map<number, number>();
  const chapterMap = new Map(chapters.map((c) => [c.id, c]));
  for (const juz of juzs) {
    const firstSurahStr = Object.keys(juz.verse_mapping)[0];
    if (!firstSurahStr) continue;
    const surahNum = parseInt(firstSurahStr);
    const verseRange = juz.verse_mapping[firstSurahStr];
    const firstVerseNum = parseInt(verseRange.split("-")[0]);
    if (firstVerseNum === 1) {
      const chapter = chapterMap.get(surahNum);
      if (chapter) map.set(juz.juz_number, chapter.pages[0]);
    } else {
      map.set(juz.juz_number, JUZ_START_PAGES[juz.juz_number] ?? 1);
    }
  }
  return map;
}

function getChapterFirstPage(chapterId: number, chapters: Chapter[]): number {
  const ch = chapters.find((c) => c.id === chapterId);
  return ch ? ch.pages[0] : 1;
}

function getJuzFirstPage(
  juzNumber: number,
  juzPageMap: Map<number, number>,
): number {
  return juzPageMap.get(juzNumber) ?? JUZ_START_PAGES[juzNumber] ?? 1;
}

function MushafPageContent({
  pageNumber,
  chapters,
}: {
  pageNumber: number;
  chapters: Chapter[];
}) {
  const { data, isLoading, isError } = useQuery<PageData>({
    queryKey: ["mushaf-page", pageNumber],
    queryFn: () => fetchPage(pageNumber),
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) {
    return (
      <div style={{ padding: "12px 0" }}>
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={i}
            style={{
              height: "1.4em",
              marginBottom: "0.55em",
              background: BAYAAN_PAGE_THEME.pageBorder,
              opacity: 0.22,
              borderRadius: "3px",
            }}
          />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 12px",
          color: BAYAAN_PAGE_THEME.pageMuted,
          fontSize: "0.8em",
          direction: "ltr",
        }}
      >
        Failed to load page. Check your connection.
      </div>
    );
  }

  const verses = data.verses || [];
  const pageLines = buildPageLines(verses);
  const surahStartLines = getSurahStartLines(verses);
  const sortedLineNums = Array.from(pageLines.keys()).sort((a, b) => a - b);
  const totalLines = sortedLineNums.length;
  const isDensePage = totalLines >= 10;
  const lastLineNum = sortedLineNums[sortedLineNums.length - 1];

  return (
    <>
      {sortedLineNums.map((lineNum) => {
        const words = pageLines.get(lineNum)!;
        const surahNum = surahStartLines.has(lineNum)
          ? getSurahForLine(lineNum, verses)
          : null;
        const wordCount = words.filter((w) => w.type === "word").length;
        const shouldJustify =
          isDensePage && wordCount >= 4 && lineNum !== lastLineNum;

        return (
          <div key={lineNum}>
            {surahNum !== null && (
              <BayaanSurahBanner
                surahNumber={surahNum}
                surahName={
                  chapters.find((c) => c.id === surahNum)?.name_simple ??
                  `Surah ${surahNum}`
                }
              />
            )}
            <div
              dir="rtl"
              style={{
                display: "flex",
                justifyContent: shouldJustify ? "space-between" : "center",
                alignItems: "baseline",
                flexWrap: "nowrap",
              }}
            >
              {words.map((w) =>
                w.type === "end" ? (
                  <span key={w.id} style={{ color: BAYAAN_PAGE_THEME.markerText }}>
                    {w.text}
                  </span>
                ) : (
                  <span key={w.id}>{w.text}</span>
                ),
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function MushafPage_() {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpInput, setJumpInput] = useState("");
  const [jumpMode, setJumpMode] = useState<"surah" | "juz">("surah");
  const [showChrome, setShowChrome] = useState(true);
  const queryClient = useQueryClient();

  const { data: chaptersData } = useQuery({
    queryKey: ["chapters"],
    queryFn: fetchChapters,
    staleTime: Infinity,
  });

  const { data: juzsData } = useQuery({
    queryKey: ["juzs"],
    queryFn: fetchJuzs,
    staleTime: Infinity,
  });

  const { data: pageData } = useQuery<PageData>({
    queryKey: ["mushaf-page", currentPage],
    queryFn: () => fetchPage(currentPage),
    staleTime: 1000 * 60 * 60,
  });

  const chapters = chaptersData?.chapters || [];
  const rawJuzs = juzsData?.juzs || [];
  const juzs = Array.from(
    rawJuzs
      .reduce((map: Map<number, Juz>, j: Juz) => {
        if (!map.has(j.juz_number)) map.set(j.juz_number, j);
        return map;
      }, new Map<number, Juz>())
      .values(),
  ).sort((a: Juz, b: Juz) => a.juz_number - b.juz_number);
  const juzPageMap = buildJuzPageMap(juzs, chapters);

  // Find the primary surah for the current page (used only for Bayaan font preloading)
  const primaryChapter =
    chapters.length > 0
      ? [...chapters].reverse().find((ch) => ch.pages[0] <= currentPage) ??
        chapters[0]
      : null;
  const primarySurahId = primaryChapter?.id ?? 1;
  const primarySurahName = primaryChapter?.name_simple ?? "Al-Fatihah";

  const pageSurahNames = pageData?.verses
    ? getArabicSurahNamesForPage(pageData.verses, chapters)
    : "";

  // Auto-hide chrome bar 4s after mount
  useEffect(() => {
    const timer = setTimeout(() => setShowChrome(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const {
    pageContentRefs,
    pageMeasureRefs,
    isMushafContentVisible,
    getCachedScale,
  } = useBayaanMushafFit({
    surahNumber: primarySurahId,
    surahName: primarySurahName,
    mushafFitContentKey: String(currentPage),
    pageNumbers: [currentPage],
    isSinglePageLayout: true,
  });

  const pageContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      pageContentRefs.current[currentPage] = node;
    },
    [currentPage, pageContentRefs],
  );

  const pageMeasureRef = useCallback(
    (node: HTMLDivElement | null) => {
      pageMeasureRefs.current[currentPage] = node;
    },
    [currentPage, pageMeasureRefs],
  );

  const prefetchNext = useCallback(
    (page: number) => {
      if (page < TOTAL_PAGES) {
        queryClient.prefetchQuery({
          queryKey: ["mushaf-page", page + 1],
          queryFn: () => fetchPage(page + 1),
          staleTime: 1000 * 60 * 60,
        });
      }
    },
    [queryClient],
  );

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
    setCurrentPage(clamped);
    prefetchNext(clamped);
  };

  const handleJump = (value: string) => {
    if (!value) return;
    if (jumpMode === "surah") {
      goToPage(getChapterFirstPage(parseInt(value), chapters));
    } else {
      goToPage(getJuzFirstPage(parseInt(value), juzPageMap));
    }
  };

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(jumpInput);
      if (!isNaN(val)) {
        goToPage(val);
        setJumpInput("");
      }
    }
  };

  // RTL Quran: left tap = next page (forward), right tap = previous page (back)
  const handleLeftTap = () => {
    if (currentPage < TOTAL_PAGES) goToPage(currentPage + 1);
  };
  const handleRightTap = () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  };

  return (
    <>
      <style>{TAJWEED_CSS}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "#e0d5c2",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Collapsible chrome bar */}
        <div
          style={{
            height: showChrome ? "48px" : "0px",
            overflow: "hidden",
            transition: "height 0.25s ease",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: "48px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "0 10px",
              background: "#cfc5ae",
              borderBottom: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
            }}
          >
            {/* Back */}
            <button
              onClick={() => setLocation("/")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                color: BAYAAN_PAGE_THEME.chromeMuted,
                fontSize: "13px",
                background: "none",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                padding: "4px 6px",
              }}
            >
              <ChevronLeft size={15} />
              <span>Back</span>
            </button>

            {/* Surah / Juz toggle */}
            <div
              style={{
                display: "flex",
                background: "rgba(0,0,0,0.1)",
                borderRadius: "6px",
                padding: "2px",
                flexShrink: 0,
              }}
            >
              {(["surah", "juz"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setJumpMode(mode)}
                  style={{
                    fontSize: "11px",
                    padding: "3px 9px",
                    borderRadius: "4px",
                    background:
                      jumpMode === mode
                        ? BAYAAN_PAGE_THEME.markerSurface
                        : "transparent",
                    color: BAYAAN_PAGE_THEME.chromeMuted,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: jumpMode === mode ? 600 : 400,
                  }}
                >
                  {mode === "surah" ? "Surah" : "Juz"}
                </button>
              ))}
            </div>

            {/* Jump dropdown */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {jumpMode === "surah" && chapters.length > 0 ? (
                <Select onValueChange={handleJump}>
                  <SelectTrigger
                    className="h-7 text-xs min-w-0"
                    style={{
                      border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                      background: "rgba(255,253,248,0.65)",
                      color: BAYAAN_PAGE_THEME.screenText,
                    }}
                  >
                    <SelectValue placeholder="Jump to Surah…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {chapters.map((ch) => (
                      <SelectItem
                        key={ch.id}
                        value={String(ch.id)}
                        className="text-xs"
                      >
                        {ch.id}. {ch.name_simple}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : jumpMode === "juz" && juzs.length > 0 ? (
                <Select onValueChange={handleJump}>
                  <SelectTrigger
                    className="h-7 text-xs min-w-0"
                    style={{
                      border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                      background: "rgba(255,253,248,0.65)",
                      color: BAYAAN_PAGE_THEME.screenText,
                    }}
                  >
                    <SelectValue placeholder="Jump to Juz…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {juzs.map((juz) => (
                      <SelectItem
                        key={juz.id}
                        value={String(juz.juz_number)}
                        className="text-xs"
                      >
                        Juz {juz.juz_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            {/* Page number input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                borderRadius: "6px",
                padding: "0 8px",
                height: "28px",
                flexShrink: 0,
                background: "rgba(255,253,248,0.65)",
              }}
            >
              <span
                style={{ fontSize: "10px", color: BAYAAN_PAGE_THEME.chromeMuted }}
              >
                p.
              </span>
              <input
                type="number"
                min={1}
                max={TOTAL_PAGES}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={handlePageInput}
                placeholder={String(currentPage)}
                style={{
                  width: "38px",
                  fontSize: "11px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: BAYAAN_PAGE_THEME.screenText,
                }}
              />
            </div>
          </div>
        </div>

        {/* Page area — fills remaining height */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            padding: "4px",
          }}
        >
          <BayaanMushafPageCard
            pageNumber={currentPage}
            pageSurahNames={pageSurahNames}
            isSinglePageLayout={true}
            cachedScale={getCachedScale(currentPage)}
            isContentVisible={isMushafContentVisible}
            pageContentRef={pageContentRef}
            pageMeasureRef={pageMeasureRef}
          >
            <MushafPageContent pageNumber={currentPage} chapters={chapters} />
          </BayaanMushafPageCard>

          {/* Left tap zone → next page (RTL forward) */}
          <div
            onClick={handleLeftTap}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "22%",
              zIndex: 10,
              cursor: currentPage < TOTAL_PAGES ? "pointer" : "default",
            }}
          />

          {/* Right tap zone → previous page (RTL back) */}
          <div
            onClick={handleRightTap}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "22%",
              zIndex: 10,
              cursor: currentPage > 1 ? "pointer" : "default",
            }}
          />

          {/* Center tap → toggle chrome bar */}
          <div
            onClick={() => setShowChrome((v) => !v)}
            style={{
              position: "absolute",
              left: "22%",
              right: "22%",
              top: 0,
              bottom: 0,
              zIndex: 9,
            }}
          />

          {/* Subtle edge chevrons */}
          {currentPage < TOTAL_PAGES && (
            <div
              style={{
                position: "absolute",
                left: "6px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 11,
                pointerEvents: "none",
                color: BAYAAN_PAGE_THEME.chromeMuted,
                opacity: 0.35,
              }}
            >
              <ChevronLeft size={18} />
            </div>
          )}
          {currentPage > 1 && (
            <div
              style={{
                position: "absolute",
                right: "6px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 11,
                pointerEvents: "none",
                color: BAYAAN_PAGE_THEME.chromeMuted,
                opacity: 0.35,
              }}
            >
              <ChevronRight size={18} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
