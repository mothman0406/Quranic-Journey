import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChildNav } from "@/components/child-nav";
import { RECITERS, type Reciter } from "@/components/verse-player";
import {
  ChevronLeft,
  Play,
  Pause,
  Loader2,
  Search,
  SkipBack,
  SkipForward,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const QURAN_API = "https://api.quran.com/api/v4";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name: { name: string };
  verses_count: number;
  bismillah_pre: boolean;
}

interface VerseData {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
}

type Segment = [number, number, number]; // [wordIndex1based, startFrac, endFrac]

interface Bookmark {
  surahId: number;
  surahName: string;
  from: number;
  to: number;
  currentAyah: number;
  repeatCount: number;
  autoAdvance: boolean;
  savedAt: number;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchAllChapters(): Promise<{ chapters: Chapter[] }> {
  const r = await fetch(`${QURAN_API}/chapters?language=en`);
  if (!r.ok) throw new Error("Failed to fetch chapters");
  return r.json();
}

async function fetchVersesBySurah(
  surahId: number
): Promise<{ verses: VerseData[] }> {
  const r = await fetch(
    `${QURAN_API}/verses/by_chapter/${surahId}?fields=text_uthmani&per_page=300`
  );
  if (!r.ok) throw new Error(`Failed to fetch surah ${surahId}`);
  return r.json();
}

// ─── Audio utilities (mirrors verse-player.tsx logic) ────────────────────────

const ARABIC_LETTER_RE = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3]/;

function isQuranWord(token: string): boolean {
  return ARABIC_LETTER_RE.test(token);
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function buildAudioUrl(reciter: Reciter, surah: number, verse: number): string {
  return `https://everyayah.com/data/${reciter.folder}/${pad(surah, 3)}${pad(verse, 3)}.mp3`;
}

async function fetchWordTimingV4(
  quranComId: number,
  surah: number,
  verse: number
): Promise<Segment[]> {
  try {
    const res = await fetch(
      `${QURAN_API}/recitations/${quranComId}/by_ayah/${surah}:${verse}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const segs: Array<[number, number, number]> =
      data.audio_files?.[0]?.segments;
    if (!Array.isArray(segs) || segs.length === 0) return [];
    const last = segs[segs.length - 1];
    const span = last[2];
    if (span <= 0) return segs;
    return segs.map((s) => [s[0], s[1] / span, s[2] / span] as Segment);
  } catch {
    return [];
  }
}

const qdcCache = new Map<string, Promise<Map<string, Segment[]>>>();

function fetchQdcChapterTimings(
  qdcId: number,
  surah: number
): Promise<Map<string, Segment[]>> {
  const key = `${qdcId}:${surah}`;
  const cached = qdcCache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<Map<string, Segment[]>> => {
    try {
      const res = await fetch(
        `https://api.qurancdn.com/api/qdc/audio/reciters/${qdcId}/audio_files?chapter=${surah}&segments=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return new Map();
      const data = await res.json();
      const timings = data.audio_files?.[0]?.verse_timings;
      if (!Array.isArray(timings)) return new Map();

      const result = new Map<string, Segment[]>();
      for (const vt of timings) {
        const offset: number = vt.timestamp_from;
        const verseDur: number = vt.timestamp_to - offset;
        if (verseDur <= 0) continue;
        const raw: Segment[] = (vt.segments || []).map(
          (s: [number, number, number]) =>
            [
              s[0],
              (s[1] - offset) / verseDur,
              (s[2] - offset) / verseDur,
            ] as Segment
        );
        const segs: Segment[] = [];
        for (const seg of raw) {
          if (segs.length > 0 && segs[segs.length - 1][0] === seg[0]) continue;
          segs.push(seg);
        }
        for (let i = 0; i < segs.length - 1; i++) {
          if (segs[i][2] > segs[i + 1][1]) {
            segs[i] = [segs[i][0], segs[i][1], segs[i + 1][1]];
          }
        }
        result.set(vt.verse_key, segs);
      }
      return result;
    } catch {
      return new Map();
    }
  })();

  qdcCache.set(key, promise);
  return promise;
}

async function fetchWordTiming(
  reciter: Reciter,
  surah: number,
  verse: number
): Promise<Segment[]> {
  if (reciter.qdcId !== null) {
    const map = await fetchQdcChapterTimings(reciter.qdcId, surah);
    return map.get(`${surah}:${verse}`) ?? [];
  }
  if (reciter.quranComId !== null) {
    return fetchWordTimingV4(reciter.quranComId, surah, verse);
  }
  return [];
}

// ─── Bookmark helpers ─────────────────────────────────────────────────────────

function bookmarkKey(childId: string) {
  return `noorpath-memorize-${childId}`;
}

function loadBookmark(childId: string): Bookmark | null {
  try {
    const raw = localStorage.getItem(bookmarkKey(childId));
    return raw ? (JSON.parse(raw) as Bookmark) : null;
  } catch {
    return null;
  }
}

function saveBookmark(childId: string, b: Bookmark): void {
  try {
    localStorage.setItem(bookmarkKey(childId), JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

// ─── useVerseAudio hook ───────────────────────────────────────────────────────

function useVerseAudio({
  surahNumber,
  verseNumber,
  arabic,
  reciter,
  totalRepeats,
  onAllRepeatsDone,
}: {
  surahNumber: number;
  verseNumber: number;
  arabic: string;
  reciter: Reciter;
  totalRepeats: number;
  onAllRepeatsDone: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const segmentsRef = useRef<Segment[]>([]);
  const currentRepeatRef = useRef(1);
  const onDoneRef = useRef(onAllRepeatsDone);
  onDoneRef.current = onAllRepeatsDone;
  const totalRepeatsRef = useRef(totalRepeats);
  totalRepeatsRef.current = totalRepeats;

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [currentRepeat, setCurrentRepeat] = useState(1);
  const [highlightedWord, setHighlightedWord] = useState(-1);

  const words = useMemo(() => arabic.split(/\s+/).filter(Boolean), [arabic]);

  const qdcToDisplay = useMemo(() => {
    const map = new Map<number, number>();
    let qdcIdx = 1;
    for (let i = 0; i < words.length; i++) {
      if (isQuranWord(words[i])) {
        map.set(qdcIdx, i);
        qdcIdx++;
      }
    }
    return map;
  }, [words]);

  // Cleanup when verse / reciter changes
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    segmentsRef.current = [];
    currentRepeatRef.current = 1;
    setCurrentRepeat(1);
    setPlaying(false);
    setHighlightedWord(-1);
    setError(false);
    setLoading(false);
  }, [surahNumber, verseNumber, reciter.id]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const updateHighlight = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const dur = audio.duration || 0;
    const frac = dur > 0 ? audio.currentTime / dur : 0;
    const segs = segmentsRef.current;

    if (segs.length > 0) {
      let found = -1;
      for (const [wordIdx, startFrac, endFrac] of segs) {
        if (frac >= startFrac && frac < endFrac) {
          found = qdcToDisplay.get(wordIdx) ?? -1;
          break;
        }
      }
      if (found === -1 && frac > 0) {
        const last = segs[segs.length - 1];
        if (last && frac >= last[1]) {
          found = qdcToDisplay.get(last[0]) ?? words.length - 1;
        }
      }
      setHighlightedWord(found);
    } else {
      setHighlightedWord(
        Math.min(Math.floor(frac * words.length), words.length - 1)
      );
    }

    rafRef.current = requestAnimationFrame(updateHighlight);
  }, [words.length, qdcToDisplay]);

  const play = useCallback(async () => {
    // Toggle pause
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    // Resume a paused audio element
    if (
      !playing &&
      audioRef.current &&
      audioRef.current.src &&
      !audioRef.current.ended
    ) {
      try {
        await audioRef.current.play();
        setPlaying(true);
        rafRef.current = requestAnimationFrame(updateHighlight);
      } catch {
        setError(true);
      }
      return;
    }

    // Create fresh audio element
    setLoading(true);
    setError(false);

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";

    audio.onended = () => {
      if (currentRepeatRef.current < totalRepeatsRef.current) {
        currentRepeatRef.current++;
        setCurrentRepeat(currentRepeatRef.current);
        cancelAnimationFrame(rafRef.current);
        audio.currentTime = 0;
        audio
          .play()
          .then(() => {
            rafRef.current = requestAnimationFrame(updateHighlight);
          })
          .catch(() => {
            setError(true);
            setPlaying(false);
          });
      } else {
        setPlaying(false);
        setHighlightedWord(-1);
        cancelAnimationFrame(rafRef.current);
        currentRepeatRef.current = 1;
        setCurrentRepeat(1);
        onDoneRef.current();
      }
    };

    audio.onerror = () => {
      setError(true);
      setLoading(false);
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };

    audio.src = buildAudioUrl(reciter, surahNumber, verseNumber);
    audioRef.current = audio;

    // Fetch word timing in parallel (non-blocking)
    fetchWordTiming(reciter, surahNumber, verseNumber).then((segs) => {
      segmentsRef.current = segs;
    });

    try {
      await audio.play();
      setPlaying(true);
      setLoading(false);
      rafRef.current = requestAnimationFrame(updateHighlight);
    } catch {
      setError(true);
      setLoading(false);
      setPlaying(false);
    }
  }, [playing, reciter, surahNumber, verseNumber, updateHighlight]);

  return { playing, loading, error, currentRepeat, highlightedWord, words, play };
}

// ─── MemorizationPlayer ───────────────────────────────────────────────────────
// Extracted as its own component so its hooks only run when mounted (play phase).

interface PlayerProps {
  childId: string;
  chapter: Chapter;
  verses: VerseData[];
  versesLoading: boolean;
  fromAyah: number;
  toAyah: number;
  repeatCount: number;
  initialAyah: number;
  initialAutoAdvance: boolean;
  onBack: () => void;
}

function MemorizationPlayer({
  childId,
  chapter,
  verses,
  versesLoading,
  fromAyah,
  toAyah,
  repeatCount,
  initialAyah,
  initialAutoAdvance,
  onBack,
}: PlayerProps) {
  const reciter = RECITERS.find((r) => r.id === "husary")!;

  const [currentAyahNum, setCurrentAyahNum] = useState(initialAyah);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(initialAutoAdvance);

  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const currentAyahNumRef = useRef(currentAyahNum);
  currentAyahNumRef.current = currentAyahNum;
  const toAyahRef = useRef(toAyah);
  toAyahRef.current = toAyah;
  const playRef = useRef<(() => Promise<void>) | null>(null);

  const currentVerse = verses.find((v) => v.verse_number === currentAyahNum);
  const currentArabic = currentVerse?.text_uthmani ?? "";

  // Save bookmark whenever the current ayah changes
  useEffect(() => {
    saveBookmark(childId, {
      surahId: chapter.id,
      surahName: chapter.name_simple,
      from: fromAyah,
      to: toAyah,
      currentAyah: currentAyahNum,
      repeatCount,
      autoAdvance,
      savedAt: Date.now(),
    });
  }, [childId, chapter, fromAyah, toAyah, currentAyahNum, repeatCount, autoAdvance]);

  const handleAllRepeatsDone = useCallback(() => {
    if (autoAdvanceRef.current && currentAyahNumRef.current < toAyahRef.current) {
      setPendingAutoPlay(true);
      setCurrentAyahNum((n) => n + 1);
    }
  }, []);

  const { playing, loading, error, currentRepeat, highlightedWord, words, play } =
    useVerseAudio({
      surahNumber: chapter.id,
      verseNumber: currentAyahNum,
      arabic: currentArabic,
      reciter,
      totalRepeats: repeatCount,
      onAllRepeatsDone: handleAllRepeatsDone,
    });

  // Keep playRef up to date on every render without triggering effects
  playRef.current = play;

  // After auto-advancing to next ayah, start playback once the hook has reset
  useEffect(() => {
    if (!pendingAutoPlay) return;
    setPendingAutoPlay(false);
    const timer = setTimeout(() => {
      playRef.current?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [currentAyahNum, pendingAutoPlay]);

  const rangeLength = toAyah - fromAyah + 1;
  const currentIndexInRange = currentAyahNum - fromAyah;
  const progressPercent =
    rangeLength > 1 ? (currentIndexInRange / (rangeLength - 1)) * 100 : 100;

  const goNext = () => {
    if (currentAyahNum < toAyah) setCurrentAyahNum((n) => n + 1);
  };
  const goPrev = () => {
    if (currentAyahNum > fromAyah) setCurrentAyahNum((n) => n - 1);
  };

  const showBismillah =
    currentAyahNum === 1 && chapter.id !== 1 && chapter.id !== 9;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="pattern-bg text-white px-4 pt-8 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-emerald-200 text-sm"
            >
              <ChevronLeft size={16} /> Settings
            </button>
            <div className="text-right">
              <p className="text-emerald-200/70 text-[10px] uppercase tracking-wide">
                Ayah
              </p>
              <p className="text-2xl font-bold leading-none">{currentAyahNum}</p>
              <p className="text-emerald-200/60 text-xs">
                {fromAyah}–{toAyah}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold leading-tight">
                {chapter.name_simple}
              </h1>
              <p className="text-emerald-200 text-xs">
                {chapter.translated_name?.name}
              </p>
            </div>
            <span className="arabic-text text-3xl text-amber-300">
              {chapter.name_arabic}
            </span>
          </div>

          {/* Range progress bar */}
          <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-300 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-emerald-200/60 text-xs mt-1">
            {currentIndexInRange + 1} of {rangeLength} ayahs
          </p>
        </div>
      </div>

      {/* Arabic text area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 max-w-lg mx-auto w-full">
        {versesLoading || !currentArabic ? (
          <div className="w-full space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-4/5 rounded-xl mx-auto" />
            <Skeleton className="h-10 w-3/5 rounded-xl mx-auto" />
          </div>
        ) : (
          <>
            {showBismillah && (
              <p className="arabic-text text-2xl text-primary/50 text-center mb-6 leading-loose">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </p>
            )}

            <div
              className="arabic-text text-4xl leading-[2.2] text-right select-none w-full"
              dir="rtl"
              lang="ar"
            >
              {words.map((word, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-block transition-all duration-100 rounded-md px-0.5 mx-0.5",
                    highlightedWord === i
                      ? "bg-amber-300 text-amber-900 scale-110 shadow-sm"
                      : playing && highlightedWord > i
                        ? "text-primary/40"
                        : "text-foreground"
                  )}
                >
                  {word}
                </span>
              ))}
            </div>

            <div className="flex justify-center mt-3">
              <span className="arabic-text text-xl text-primary/30">
                ﴿{currentAyahNum}﴾
              </span>
            </div>
          </>
        )}
      </div>

      {/* Player controls */}
      <div className="bg-white border-t border-border px-4 pt-3 pb-6">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Repeat dots */}
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: repeatCount }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i < currentRepeat
                    ? "bg-primary w-2.5 h-2.5"
                    : "bg-muted w-2 h-2",
                  i === currentRepeat - 1 && playing ? "scale-125 shadow-md" : ""
                )}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">
              {currentRepeat}/{repeatCount}
            </span>
          </div>

          {/* Prev / Play-Pause / Next */}
          <div className="flex items-center justify-center gap-5">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={currentAyahNum <= fromAyah}
              className="rounded-full w-11 h-11 p-0"
            >
              <SkipBack size={18} />
            </Button>

            <Button
              size="lg"
              onClick={play}
              disabled={loading || versesLoading || !currentArabic}
              className="rounded-full w-16 h-16 p-0 shadow-lg"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : playing ? (
                <Pause size={24} />
              ) : (
                <Play size={24} className="ml-1" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={currentAyahNum >= toAyah}
              className="rounded-full w-11 h-11 p-0"
            >
              <SkipForward size={18} />
            </Button>
          </div>

          {/* Auto-advance toggle + reciter label */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setAutoAdvance((a) => !a)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors",
                autoAdvance
                  ? "border-primary/30 text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <RotateCcw size={11} />
              Auto-advance {autoAdvance ? "on" : "off"}
            </button>

            <span className="text-xs text-muted-foreground/70 truncate max-w-[160px]">
              {reciter.fullName}
            </span>

            {error && (
              <span className="text-xs text-red-500">⚠ Audio unavailable</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuranMemorizePage() {
  const { childId } = useParams<{ childId: string }>();

  const [phase, setPhase] = useState<"pick" | "setup" | "play">("pick");
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(10);
  const [repeatCount, setRepeatCount] = useState(3);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [startAyah, setStartAyah] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: chaptersData, isLoading: chaptersLoading } = useQuery({
    queryKey: ["chapters"],
    queryFn: fetchAllChapters,
    staleTime: Infinity,
  });
  const chapters = chaptersData?.chapters ?? [];

  const { data: versesData, isLoading: versesLoading } = useQuery({
    queryKey: ["verses-by-surah", selectedChapter?.id],
    queryFn: () => fetchVersesBySurah(selectedChapter!.id),
    enabled: !!selectedChapter,
    staleTime: Infinity,
  });
  const verses = versesData?.verses ?? [];

  const bookmark = useMemo(() => loadBookmark(childId), [childId]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase();
    return chapters.filter(
      (ch) =>
        ch.name_simple.toLowerCase().includes(q) ||
        String(ch.id).includes(q) ||
        ch.translated_name?.name?.toLowerCase().includes(q)
    );
  }, [chapters, searchQuery]);

  const handleSelectChapter = (ch: Chapter) => {
    setSelectedChapter(ch);
    setFromAyah(1);
    setToAyah(Math.min(10, ch.verses_count));
    setPhase("setup");
  };

  const handleStartSession = () => {
    setStartAyah(fromAyah);
    setPhase("play");
  };

  const handleResumeBookmark = () => {
    if (!bookmark) return;
    const ch = chapters.find((c) => c.id === bookmark.surahId);
    if (!ch) return;
    setSelectedChapter(ch);
    setFromAyah(bookmark.from);
    setToAyah(bookmark.to);
    setRepeatCount(bookmark.repeatCount);
    setAutoAdvance(bookmark.autoAdvance);
    setStartAyah(bookmark.currentAyah);
    setPhase("play");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: PICK
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "pick") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg text-white px-4 pt-8 pb-12">
          <div className="max-w-lg mx-auto">
            <Link href={`/child/${childId}/memorize`}>
              <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
                <ChevronLeft size={16} /> Memorize
              </button>
            </Link>
            <h1 className="text-xl font-bold">Full Quran Memorize</h1>
            <p className="text-emerald-200 text-sm mt-1">
              Sheikh Mahmoud Khalil al-Husary · All 114 surahs
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          {bookmark && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs font-semibold text-amber-700">
                  Resume where you left off
                </p>
                <p className="text-sm font-medium text-amber-900 mt-0.5">
                  {bookmark.surahName} · Ayah {bookmark.currentAyah}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Range {bookmark.from}–{bookmark.to} · {bookmark.repeatCount}×
                  repeat
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleResumeBookmark}
                className="bg-amber-500 hover:bg-amber-600 text-white border-0 ml-3 flex-shrink-0"
              >
                Resume
              </Button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search size={16} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or number…"
                className="flex-1 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {chaptersLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredChapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleSelectChapter(ch)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {ch.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {ch.name_simple}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ch.translated_name?.name} · {ch.verses_count} ayahs
                      </p>
                    </div>
                    <span className="arabic-text text-lg text-primary flex-shrink-0">
                      {ch.name_arabic}
                    </span>
                  </button>
                ))}
                {filteredChapters.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No surahs found
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <ChildNav childId={childId} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: SETUP
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "setup") {
    if (!selectedChapter) return null;
    const maxAyah = selectedChapter.verses_count;

    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg text-white px-4 pt-8 pb-12">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setPhase("pick")}
              className="flex items-center gap-1 text-emerald-200 text-sm mb-4"
            >
              <ChevronLeft size={16} /> Choose Surah
            </button>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-emerald-200 text-xs font-medium mb-1">
                  Surah {selectedChapter.id}
                </p>
                <h1 className="text-2xl font-bold">
                  {selectedChapter.name_simple}
                </h1>
                <p className="text-emerald-200 text-sm mt-0.5">
                  {selectedChapter.translated_name?.name} · {maxAyah} ayahs
                </p>
              </div>
              <span className="arabic-text text-5xl text-amber-300">
                {selectedChapter.name_arabic}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          {/* Ayah range */}
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              Select Ayah Range
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">
                  From
                </label>
                <input
                  type="number"
                  min={1}
                  max={toAyah}
                  value={fromAyah}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(toAyah, parseInt(e.target.value) || 1)
                    );
                    setFromAyah(v);
                  }}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm text-center font-medium outline-none focus:border-primary"
                />
              </div>
              <span className="text-muted-foreground text-sm mt-5">–</span>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">
                  To
                </label>
                <input
                  type="number"
                  min={fromAyah}
                  max={maxAyah}
                  value={toAyah}
                  onChange={(e) => {
                    const v = Math.max(
                      fromAyah,
                      Math.min(maxAyah, parseInt(e.target.value) || fromAyah)
                    );
                    setToAyah(v);
                  }}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm text-center font-medium outline-none focus:border-primary"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Total
                </label>
                <div className="w-full border border-border/40 bg-muted/30 rounded-xl px-3 py-2 text-sm text-center font-medium text-muted-foreground">
                  {toAyah - fromAyah + 1}
                </div>
              </div>
            </div>
          </div>

          {/* Repeat count */}
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Repeat Each Ayah
              </h2>
              <Badge
                variant="outline"
                className="text-primary border-primary/30 font-bold text-sm px-3"
              >
                {repeatCount}×
              </Badge>
            </div>
            <Slider
              min={1}
              max={10}
              value={[repeatCount]}
              onValueChange={([v]) => setRepeatCount(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1×</span>
              <span>5×</span>
              <span>10×</span>
            </div>
          </div>

          {/* Auto-advance */}
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Auto-Advance
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Move to the next ayah automatically after{" "}
                  {repeatCount === 1 ? "1 play" : `${repeatCount} repeats`}
                </p>
              </div>
              <Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} />
            </div>
          </div>

          {/* Start */}
          <Button
            className="w-full h-12 text-base font-semibold rounded-2xl"
            onClick={handleStartSession}
            disabled={versesLoading}
          >
            {versesLoading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Loading verses…
              </>
            ) : (
              `Start — Ayah ${fromAyah}${fromAyah !== toAyah ? ` to ${toAyah}` : ""}`
            )}
          </Button>
        </div>

        <ChildNav childId={childId} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: PLAY — delegate entirely to MemorizationPlayer
  // ══════════════════════════════════════════════════════════════════════════

  if (!selectedChapter) return null;

  return (
    <MemorizationPlayer
      key={`${selectedChapter.id}-${fromAyah}-${toAyah}-${startAyah}`}
      childId={childId}
      chapter={selectedChapter}
      verses={verses}
      versesLoading={versesLoading}
      fromAyah={fromAyah}
      toAyah={toAyah}
      repeatCount={repeatCount}
      initialAyah={startAyah}
      initialAutoAdvance={autoAdvance}
      onBack={() => setPhase("setup")}
    />
  );
}
