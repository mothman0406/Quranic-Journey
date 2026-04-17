import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMemorization, listMemorization } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChildNav } from "@/components/child-nav";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
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
} from "lucide-react";

const TOTAL_PAGES = 604;
const QURAN_API = "https://api.quran.com/api/v4";

const SKIP_CHARS = /^[\u06D6-\u06ED\u0600-\u0605\u061B\u061E\u061F\u06DD\u06DE\u06DF]+$/;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ApiWord {
  position: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
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
    `${QURAN_API}/verses/by_page/${pageNumber}?words=true&fields=text_uthmani&word_fields=text_uthmani,line_number,char_type_name&per_page=50`
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
      .replace(/\u0670/g, "ا")
      .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "")
      .replace(/[ـ]/g, "")
      .replace(/[أإآاٱ]/g, "ا")
      .trim() || s
  );
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function buildAudioUrl(surah: number, verse: number): string {
  return `https://everyayah.com/data/Husary_64kbps/${pad(surah, 3)}${pad(verse, 3)}.mp3`;
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
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightedWordIdx, setHighlightedWordIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const sheetWords = useMemo(
    () => ayah.text_uthmani.split(/\s+/).filter(Boolean),
    [ayah.text_uthmani]
  );

  const { data: translation, isLoading: translationLoading } = useQuery({
    queryKey: ["translation", ayah.verseKey],
    queryFn: () => fetchTranslation(ayah.verseKey),
    staleTime: Infinity,
  });

  const tickHighlight = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    const dur = audio.duration || 0;
    const frac = dur > 0 ? audio.currentTime / dur : 0;
    const idx = Math.min(Math.floor(frac * sheetWords.length), sheetWords.length - 1);
    setHighlightedWordIdx(idx);
    rafRef.current = requestAnimationFrame(tickHighlight);
  }, [sheetWords.length]);

  // Stop audio when verse changes or sheet unmounts
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      setPlaying(false);
      setHighlightedWordIdx(-1);
    };
  }, [ayah.verseKey]);

  const handlePlay = () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      cancelAnimationFrame(rafRef.current);
      audioRef.current.src = "";
    }
    const audio = new Audio(buildAudioUrl(ayah.surahId, ayah.verseNum));
    audio.onended = () => {
      setPlaying(false);
      setHighlightedWordIdx(-1);
      cancelAnimationFrame(rafRef.current);
    };
    audio.onerror = () => {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };
    audioRef.current = audio;
    audio.play().then(() => {
      setPlaying(true);
      rafRef.current = requestAnimationFrame(tickHighlight);
    }).catch(() => setPlaying(false));
  };

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
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 shadow-2xl max-h-[72vh] overflow-y-auto">
        <div className="max-w-lg mx-auto p-5 pb-24">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

          {/* Header */}
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

          {/* Arabic text */}
          <div
            dir="rtl"
            lang="ar"
            className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-100"
            style={{
              fontFamily: '"Scheherazade New", "Amiri Quran", serif',
              fontSize: "clamp(18px, 4vw, 26px)",
              lineHeight: 2.2,
              textAlign: "right",
              color: "#1a1a1a",
            }}
          >
            {sheetWords.map((w, i) => (
              <span
                key={i}
                style={{
                  backgroundColor: i === highlightedWordIdx ? "#fcd34d" : undefined,
                  borderRadius: i === highlightedWordIdx ? "3px" : undefined,
                  padding: "0 0.05em",
                }}
              >
                {w}{i < sheetWords.length - 1 ? " " : ""}
              </span>
            ))}
          </div>

          {/* Translation */}
          <div className="mb-4 min-h-[56px]">
            {translationLoading ? (
              <Skeleton className="h-14 rounded-xl" />
            ) : translation ? (
              <p className="text-sm text-gray-700 leading-relaxed">{translation}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">Translation unavailable</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={handlePlay}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium active:bg-emerald-100"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Pause" : "Play Ayah"}
            </button>
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
              setLocation(
                `/child/${childId}/quran-memorize?surah=${ayah.surahId}&mode=mushaf`
              )
            }
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-700"
          >
            <BookOpen size={14} /> Memorize from here
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
  const [isRecitePickMode, setIsRecitePickMode] = useState(false);
  const [isReciting, setIsReciting] = useState(false);
  const [reciteStartVerseKey, setReciteStartVerseKey] = useState<string | null>(null);
  const [reciteUnlockedWords, setReciteUnlockedWords] = useState<Set<string>>(new Set());

  const recognitionRef = useRef<any>(null);
  const recitePageWordsRef = useRef<ReciteWord[]>([]);
  const reciteWordPosRef = useRef(0);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const reciteUnlockedWordsRef = useRef<Set<string>>(new Set());

  reciteUnlockedWordsRef.current = reciteUnlockedWords;

  // Reset reveals when page changes
  useEffect(() => {
    setRevealedVerseKeys(new Set());
    setTappedAyah(null);
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

  // Chapters for surah jump
  const { data: chaptersData } = useQuery({
    queryKey: ["chapters"],
    queryFn: fetchAllChapters,
    staleTime: Infinity,
  });
  const chapters = chaptersData?.chapters ?? [];

  // Memorization data for marking
  const { data: memData } = useQuery({
    queryKey: ["memorization", childId],
    queryFn: () => listMemorization(parseInt(childId, 10)),
    staleTime: 30000,
  });

  const markMutation = useMutation({
    mutationFn: async () => {
      const bySurah = new Map<number, number[]>();
      for (const vk of selectedVerseKeys) {
        const parts = vk.split(":");
        const s = parseInt(parts[0], 10);
        const v = parseInt(parts[1], 10);
        if (!bySurah.has(s)) bySurah.set(s, []);
        bySurah.get(s)!.push(v);
      }
      for (const [surahId, newAyahs] of bySurah) {
        const existing =
          memData?.progress?.find((p) => p.surahId === surahId)?.memorizedAyahs ?? [];
        const merged = Array.from(new Set([...existing, ...newAyahs])).sort((a, b) => a - b);
        await updateMemorization(parseInt(childId, 10), {
          surahId,
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

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = pageContentRef.current;
      if (!el) return;
      el.style.fontSize = "";
      if (el.scrollHeight <= el.offsetHeight + 4) return;
      const MIN = 0.82;
      const STEP = 0.01;
      let size = 1.0;
      while (el.scrollHeight > el.offsetHeight + 4 && size > MIN) {
        size -= STEP;
        el.style.fontSize = size + "em";
      }
    });
  }, [lineGroups]);

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

      const SR =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

      const pv = verses.find((v) => v.verse_key === lw.verse_key);
      setTappedAyah({
        verseKey: lw.verse_key,
        surahId: lw.surahId,
        verseNum: lw.verseNum,
        text_uthmani: pv?.text_uthmani ?? "",
      });
    },
    [isReciting, isRecitePickMode, isSelectMode, isBlindMode, verses, startReciting]
  );

  return (
    <div className="min-h-screen bg-[#fdf8f0] pb-20">
      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-amber-100 shadow-sm">
        {/* Title row */}
        <div className="max-w-2xl mx-auto px-4 pt-2.5 pb-1.5 flex items-center gap-2">
          <button
            onClick={() =>
              window.history.length > 1
                ? window.history.back()
                : setLocation(`/child/${childId}/memorization`)
            }
            className="flex items-center gap-1 text-amber-700 text-sm shrink-0"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className="text-sm font-semibold text-amber-900 truncate">Full Quran</p>
            <p className="text-xs text-amber-400 truncate">
              {currentSurahName || "Loading…"} · p.{currentPage}
            </p>
          </div>

          {/* Blind mode */}
          <button
            onClick={() => {
              setIsBlindMode((b) => !b);
              setRevealedVerseKeys(new Set());
            }}
            title={isBlindMode ? "Blind mode on" : "Blind mode off"}
            className={cn(
              "p-2 rounded-lg border text-xs transition-colors shrink-0",
              isBlindMode
                ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-gray-200 text-gray-400 hover:text-gray-600"
            )}
          >
            {isBlindMode ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>

          {/* Select mode */}
          <button
            onClick={() => {
              setIsSelectMode((s) => !s);
              setSelectedVerseKeys(new Set());
            }}
            title={isSelectMode ? "Select mode on" : "Select mode off"}
            className={cn(
              "p-2 rounded-lg border text-xs transition-colors shrink-0",
              isSelectMode
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-400 hover:text-gray-600"
            )}
          >
            {isSelectMode ? <CheckCircle size={15} /> : <Circle size={15} />}
          </button>

          {/* Recite mode */}
          <button
            onClick={() => {
              if (isReciting) {
                stopReciting();
              } else {
                setIsRecitePickMode((p) => !p);
              }
            }}
            title={isReciting ? "Stop reciting" : isRecitePickMode ? "Cancel recite" : "Recite mode"}
            className={cn(
              "p-2 rounded-lg border text-xs transition-colors shrink-0",
              isReciting || isRecitePickMode
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-gray-200 text-gray-400 hover:text-gray-600"
            )}
          >
            {isReciting ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        </div>

        {/* Nav controls row */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {chapters.length > 0 ? (
              <Select onValueChange={handleSurahJump}>
                <SelectTrigger className="h-8 text-xs border-amber-200 bg-amber-50">
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
            ) : (
              <Skeleton className="h-8 rounded-md" />
            )}
          </div>

          <div className="flex items-center gap-1 border border-amber-200 rounded-md bg-amber-50 px-2 h-8 shrink-0">
            <span className="text-xs text-amber-500">p.</span>
            <input
              type="number"
              min={1}
              max={TOTAL_PAGES}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={handlePageInput}
              placeholder={String(currentPage)}
              className="w-12 text-xs bg-transparent outline-none text-amber-900 placeholder:text-amber-300"
            />
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4">
        <div
          className="rounded-xl border border-amber-200 shadow-md overflow-hidden"
          style={{
            background: "linear-gradient(to bottom, #fdf8f0, #faf3e8)",
            boxShadow: "0 4px 24px rgba(139,90,43,0.08), inset 0 0 40px rgba(200,160,80,0.04)",
          }}
        >
          {/* Top page label */}
          <div className="text-center py-2.5 border-b border-amber-100/60">
            <span className="text-xs text-amber-400 tracking-widest">
              صفحة {currentPage}
            </span>
          </div>

          {/* Mushaf text area */}
          <div
            ref={pageContentRef}
            dir="rtl"
            lang="ar"
            style={{
              fontFamily: '"Scheherazade New", "Amiri Quran", serif',
              fontSize: "clamp(15px, 2.3vw, 24px)",
              lineHeight: 2.2,
              padding: "20px 20px 12px",
              color: "#1a1a1a",
              minHeight: "60vh",
            }}
          >
            {isLoading && (
              <div className="space-y-4 pt-4">
                {Array.from({ length: 15 }, (_, i) => (
                  <Skeleton key={i} className="h-6 w-full rounded" />
                ))}
              </div>
            )}

            {isError && (
              <p className="text-center text-amber-700 text-sm py-12">
                Failed to load page. Please check your connection.
              </p>
            )}

            {/* ── Line-based rendering ── */}
            {!isLoading && !isError && lineGroups && (() => {
              const nodes: React.ReactNode[] = [];
              const seenSurahIds = new Set<number>();

              for (const { lineNum, words: lws } of lineGroups) {
                // Inject surah headers before first appearance of a surah that starts on this page
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
                    <div
                      key={`hdr-${sid}`}
                      style={{ textAlign: "center", margin: "10px 0 4px", direction: "rtl" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            height: 1,
                            background: "#d4b98a",
                            maxWidth: 60,
                            display: "block",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: '"Scheherazade New", serif',
                            fontSize: "0.9em",
                            color: "#5a3e1b",
                            fontWeight: 500,
                          }}
                        >
                          {sc?.name_arabic ?? `سُورَة ${sid}`}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            height: 1,
                            background: "#d4b98a",
                            maxWidth: 60,
                            display: "block",
                          }}
                        />
                      </div>
                      {sid !== 9 && (
                        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 2px" }}>
                          <span style={{ fontFamily: '"Scheherazade New", serif', fontSize: "1.1em", color: "#6b5830", direction: "rtl" }}>
                            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                          </span>
                        </div>
                      )}
                    </div>
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
                                : "1.5px solid #b8974a",
                              background: isSelected ? "#dcfce7" : "#fdf8ee",
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
                                color: isSelected ? "#16a34a" : "#8a6020",
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
                      const isBlurred =
                        isBlindMode && !revealedVerseKeys.has(lw.verse_key);
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
                  const isBlurred =
                    isBlindMode && !revealedVerseKeys.has(v.verse_key);
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
          </div>

          {/* Bottom page number */}
          <div className="text-center py-3 border-t border-amber-100/60">
            <span className="text-sm text-amber-600 font-medium tabular-nums">{currentPage}</span>
          </div>
        </div>

        {/* ── RTL navigation: left = next page, right = prev page ── */}
        <div className="flex items-center justify-between mt-5 gap-4">
          <Button
            variant="outline"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= TOTAL_PAGES || isReciting}
            className="flex items-center gap-1 border-amber-300 text-amber-800 hover:bg-amber-50 bg-white"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline text-xs">Next</span>
          </Button>

          <div className="text-center">
            <p className="text-sm font-medium text-amber-900 tabular-nums">
              {currentPage}{" "}
              <span className="text-amber-400 text-xs font-normal">/ {TOTAL_PAGES}</span>
            </p>
            <div className="mt-1.5 h-1 w-28 bg-amber-100 rounded-full overflow-hidden mx-auto">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${(currentPage / TOTAL_PAGES) * 100}%` }}
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || isReciting}
            className="flex items-center gap-1 border-amber-300 text-amber-800 hover:bg-amber-50 bg-white"
          >
            <span className="hidden sm:inline text-xs">Prev</span>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* ── Floating "Mark as memorized" button ── */}
      {isSelectMode && selectedVerseKeys.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center z-30 px-4 pointer-events-none">
          <button
            onClick={() => markMutation.mutate()}
            disabled={markMutation.isPending}
            className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-xl pointer-events-auto active:bg-emerald-700 disabled:opacity-70"
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
        <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
          <div className="bg-white rounded-xl shadow-xl border border-rose-200 px-5 py-3 pointer-events-auto flex items-center gap-4">
            <p className="text-sm font-medium text-gray-800">
              Tap an ayah to start reciting from there
            </p>
            <button
              onClick={() => setIsRecitePickMode(false)}
              className="text-sm text-rose-600 font-semibold shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Stop reciting button ── */}
      {isReciting && (
        <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
          <button
            onClick={stopReciting}
            className="flex items-center gap-2 bg-rose-600 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-xl pointer-events-auto active:bg-rose-700"
          >
            <MicOff size={15} /> Stop Reciting
          </button>
        </div>
      )}

      {/* ── Ayah bottom sheet ── */}
      {tappedAyah && (
        <AyahSheet
          key={tappedAyah.verseKey}
          ayah={tappedAyah}
          childId={childId}
          onClose={() => setTappedAyah(null)}
        />
      )}

      <ChildNav childId={childId} />
    </div>
  );
}
