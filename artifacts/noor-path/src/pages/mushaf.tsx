import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  const r = await fetch(`${QURAN_API}/verses/by_page/${page}?words=true&fields=text_uthmani&word_fields=text_uthmani,char_type_name,line_number,page_number`);
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

function SurahBanner({ chapterNumber, chapters }: { chapterNumber: number; chapters: Chapter[] }) {
  const chapter = chapters.find(c => c.id === chapterNumber);
  const showBismillah = chapter?.bismillah_pre && chapterNumber !== 1 && chapterNumber !== 9;

  return (
    <div className="mushaf-surah-banner">
      <div className="mushaf-surah-banner-inner">
        <span className="mushaf-surah-name-en">
          {chapter?.name_simple || `Surah ${chapterNumber}`}
        </span>
        <span className="mushaf-surah-name-ar">
          {chapter?.name_arabic || ""}
        </span>
      </div>
      {showBismillah && (
        <div className="mushaf-bismillah">
          بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
        </div>
      )}
    </div>
  );
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

interface MushafPageProps {
  pageNumber: number;
  chapters: Chapter[];
}

function MushafPage({ pageNumber, chapters }: MushafPageProps) {
  const { data, isLoading, isError } = useQuery<PageData>({
    queryKey: ["mushaf-page", pageNumber],
    queryFn: () => fetchPage(pageNumber),
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) {
    return (
      <div className="mushaf-lines-skeleton">
        {Array.from({ length: 15 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-10 text-amber-800 text-sm">
        Failed to load page. Please check your connection and try again.
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
    <div className="mushaf-page-content">
      {sortedLineNums.map((lineNum) => {
        const words = pageLines.get(lineNum)!;
        const surahNum = surahStartLines.has(lineNum) ? getSurahForLine(lineNum, verses) : null;
        const wordCount = words.filter(w => w.type === "word").length;
        const shouldJustify = isDensePage && wordCount >= 4 && lineNum !== lastLineNum;

        return (
          <div key={lineNum}>
            {surahNum !== null && (
              <SurahBanner chapterNumber={surahNum} chapters={chapters} />
            )}
            <div
              className="mushaf-line"
              data-line={lineNum}
              data-justify={shouldJustify ? "true" : undefined}
            >
              {words.map((w) =>
                w.type === "end" ? (
                  <span key={w.id} className="mushaf-end-marker">
                    {w.text}
                  </span>
                ) : (
                  <span key={w.id} className="mushaf-word">
                    {w.text}
                  </span>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const chapterMap = new Map(chapters.map(c => [c.id, c]));
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
  const ch = chapters.find(c => c.id === chapterId);
  return ch ? ch.pages[0] : 1;
}

function getJuzFirstPage(juzNumber: number, juzPageMap: Map<number, number>): number {
  return juzPageMap.get(juzNumber) ?? JUZ_START_PAGES[juzNumber] ?? 1;
}

export default function MushafPage_() {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpInput, setJumpInput] = useState("");
  const [jumpMode, setJumpMode] = useState<"surah" | "juz">("surah");
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

  const chapters = chaptersData?.chapters || [];
  const rawJuzs = juzsData?.juzs || [];
  const juzs = Array.from(
    rawJuzs.reduce((map: Map<number, Juz>, j: Juz) => {
      if (!map.has(j.juz_number)) map.set(j.juz_number, j);
      return map;
    }, new Map<number, Juz>()).values()
  ).sort((a: Juz, b: Juz) => a.juz_number - b.juz_number);
  const juzPageMap = buildJuzPageMap(juzs, chapters);

  const prefetchNext = useCallback((page: number) => {
    if (page < TOTAL_PAGES) {
      queryClient.prefetchQuery({
        queryKey: ["mushaf-page", page + 1],
        queryFn: () => fetchPage(page + 1),
        staleTime: 1000 * 60 * 60,
      });
    }
  }, [queryClient]);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
    setCurrentPage(clamped);
    prefetchNext(clamped);
  };

  const handleJump = (value: string) => {
    if (!value) return;
    if (jumpMode === "surah") {
      const id = parseInt(value);
      const page = getChapterFirstPage(id, chapters);
      goToPage(page);
    } else {
      const num = parseInt(value);
      const page = getJuzFirstPage(num, juzPageMap);
      goToPage(page);
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

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Header */}
      <div className="pattern-bg text-white px-4 pt-8 pb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setLocation("/")} className="flex items-center gap-1 text-emerald-200 text-sm">
              <ChevronLeft size={16} /> Home
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Read Quran</h1>
              <p className="text-emerald-200 text-sm mt-0.5">Mushaf Reading Mode</p>
            </div>
            <div className="text-amber-200 text-right">
              <p className="text-xs opacity-80">Page</p>
              <p className="text-2xl font-bold leading-none">{currentPage}</p>
              <p className="text-xs opacity-60">of {TOTAL_PAGES}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="bg-white border-b border-amber-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
          {/* Jump mode toggle */}
          <div className="flex bg-amber-50 rounded-lg p-0.5 border border-amber-200">
            <button
              onClick={() => setJumpMode("surah")}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors font-medium",
                jumpMode === "surah" ? "bg-white shadow-sm text-amber-900" : "text-amber-700"
              )}
            >
              Surah
            </button>
            <button
              onClick={() => setJumpMode("juz")}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors font-medium",
                jumpMode === "juz" ? "bg-white shadow-sm text-amber-900" : "text-amber-700"
              )}
            >
              Juz
            </button>
          </div>

          {/* Jump dropdown */}
          <div className="flex-1 min-w-0">
            {jumpMode === "surah" && chapters.length > 0 ? (
              <Select onValueChange={handleJump}>
                <SelectTrigger className="h-8 text-xs border-amber-200 bg-amber-50 min-w-0">
                  <SelectValue placeholder="Jump to Surah…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {chapters.map(ch => (
                    <SelectItem key={ch.id} value={String(ch.id)} className="text-xs">
                      {ch.id}. {ch.name_simple} — {ch.translated_name?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : jumpMode === "juz" && juzs.length > 0 ? (
              <Select onValueChange={handleJump}>
                <SelectTrigger className="h-8 text-xs border-amber-200 bg-amber-50 min-w-0">
                  <SelectValue placeholder="Jump to Juz…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {juzs.map(juz => (
                    <SelectItem key={juz.id} value={String(juz.juz_number)} className="text-xs">
                      Juz {juz.juz_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Skeleton className="h-8 rounded-md" />
            )}
          </div>

          {/* Page number input */}
          <div className="flex items-center gap-1 border border-amber-200 rounded-md bg-amber-50 px-2 h-8">
            <span className="text-xs text-amber-700">p.</span>
            <input
              type="number"
              min={1}
              max={TOTAL_PAGES}
              value={jumpInput}
              onChange={e => setJumpInput(e.target.value)}
              onKeyDown={handlePageInput}
              placeholder={String(currentPage)}
              className="w-12 text-xs bg-transparent outline-none text-amber-900 placeholder:text-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6">
        <div
          className="mushaf-page bg-[#fdf8f0] rounded-xl shadow-md border border-amber-200 p-6 sm:p-10 min-h-[60vh]"
          style={{
            backgroundImage: "linear-gradient(to bottom, #fdf8f0, #faf3e8)",
            boxShadow: "0 4px 24px rgba(139,90,43,0.08), inset 0 0 40px rgba(200,160,80,0.04)",
          }}
        >
          {/* Page number watermark */}
          <div className="text-center mb-4">
            <span className="text-xs text-amber-400 font-medium tracking-widest uppercase">
              ﷽ Page {currentPage}
            </span>
          </div>

          <MushafPage pageNumber={currentPage} chapters={chapters} />

          {/* Bottom page number */}
          <div className="text-center mt-6 pt-4 border-t border-amber-200">
            <span className="text-xs text-amber-500 font-medium">{currentPage}</span>
          </div>
        </div>

        {/* Navigation buttons — RTL: next page is to the left */}
        <div className="flex items-center justify-between mt-6 gap-4">
          <Button
            variant="outline"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= TOTAL_PAGES}
            className="flex items-center gap-2 border-amber-300 text-amber-800 hover:bg-amber-50 bg-white"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Next</span>
          </Button>

          <div className="text-center">
            <p className="text-sm font-medium text-amber-900">
              Page {currentPage} <span className="text-amber-500">of {TOTAL_PAGES}</span>
            </p>
            <div className="mt-1 h-1 w-32 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${(currentPage / TOTAL_PAGES) * 100}%` }}
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-2 border-amber-300 text-amber-800 hover:bg-amber-50 bg-white"
          >
            <span className="hidden sm:inline">Previous</span>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
