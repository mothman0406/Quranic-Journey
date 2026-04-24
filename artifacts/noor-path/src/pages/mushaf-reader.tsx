import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMemorization, listMemorization } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VersePlayer } from "@/components/verse-player";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Copy,
  BookOpen,
  Eye,
  EyeOff,
  CheckCircle,
  Circle,
  X,
  Check,
  Mic,
  MicOff,
  Volume2,
} from "lucide-react";
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

const SKIP_CHARS = /^[ۖ-ۭ؀-؅؛؞؟۝۞۟]+$/;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ApiWord {
  position: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string | { text: string; language_name: string };
}

type LineWord = {
  verse_key: string;
  surahId: number;
  verseNum: number;
  position: number;
  wordIdxInVerse: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string;
};

interface PageVerseData {
  verse_key: string;
  text_uthmani: string;
  words?: ApiWord[];
}

interface Chapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name: { name: string };
  bismillah_pre: boolean;
  pages: [number, number];
}

interface AyahInfo {
  verseKey: string;
  surahId: number;
  verseNum: number;
  text_uthmani: string;
}

type ReciteWord = {
  verse_key: string;
  surahId: number;
  verseNum: number;
  position: number;
  text_uthmani: string;
};

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchVersesByPage(pageNumber: number): Promise<{ verses: PageVerseData[] }> {
  const r = await fetch(
    `${QURAN_API}/verses/by_page/${pageNumber}?words=true&fields=text_uthmani&word_fields=text_uthmani,line_number,char_type_name,translation&per_page=50`
  );
  if (!r.ok) throw new Error(`Failed to fetch page ${pageNumber}`);
  return r.json();
}

async function fetchAllChapters(): Promise<{ chapters: Chapter[] }> {
  const r = await fetch(`${QURAN_API}/chapters?language=en`);
  if (!r.ok) throw new Error("Failed to fetch chapters");
  return r.json();
}

async function fetchTranslation(verseKey: string): Promise<string> {
  const r = await fetch(`${QURAN_API}/verses/by_key/${verseKey}?translations=131`);
  if (!r.ok) return "";
  const data = await r.json();
  const raw: string = data.verse?.translations?.[0]?.text ?? "";
  return raw
    .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function stripTashkeel(s: string): string {
  return (
    s
      .replace(/ٰ/g, "ا")
      .replace(/[ؐ-ًؚ-ٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, "")
      .replace(/[ـ]/g, "")
      .replace(/[أإآاٱ]/g, "ا")
      .trim() || s
  );
}

function isBeforeVerseKey(a: string, b: string): boolean {
  const [aSurah, aVerse] = a.split(":").map(Number);
  const [bSurah, bVerse] = b.split(":").map(Number);
  return aSurah < bSurah || (aSurah === bSurah && aVerse < bVerse);
}

function buildLineGroups(
  verses: PageVerseData[]
): Array<{ lineNum: number; words: LineWord[] }> | null {
  const all: LineWord[] = [];
  for (const pv of verses) {
    if (!pv.words?.length) return null;
    const [surahStr, verseStr] = pv.verse_key.split(":");
    const surahId = parseInt(surahStr, 10);
    const verseNum = parseInt(verseStr, 10);
    const verseTokens = (pv.text_uthmani ?? "").split(/\s+/).filter(Boolean);
    let lastMatchedJ = -1;
    for (const w of pv.words) {
      let wordIdxInVerse: number;
      if (w.char_type_name === "end") {
        wordIdxInVerse = -1;
      } else {
        const target = stripTashkeel(w.text_uthmani);
        let found = -1;
        for (let j = lastMatchedJ + 1; j < verseTokens.length; j++) {
          if (stripTashkeel(verseTokens[j]) === target) {
            found = j;
            break;
          }
        }
        if (found !== -1) {
          lastMatchedJ = found;
          wordIdxInVerse = found;
        } else {
          wordIdxInVerse = w.position - 1;
        }
      }
      all.push({
        verse_key: pv.verse_key,
        surahId,
        verseNum,
        position: w.position,
        wordIdxInVerse,
        text_uthmani: w.text_uthmani,
        char_type_name: w.char_type_name,
        line_number: w.line_number,
        translation: typeof w.translation === "object" && w.translation !== null
          ? (w.translation as { text?: string }).text ?? ""
          : (w.translation as string | undefined),
      });
    }
  }
  if (all.length === 0) return null;
  const map = new Map<number, LineWord[]>();
  for (const w of all) {
    if (!map.has(w.line_number)) map.set(w.line_number, []);
    map.get(w.line_number)!.push(w);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lineNum, words]) => ({ lineNum, words }));
}

// ─── AyahSheet ─────────────────────────────────────────────────────────────────

function AyahSheet({
  ayah,
  childId,
  onClose,
}: {
  ayah: AyahInfo;
  childId: string;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);

  const { data: translation, isLoading: translationLoading } = useQuery({
    queryKey: ["translation", ayah.verseKey],
    queryFn: () => fetchTranslation(ayah.verseKey),
    staleTime: Infinity,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ayah.text_uthmani);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[70]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[80] shadow-2xl max-h-[72vh] overflow-y-auto">
        <div className="max-w-lg mx-auto p-5 pb-24">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{ayah.verseKey}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Surah {ayah.surahId}, Verse {ayah.verseNum}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
            >
              <X size={16} />
            </button>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-100">
            <VersePlayer
              arabic={ayah.text_uthmani}
              surahNumber={ayah.surahId}
              verseNumber={ayah.verseNum}
              size="md"
            />
          </div>
          <div className="mb-4 min-h-[56px]">
            {translationLoading ? (
              <Skeleton className="h-14 rounded-xl" />
            ) : translation ? (
              <p className="text-sm text-gray-700 leading-relaxed">{translation}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">Translation unavailable</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 mb-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium active:bg-amber-100"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Verse"}
            </button>
          </div>
          <button
            onClick={() =>
              setLocation(`/child/${childId}/quran-memorize?surah=${ayah.surahId}&mode=mushaf`)
            }
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-700"
          >
            <BookOpen size={14} /> Memorize from here
          </button>
          <button
            onClick={() => {
              setLocation(`/child/${childId}/quran-memorize?surah=${ayah.surahId}&fromAyah=${ayah.verseNum}&toAyah=${ayah.verseNum}&mode=mushaf`);
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold active:bg-amber-100 mt-2"
          >
            📖 Open in Memorization Mushaf
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MushafReaderPage() {
  const { childId } = useParams<{ childId: string }>();
  const rawSearch = useSearch();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch);
    const p = parseInt(params.get("page") ?? "1", 10);
    return isNaN(p) ? 1 : Math.max(1, Math.min(TOTAL_PAGES, p));
  });
  const [jumpInput, setJumpInput] = useState("");
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [revealedVerseKeys, setRevealedVerseKeys] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedVerseKeys, setSelectedVerseKeys] = useState<Set<string>>(new Set());
  const [tappedAyah, setTappedAyah] = useState<AyahInfo | null>(null);
  const [tappedWord, setTappedWord] = useState<{
    key: string; text: string; position: number;
    surahId: number; verseNum: number; translation: string;
  } | null>(null);
  const [isRecitePickMode, setIsRecitePickMode] = useState(false);
  const [isReciting, setIsReciting] = useState(false);
  const [reciteStartVerseKey, setReciteStartVerseKey] = useState<string | null>(null);
  const [reciteUnlockedWords, setReciteUnlockedWords] = useState<Set<string>>(new Set());
  const [showChrome, setShowChrome] = useState(true);

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const recitePageWordsRef = useRef<ReciteWord[]>([]);
  const reciteWordPosRef = useRef(0);
  const reciteUnlockedWordsRef = useRef<Set<string>>(new Set());

  reciteUnlockedWordsRef.current = reciteUnlockedWords;

  // Reset interactive state when page changes
  useEffect(() => {
    setRevealedVerseKeys(new Set());
    setTappedAyah(null);
    setTappedWord(null);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsReciting(false);
    setIsRecitePickMode(false);
    setReciteStartVerseKey(null);
    setReciteUnlockedWords(new Set());
    reciteWordPosRef.current = 0;
  }, [currentPage]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // Page data
  const { data: pageData, isLoading, isError } = useQuery({
    queryKey: ["mushaf-reader-page", currentPage],
    queryFn: () => fetchVersesByPage(currentPage),
    staleTime: 1000 * 60 * 60,
  });

  // Prefetch adjacent pages
  const prefetchNext = useCallback(
    (page: number) => {
      if (page < TOTAL_PAGES) {
        queryClient.prefetchQuery({
          queryKey: ["mushaf-reader-page", page + 1],
          queryFn: () => fetchVersesByPage(page + 1),
          staleTime: 1000 * 60 * 60,
        });
      }
      if (page > 1) {
        queryClient.prefetchQuery({
          queryKey: ["mushaf-reader-page", page - 1],
          queryFn: () => fetchVersesByPage(page - 1),
          staleTime: 1000 * 60 * 60,
        });
      }
    },
    [queryClient]
  );

  const { data: chaptersData } = useQuery({
    queryKey: ["chapters"],
    queryFn: fetchAllChapters,
    staleTime: Infinity,
  });
  const chapters = chaptersData?.chapters ?? [];

  const { data: memData } = useQuery({
    queryKey: ["memorization", childId],
    queryFn: () => listMemorization(parseInt(childId, 10)),
    staleTime: 30000,
  });

  const markMutation = useMutation({
    mutationFn: async () => {
      const latestMemData =
        (await queryClient.ensureQueryData({
          queryKey: ["memorization", childId],
          queryFn: () => listMemorization(parseInt(childId, 10)),
        })) ?? memData;
      const latestProgress = latestMemData?.progress ?? [];
      const bySurahNumber = new Map<number, number[]>();
      for (const vk of selectedVerseKeys) {
        const parts = vk.split(":");
        const canonicalSurahNumber = parseInt(parts[0], 10);
        const verseNumber = parseInt(parts[1], 10);
        if (!bySurahNumber.has(canonicalSurahNumber)) bySurahNumber.set(canonicalSurahNumber, []);
        bySurahNumber.get(canonicalSurahNumber)!.push(verseNumber);
      }
      for (const [canonicalSurahNumber, newAyahs] of bySurahNumber) {
        const existing =
          latestProgress.find((p) => p.surahNumber === canonicalSurahNumber)?.memorizedAyahs ?? [];
        const merged = Array.from(new Set([...existing, ...newAyahs])).sort((a, b) => a - b);
        await updateMemorization(parseInt(childId, 10), {
          surahId: canonicalSurahNumber,
          memorizedAyahs: merged,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memorization", childId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", childId] });
      setSelectedVerseKeys(new Set());
      setIsSelectMode(false);
    },
  });

  const verses = pageData?.verses ?? [];
  const lineGroups = useMemo(() => buildLineGroups(verses), [verses]);

  const surahsStartingOnPage = useMemo(() => {
    const s = new Set<number>();
    for (const v of verses) {
      const parts = v.verse_key.split(":");
      if (parseInt(parts[1], 10) === 1) s.add(parseInt(parts[0], 10));
    }
    return s;
  }, [verses]);

  const currentSurahName = useMemo(() => {
    if (!lineGroups?.length) return "";
    const firstWord = lineGroups[0].words[0];
    if (!firstWord) return "";
    const ch = chapters.find((c) => c.id === firstWord.surahId);
    return ch?.name_simple ?? `Surah ${firstWord.surahId}`;
  }, [lineGroups, chapters]);

  // Bayaan fit hook
  const primarySurahId = lineGroups?.[0]?.words[0]?.surahId ?? 1;
  const primarySurahName = currentSurahName || "Al-Fatihah";
  const pageSurahNames = verses.length > 0
    ? getArabicSurahNamesForPage(verses, chapters)
    : "";

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

  const pageContentRefCb = useCallback(
    (node: HTMLDivElement | null) => { pageContentRefs.current[currentPage] = node; },
    [currentPage, pageContentRefs],
  );
  const pageMeasureRefCb = useCallback(
    (node: HTMLDivElement | null) => { pageMeasureRefs.current[currentPage] = node; },
    [currentPage, pageMeasureRefs],
  );

  const stopReciting = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsReciting(false);
    setIsRecitePickMode(false);
    setReciteStartVerseKey(null);
    setReciteUnlockedWords(new Set());
    reciteUnlockedWordsRef.current = new Set();
    reciteWordPosRef.current = 0;
  }, []);

  const startReciting = useCallback(
    (startVerseKey: string) => {
      if (!lineGroups) return;
      const words: ReciteWord[] = [];
      for (const { words: lws } of lineGroups) {
        for (const lw of lws) {
          if (lw.char_type_name !== "end" && !SKIP_CHARS.test(lw.text_uthmani)) {
            words.push({
              verse_key: lw.verse_key,
              surahId: lw.surahId,
              verseNum: lw.verseNum,
              position: lw.position,
              text_uthmani: lw.text_uthmani,
            });
          }
        }
      }
      recitePageWordsRef.current = words;
      const startIdx = words.findIndex((w) => w.verse_key === startVerseKey);
      reciteWordPosRef.current = Math.max(0, startIdx);
      setReciteStartVerseKey(startVerseKey);
      const emptySet = new Set<string>();
      setReciteUnlockedWords(emptySet);
      reciteUnlockedWordsRef.current = emptySet;
      setIsReciting(true);

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        alert("Speech recognition not supported in this browser. Try Chrome.");
        setIsReciting(false);
        return;
      }
      const recognition = new SR();
      recognition.lang = "ar-SA";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        if (!result) return;
        const transcript = result[0].transcript.trim();
        const heardWords = stripTashkeel(transcript).split(/\s+/).filter(Boolean);
        const pageWords = recitePageWordsRef.current;
        let pos = reciteWordPosRef.current;
        const newUnlocked = new Set(reciteUnlockedWordsRef.current);
        let advanced = false;
        for (const heard of heardWords) {
          if (pos >= pageWords.length) break;
          const expected = stripTashkeel(pageWords[pos].text_uthmani);
          if (expected.length <= 1) { pos++; continue; }
          if (heard === expected || expected.startsWith(heard) || heard.startsWith(expected)) {
            newUnlocked.add(`${pageWords[pos].verse_key}:${pageWords[pos].position}`);
            pos++;
            advanced = true;
          }
        }
        if (advanced) {
          reciteWordPosRef.current = pos;
          reciteUnlockedWordsRef.current = newUnlocked;
          setReciteUnlockedWords(new Set(newUnlocked));
        }
      };
      recognition.onerror = () => {};
      recognition.start();
    },
    [lineGroups]
  );

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
    setCurrentPage(clamped);
    prefetchNext(clamped);
  };

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(jumpInput, 10);
      if (!isNaN(val)) {
        goToPage(val);
        setJumpInput("");
      }
    }
  };

  const handleSurahJump = (value: string) => {
    const ch = chapters.find((c) => c.id === parseInt(value, 10));
    if (ch) goToPage(ch.pages[0]);
  };

  const handleWordClick = useCallback(
    (lw: LineWord) => {
      if (isReciting) return;

      if (isRecitePickMode) {
        setIsRecitePickMode(false);
        startReciting(lw.verse_key);
        return;
      }

      if (isSelectMode) {
        setSelectedVerseKeys((prev) => {
          const next = new Set(prev);
          if (next.has(lw.verse_key)) next.delete(lw.verse_key);
          else next.add(lw.verse_key);
          return next;
        });
        return;
      }

      if (isBlindMode) {
        setRevealedVerseKeys((prev) => {
          const next = new Set(prev);
          if (next.has(lw.verse_key)) next.delete(lw.verse_key);
          else next.add(lw.verse_key);
          return next;
        });
        return;
      }

      if (lw.char_type_name === "end") {
        const pv = verses.find((v) => v.verse_key === lw.verse_key);
        setTappedAyah({
          verseKey: lw.verse_key,
          surahId: lw.surahId,
          verseNum: lw.verseNum,
          text_uthmani: pv?.text_uthmani ?? "",
        });
        setTappedWord(null);
      } else {
        const wordKey = `${lw.verse_key}:${lw.position}`;
        if (tappedWord?.key === wordKey) {
          setTappedWord(null);
          return;
        }
        setTappedWord({
          key: wordKey,
          text: lw.text_uthmani,
          position: lw.position,
          surahId: lw.surahId,
          verseNum: lw.verseNum,
          translation: lw.translation ?? "",
        });
      }
    },
    [isReciting, isRecitePickMode, isSelectMode, isBlindMode, verses, startReciting, tappedWord]
  );

  const isAnyModeActive = isSelectMode || isBlindMode || isReciting || isRecitePickMode;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 50) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    if (dx > 0) {
      if (currentPage < TOTAL_PAGES) goToPage(currentPage + 1);
    } else {
      if (currentPage > 1) goToPage(currentPage - 1);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

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
        {/* ── Collapsible chrome bar ── */}
        <div
          style={{
            height: showChrome ? "56px" : "0px",
            overflow: "hidden",
            transition: "height 0.25s ease",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: "56px",
              display: "flex",
              flexDirection: "column",
              background: "#cfc5ae",
              borderBottom: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
            }}
          >
            {/* Row 1: Back + title + mode icons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px 0",
                flex: 1,
              }}
            >
              <button
                onClick={() =>
                  window.history.length > 1
                    ? window.history.back()
                    : setLocation(`/child/${childId}/memorization`)
                }
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
                  padding: "2px 4px",
                }}
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>

              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: BAYAAN_PAGE_THEME.screenText,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {currentSurahName || "Full Quran"}
                </p>
                <p
                  style={{
                    fontSize: "10px",
                    color: BAYAAN_PAGE_THEME.chromeMuted,
                    lineHeight: 1.2,
                    margin: 0,
                  }}
                >
                  p. {currentPage}
                </p>
              </div>

              {/* Blind mode */}
              <button
                onClick={() => {
                  setIsBlindMode((b) => !b);
                  setRevealedVerseKeys(new Set());
                }}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  border: `1px solid ${isBlindMode ? "#a855f7" : BAYAAN_PAGE_THEME.chromeBorder}`,
                  background: isBlindMode ? "#f3e8ff" : "transparent",
                  color: isBlindMode ? "#7c3aed" : BAYAAN_PAGE_THEME.chromeMuted,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isBlindMode ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>

              {/* Select mode */}
              <button
                onClick={() => {
                  setIsSelectMode((s) => !s);
                  setSelectedVerseKeys(new Set());
                }}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  border: `1px solid ${isSelectMode ? "#16a34a" : BAYAAN_PAGE_THEME.chromeBorder}`,
                  background: isSelectMode ? "#dcfce7" : "transparent",
                  color: isSelectMode ? "#16a34a" : BAYAAN_PAGE_THEME.chromeMuted,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isSelectMode ? <CheckCircle size={14} /> : <Circle size={14} />}
              </button>

              {/* Recite mode */}
              <button
                onClick={() => {
                  if (isReciting) { stopReciting(); }
                  else { setIsRecitePickMode((p) => !p); }
                }}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  border: `1px solid ${(isReciting || isRecitePickMode) ? "#e11d48" : BAYAAN_PAGE_THEME.chromeBorder}`,
                  background: (isReciting || isRecitePickMode) ? "#fee2e2" : "transparent",
                  color: (isReciting || isRecitePickMode) ? "#e11d48" : BAYAAN_PAGE_THEME.chromeMuted,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isReciting ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>

            {/* Row 2: Surah jump + page input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "0 10px 4px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {chapters.length > 0 ? (
                  <Select onValueChange={handleSurahJump}>
                    <SelectTrigger
                      className="h-6 text-[11px] min-w-0"
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
                        <SelectItem key={ch.id} value={String(ch.id)} className="text-xs">
                          {ch.id}. {ch.name_simple}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                  borderRadius: "5px",
                  padding: "0 6px",
                  height: "24px",
                  flexShrink: 0,
                  background: "rgba(255,253,248,0.65)",
                }}
              >
                <span style={{ fontSize: "9px", color: BAYAAN_PAGE_THEME.chromeMuted }}>p.</span>
                <input
                  type="number"
                  min={1}
                  max={TOTAL_PAGES}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  onKeyDown={handlePageInput}
                  placeholder={String(currentPage)}
                  style={{
                    width: "34px",
                    fontSize: "10px",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: BAYAAN_PAGE_THEME.screenText,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Page area ── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            padding: "4px",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <BayaanMushafPageCard
            pageNumber={currentPage}
            pageSurahNames={pageSurahNames}
            isSinglePageLayout={true}
            cachedScale={getCachedScale(currentPage)}
            isContentVisible={isMushafContentVisible}
            pageContentRef={pageContentRefCb}
            pageMeasureRef={pageMeasureRefCb}
          >
            {/* Loading */}
            {isLoading && (
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
            )}

            {/* Error */}
            {isError && (
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
            )}

            {/* ── Line-based rendering ── */}
            {!isLoading && !isError && lineGroups && (() => {
              const nodes: React.ReactNode[] = [];
              const seenSurahIds = new Set<number>();

              for (const { lineNum, words: lws } of lineGroups) {
                const newSurahs: number[] = [];
                for (const lw of lws) {
                  if (!seenSurahIds.has(lw.surahId)) {
                    seenSurahIds.add(lw.surahId);
                    newSurahs.push(lw.surahId);
                  }
                }
                for (const sid of newSurahs) {
                  if (!surahsStartingOnPage.has(sid)) continue;
                  const sc = chapters.find((c) => c.id === sid);
                  nodes.push(
                    <BayaanSurahBanner
                      key={`hdr-${sid}`}
                      surahNumber={sid}
                      surahName={sc?.name_simple ?? `Surah ${sid}`}
                    />
                  );
                }

                nodes.push(
                  <div
                    key={`ln-${lineNum}`}
                    style={{
                      display: "flex",
                      direction: "rtl",
                      justifyContent: "center",
                      alignItems: "center",
                      flexWrap: "nowrap",
                      lineHeight: 2.2,
                      padding: "0 4px",
                      width: "100%",
                      gap: "0.3em",
                    }}
                  >
                    {lws.map((lw) => {
                      const k = `${lw.verse_key}:${lw.position}`;

                      if (lw.char_type_name === "end") {
                        const isSelected = isSelectMode && selectedVerseKeys.has(lw.verse_key);
                        let endOpacity = 1;
                        if (isReciting && reciteStartVerseKey) {
                          if (isBeforeVerseKey(lw.verse_key, reciteStartVerseKey)) {
                            endOpacity = 0.3;
                          }
                        }
                        return (
                          <span
                            key={k}
                            onClick={() => handleWordClick(lw)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "1.9em",
                              height: "1.9em",
                              borderRadius: "50%",
                              border: isSelected
                                ? "1.5px solid #16a34a"
                                : `1.5px solid ${BAYAAN_PAGE_THEME.markerBorder}`,
                              background: isSelected ? "#dcfce7" : BAYAAN_PAGE_THEME.markerSurface,
                              flexShrink: 0,
                              userSelect: "none",
                              direction: "ltr",
                              cursor: "pointer",
                              opacity: endOpacity,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.58em",
                                color: isSelected ? "#16a34a" : BAYAAN_PAGE_THEME.markerText,
                                fontFamily: "Georgia, serif",
                                lineHeight: 1,
                              }}
                            >
                              {lw.verseNum}
                            </span>
                          </span>
                        );
                      }

                      const isSelected = isSelectMode && selectedVerseKeys.has(lw.verse_key);
                      const isBlurred = isBlindMode && !revealedVerseKeys.has(lw.verse_key);
                      let wordFilter = isBlurred ? "blur(6px)" : "none";
                      let wordOpacity = 1;
                      if (isReciting && reciteStartVerseKey) {
                        if (isBeforeVerseKey(lw.verse_key, reciteStartVerseKey)) {
                          wordFilter = "none";
                          wordOpacity = 0.3;
                        } else if (!reciteUnlockedWords.has(k)) {
                          wordFilter = "blur(6px)";
                          wordOpacity = 1;
                        } else {
                          wordFilter = "none";
                          wordOpacity = 1;
                        }
                      }

                      return (
                        <span
                          key={k}
                          onClick={() => handleWordClick(lw)}
                          className={cn(
                            "inline-block rounded-sm cursor-pointer transition-all duration-150",
                            isSelected && "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                          )}
                          style={{
                            filter: wordFilter,
                            opacity: wordOpacity,
                            userSelect: "none",
                            padding: "0 0.04em",
                          }}
                        >
                          {lw.text_uthmani}
                        </span>
                      );
                    })}
                  </div>
                );
              }
              return nodes;
            })()}

            {/* ── Fallback: no word-level data ── */}
            {!isLoading && !isError && !lineGroups && verses.length > 0 && (
              <div style={{ textAlign: "justify", textAlignLast: "right" }}>
                {verses.map((v) => {
                  const parts = v.verse_key.split(":");
                  const sId = parseInt(parts[0], 10);
                  const vNum = parseInt(parts[1], 10);
                  const isBlurred = isBlindMode && !revealedVerseKeys.has(v.verse_key);
                  const isSelected = isSelectMode && selectedVerseKeys.has(v.verse_key);
                  return (
                    <span
                      key={v.verse_key}
                      onClick={() =>
                        handleWordClick({
                          verse_key: v.verse_key,
                          surahId: sId,
                          verseNum: vNum,
                          position: 1,
                          wordIdxInVerse: 0,
                          text_uthmani: v.text_uthmani,
                          char_type_name: "word",
                          line_number: 0,
                        })
                      }
                      className={cn(
                        "inline cursor-pointer rounded transition-all",
                        isSelected && "bg-emerald-100"
                      )}
                      style={{ filter: isBlurred ? "blur(6px)" : "none", userSelect: "none" }}
                    >
                      {v.text_uthmani}{" "}
                    </span>
                  );
                })}
              </div>
            )}
          </BayaanMushafPageCard>

          {/* Center tap — toggle chrome bar */}
          {!isAnyModeActive && (
            <div
              onClick={() => setShowChrome((v) => !v)}
              style={{
                position: "absolute",
                left: "22%", right: "22%",
                top: 0, bottom: 0,
                zIndex: 9,
              }}
            />
          )}
        </div>

        {/* ── Mark as memorized floating button ── */}
        {isSelectMode && selectedVerseKeys.size > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: "16px", left: 0, right: 0,
              display: "flex",
              justifyContent: "center",
              zIndex: 65,
              padding: "0 16px",
              pointerEvents: "none",
            }}
          >
            <button
              onClick={() => markMutation.mutate()}
              disabled={markMutation.isPending || !memData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#16a34a",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "9999px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                pointerEvents: "auto",
                border: "none",
                cursor: "pointer",
                opacity: (markMutation.isPending || !memData) ? 0.7 : 1,
              }}
            >
              <Check size={15} />
              {markMutation.isPending
                ? "Saving…"
                : `Mark ${selectedVerseKeys.size} ayah${selectedVerseKeys.size > 1 ? "s" : ""} as memorized`}
            </button>
          </div>
        )}

        {/* ── Recite pick mode banner ── */}
        {isRecitePickMode && !isReciting && (
          <div
            style={{
              position: "fixed",
              bottom: "16px", left: 0, right: 0,
              zIndex: 65,
              display: "flex",
              justifyContent: "center",
              padding: "0 16px",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                border: "1px solid #fecaca",
                padding: "12px 20px",
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: 0 }}>
                Tap an ayah to start reciting from there
              </p>
              <button
                onClick={() => setIsRecitePickMode(false)}
                style={{
                  fontSize: "14px",
                  color: "#e11d48",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Stop reciting button ── */}
        {isReciting && (
          <div
            style={{
              position: "fixed",
              bottom: "16px", left: 0, right: 0,
              zIndex: 65,
              display: "flex",
              justifyContent: "center",
              padding: "0 16px",
              pointerEvents: "none",
            }}
          >
            <button
              onClick={stopReciting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#dc2626",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "9999px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                pointerEvents: "auto",
                border: "none",
                cursor: "pointer",
              }}
            >
              <MicOff size={15} /> Stop Reciting
            </button>
          </div>
        )}

        {/* ── AyahSheet ── */}
        {tappedAyah && (
          <AyahSheet
            key={tappedAyah.verseKey}
            ayah={tappedAyah}
            childId={childId}
            onClose={() => setTappedAyah(null)}
          />
        )}

        {/* ── Word translation tooltip ── */}
        {tappedWord && (
          <div
            style={{
              position: "fixed",
              bottom: "16px", left: 0, right: 0,
              zIndex: 65,
              display: "flex",
              justifyContent: "center",
              padding: "0 16px",
              pointerEvents: "none",
            }}
            onClick={() => setTappedWord(null)}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                border: `1px solid ${BAYAAN_PAGE_THEME.pageBorder}`,
                padding: "12px 16px",
                pointerEvents: "auto",
                maxWidth: "320px",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                    <p
                      dir="rtl"
                      style={{
                        fontSize: "20px",
                        color: "#92400e",
                        fontFamily: '"KFGQPC Hafs", "Amiri Quran", serif',
                        margin: 0,
                      }}
                    >
                      {tappedWord.text}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const audio = new Audio(
                          `https://audio.qurancdn.com/wbw/${String(tappedWord.surahId).padStart(3, "0")}_${String(tappedWord.verseNum).padStart(3, "0")}_${String(tappedWord.position).padStart(3, "0")}.mp3`
                        );
                        audio.play().catch(() => {});
                      }}
                      style={{
                        flexShrink: 0,
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#fef3c7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: BAYAAN_PAGE_THEME.markerText,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                  {tappedWord.translation ? (
                    <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.4, margin: 0 }}>
                      {tappedWord.translation}
                    </p>
                  ) : (
                    <p style={{ fontSize: "12px", color: "#9ca3af", fontStyle: "italic", margin: 0 }}>
                      No translation available
                    </p>
                  )}
                  <p style={{ fontSize: "10px", color: BAYAAN_PAGE_THEME.chromeMuted, marginTop: "4px", marginBottom: 0 }}>
                    {tappedWord.surahId}:{tappedWord.verseNum} · word {tappedWord.position}
                  </p>
                </div>
                <button
                  onClick={() => setTappedWord(null)}
                  style={{ color: "#d1d5db", background: "none", border: "none", cursor: "pointer", flexShrink: 0, marginTop: "2px" }}
                >
                  <X size={14} />
                </button>
              </div>
              <p style={{ fontSize: "10px", color: BAYAAN_PAGE_THEME.chromeMuted, marginTop: "8px", textAlign: "center", marginBottom: 0 }}>
                Tap verse number ○ to open full ayah
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
