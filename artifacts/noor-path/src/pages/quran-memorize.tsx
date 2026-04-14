import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CelebrationOverlay } from "@/components/celebration-overlay";
import { useParams, Link, useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMemorization } from "@workspace/api-client-react";
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
  ChevronsRight,
  RotateCcw,
  CheckCircle,
  Flag,
  EyeOff,
  Eye,
  Sun,
  Moon,
  Mic,
  MicOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/use-dark-mode";

// ─── Constants ────────────────────────────────────────────────────────────────

const QURAN_API = "https://api.quran.com/api/v4";

interface MushafThemeConfig {
  name: string;
  banner: string;
  bannerBorder: string;
  accent: string;
  parchment: string;
  textColor?: string;
}

const MUSHAF_THEMES = {
  teal: {
    name: "Madinah",
    banner: "#1a4a5c",
    bannerBorder: "#c9a84c",
    accent: "#c9a84c",
    parchment: "#fdf6e3",
  },
  maroon: {
    name: "Ottoman",
    banner: "#4a1a2c",
    bannerBorder: "#d4a843",
    accent: "#d4a843",
    parchment: "#fdf0e0",
  },
  navy: {
    name: "Modern",
    banner: "#1a2a4a",
    bannerBorder: "#a8b8c8",
    accent: "#a8b8c8",
    parchment: "#f8f6f2",
  },
  forest: {
    name: "Classic",
    banner: "#0d2b1a",
    bannerBorder: "#c9a84c",
    accent: "#c9a84c",
    parchment: "#fdf6e3",
  },
  madinah_dark: {
    name: "Madinah Night",
    banner: "#0d2b38",
    bannerBorder: "#c9a84c",
    accent: "#c9a84c",
    parchment: "#1a1a2e",
    textColor: "#e8d5b0",
  },
  ottoman_dark: {
    name: "Ottoman Night",
    banner: "#2b0d1a",
    bannerBorder: "#d4a843",
    accent: "#d4a843",
    parchment: "#1a1208",
    textColor: "#e8d5b0",
  },
  modern_dark: {
    name: "Modern Night",
    banner: "#0d1a2b",
    bannerBorder: "#a8b8c8",
    accent: "#a8b8c8",
    parchment: "#0f0f1a",
    textColor: "#dde8f0",
  },
  classic_dark: {
    name: "Classic Night",
    banner: "#0d1a0d",
    bannerBorder: "#c9a84c",
    accent: "#c9a84c",
    parchment: "#0d1308",
    textColor: "#e8d5b0",
  },
} satisfies Record<string, MushafThemeConfig>;

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
  text_uthmani_tajweed?: string;
  page_number?: number;
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
  cumulativeReview?: boolean;
  reviewRepeatCount?: number;
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
    `${QURAN_API}/verses/by_chapter/${surahId}?fields=text_uthmani,text_uthmani_tajweed,page_number&per_page=300`
  );
  if (!r.ok) throw new Error(`Failed to fetch surah ${surahId}`);
  return r.json();
}

interface PageVerseData {
  verse_key: string;
  text_uthmani: string;
  text_uthmani_tajweed?: string;
}

async function fetchVersesByPage(
  pageNumber: number
): Promise<{ verses: PageVerseData[] }> {
  const r = await fetch(
    `${QURAN_API}/verses/by_page/${pageNumber}?fields=text_uthmani,text_uthmani_tajweed&per_page=50`
  );
  if (!r.ok) throw new Error(`Failed to fetch page ${pageNumber}`);
  const data = await r.json();
  console.log("[fetchVersesByPage] first verse first word:", data?.verses?.[0]?.words?.[0]);
  return data;
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

  const skipRepeat = useCallback(() => {
    const audio = audioRef.current;
    if (currentRepeatRef.current < totalRepeatsRef.current) {
      currentRepeatRef.current++;
      setCurrentRepeat(currentRepeatRef.current);
      if (audio) {
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
      }
    } else {
      // On the last repeat — treat as all repeats done
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlaying(false);
      setHighlightedWord(-1);
      cancelAnimationFrame(rafRef.current);
      currentRepeatRef.current = 1;
      setCurrentRepeat(1);
      onDoneRef.current();
    }
  }, [updateHighlight]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setHighlightedWord(-1);
    currentRepeatRef.current = 1;
    setCurrentRepeat(1);
  }, []);

  return { playing, loading, error, currentRepeat, highlightedWord, words, play, skipRepeat, stopAudio };
}

// ─── Tajweed helpers ──────────────────────────────────────────────────────────

// Standard Quran.com tajweed class → color mapping, scoped to .mushaf-page.
const TAJWEED_CSS = `
.mushaf-page .ham_wasl          { color: #AAAAAA; }
.mushaf-page .slnt              { color: #AAAAAA; }
.mushaf-page .lam_shamsiyya     { color: #AAAAAA; }
.mushaf-page .madda_normal      { color: #537FFF; }
.mushaf-page .madda_permissible { color: #4050FF; }
.mushaf-page .madda_necessary   { color: #000EBC; }
.mushaf-page .madda_obligatory  { color: #000EBC; }
.mushaf-page .qalaqah           { color: #DD0008; }
.mushaf-page .ikhafa_shafawi    { color: #D500B7; }
.mushaf-page .ikhafa            { color: #FF7E1E; }
.mushaf-page .idgham_ghunna        { color: #169200; }
.mushaf-page .idgham_wo_ghunna     { color: #169200; }
.mushaf-page .idgham_mutajanisayn  { color: #169200; }
.mushaf-page .idgham_mutaqaribain  { color: #169200; }
.mushaf-page .idgham_shafawi       { color: #169200; }
.mushaf-page .iqlab             { color: #26BFFD; }
.mushaf-page .ghunna            { color: #169200; }
@keyframes recite-word-pulse {
  0%, 100% { box-shadow: 0 2px 0 #22c55e; opacity: 1; }
  50%       { box-shadow: 0 3px 8px #22c55e99; opacity: 0.85; }
}
`;


// Strip Arabic diacritics (tashkeel) and normalize letter variants for fuzzy
// speech-recognition matching.
const stripTashkeel = (s: string): string =>
  s
    .replace(/\u0670/g, "ا")  // dagger alif → regular alif (must run before diacritic strip)
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "") // strip tashkeel (u0670 excluded — handled above)
    .replace(/[ـ]/g, "")      // remove tatweel (kashida)
    .replace(/[\uFB50-\uFDFF]/g, (c) => c.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")) // normalize Arabic presentation forms
    .replace(/[أإآاٱ]/g, "ا")  // normalize all alef variants to plain alef
    .replace(/ى/g, "ي")       // alef maqsura → ya
    .replace(/ة/g, "ه")       // ta marbuta → ha
    .replace(/ؤ/g, "و")       // waw with hamza → waw
    .replace(/ئ/g, "ي")       // ya with hamza → ya
    .replace(/[^\u0600-\u06FF\s]/g, "") // remove anything not standard Arabic
    .replace(/^ال/, "")        // strip definite article from start of word
    .trim();


// Strip trailing verse-end glyph (۝) and Arabic-Indic digits (٠-٩) from Uthmani text.
const stripVerseEnd = (s: string): string => s.replace(/[\u06DD\u0660-\u0669\s]+$/, "").trimEnd();
// Same for tajweed HTML — handles both bare text nodes and span-wrapped digits at the end.
const stripVerseEndHtml = (html: string): string =>
  html
    .replace(/(<span[^>]*>[\u06DD\u0660-\u0669\s]+<\/span>\s*)+$/, "")
    .replace(/[\u06DD\u0660-\u0669\s]+$/, "")
    .trimEnd();

// Split tajweed HTML into per-word chunks.
// Words in tajweed HTML are separated by whitespace that falls between a closing >
// and an opening < — i.e. between span elements, never inside attribute values.
function splitTajweedIntoWords(html: string): string[] {
  if (!html) return [];
  return html.split(/(?<=>)\s+(?=<)/).filter((s) => s.length > 0);
}

// ─── MemorizationPlayer ───────────────────────────────────────────────────────
// Extracted as its own component so its hooks only run when mounted (play phase).

interface PlayerProps {
  childId: string;
  chapter: Chapter;
  allChapters: Chapter[];
  verses: VerseData[];
  versesLoading: boolean;
  fromAyah: number;
  toAyah: number;
  repeatCount: number;
  initialAyah: number;
  initialAutoAdvance: boolean;
  cumulativeReview: boolean;
  reviewRepeatCount: number;
  onBack: () => void;
  onSessionComplete: () => void;
  onPauseAndSave: (completedToAyah: number) => void;
  triggerReciteMode?: boolean;
  onReciteTriggered?: () => void;
  onReciteComplete?: (score: number) => void;
}

function MemorizationPlayer({
  childId,
  chapter,
  allChapters,
  verses,
  versesLoading,
  fromAyah,
  toAyah,
  repeatCount,
  initialAyah,
  initialAutoAdvance,
  cumulativeReview,
  reviewRepeatCount,
  onBack,
  onSessionComplete,
  onPauseAndSave,
  triggerReciteMode,
  onReciteTriggered,
  onReciteComplete,
}: PlayerProps) {
  const reciter = RECITERS.find((r) => r.id === "husary")!;

  const [currentAyahNum, setCurrentAyahNum] = useState(initialAyah);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(initialAutoAdvance);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseToAyah, setPauseToAyah] = useState(initialAyah);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [revealedAyahs, setRevealedAyahs] = useState<Set<number>>(new Set());
  const [isReciteMode, setIsReciteMode] = useState(false);
  const [reciteWordIndex, setReciteWordIndex] = useState(0);
  const [reciteVerseIndex, setReciteVerseIndex] = useState(0);
  const [reciteAttempts, setReciteAttempts] = useState(0);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const recognitionRef = useRef<any>(null);
  const reciteWordIndexRef = useRef(0);
  const reciteVerseIndexRef = useRef(0);
  const isReciteModeRef = useRef(false);
  const matchedWordCountRef = useRef(0);
  const [mushafTheme, setMushafThemeState] = useState<keyof typeof MUSHAF_THEMES>(() => {
    try {
      const saved = localStorage.getItem("mushaf-theme");
      const darkNow = localStorage.getItem("noor-dark-mode") === "true";
      const isDarkKey = (k: string) => k.endsWith("_dark");
      if (saved && saved in MUSHAF_THEMES && isDarkKey(saved) === darkNow) {
        return saved as keyof typeof MUSHAF_THEMES;
      }
      return darkNow ? "madinah_dark" : "teal";
    } catch { return "teal"; }
  });

  // Auto-switch theme when dark mode toggles
  useEffect(() => {
    const isThemeDark = mushafTheme.endsWith("_dark");
    if (isDarkMode && !isThemeDark) {
      setMushafThemeState("madinah_dark");
      try { localStorage.setItem("mushaf-theme", "madinah_dark"); } catch { /* ignore */ }
    } else if (!isDarkMode && isThemeDark) {
      setMushafThemeState("teal");
      try { localStorage.setItem("mushaf-theme", "teal"); } catch { /* ignore */ }
    }
  }, [isDarkMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const theme = MUSHAF_THEMES[mushafTheme] as MushafThemeConfig;
  const setMushafTheme = (t: keyof typeof MUSHAF_THEMES) => {
    try { localStorage.setItem("mushaf-theme", t); } catch { /* ignore */ }
    setMushafThemeState(t);
  };

  // Cumulative review state
  type InternalPhase = "single" | "cumulative";
  const [internalPhase, setInternalPhase] = useState<InternalPhase>("single");
  const [cumAyahIdx, setCumAyahIdx] = useState(0); // 0-based index within fromAyah..cumUpTo
  const [cumPass, setCumPass] = useState(1);
  const [cumUpTo, setCumUpTo] = useState(initialAyah);

  // Refs for stale-closure-safe access inside callbacks
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const currentAyahNumRef = useRef(currentAyahNum);
  currentAyahNumRef.current = currentAyahNum;
  const toAyahRef = useRef(toAyah);
  toAyahRef.current = toAyah;
  const fromAyahRef = useRef(fromAyah);
  fromAyahRef.current = fromAyah;
  const internalPhaseRef = useRef<InternalPhase>("single");
  internalPhaseRef.current = internalPhase;
  const cumAyahIdxRef = useRef(0);
  cumAyahIdxRef.current = cumAyahIdx;
  const cumPassRef = useRef(1);
  cumPassRef.current = cumPass;
  const cumUpToRef = useRef(initialAyah);
  cumUpToRef.current = cumUpTo;
  const cumulativeReviewRef = useRef(cumulativeReview);
  cumulativeReviewRef.current = cumulativeReview;
  const reviewRepeatCountRef = useRef(reviewRepeatCount);
  reviewRepeatCountRef.current = reviewRepeatCount;

  reciteWordIndexRef.current = reciteWordIndex;
  reciteVerseIndexRef.current = reciteVerseIndex;
  isReciteModeRef.current = isReciteMode;

  const onSessionCompleteRef = useRef(onSessionComplete);
  onSessionCompleteRef.current = onSessionComplete;

  const playRef = useRef<(() => Promise<void>) | null>(null);
  const currentVerseRef = useRef<HTMLSpanElement>(null);
  // 0 = play immediately (cumulative flow); 150 = wait for hook reset (single-ayah advance)
  const pendingPlayDelayRef = useRef(150);

  // Derive the verse number and repeat count the audio hook should use
  const activeVerseNumber =
    internalPhase === "single" ? currentAyahNum : fromAyah + cumAyahIdx;
  const activeTotalRepeats = internalPhase === "single" ? repeatCount : 1;

  const activeVerse = verses.find((v) => v.verse_number === activeVerseNumber);
  const currentArabic = activeVerse?.text_uthmani ?? "";

  // Mushaf page context — fetch all verses on the current mushaf page so we can
  // render the full page with out-of-range verses grayed out.
  const activePage = activeVerse?.page_number;
  const { data: pageVersesData } = useQuery({
    queryKey: ["verses-by-page", activePage],
    queryFn: () => fetchVersesByPage(activePage!),
    enabled: activePage !== undefined,
    staleTime: Infinity,
  });
  const pageVerses = pageVersesData?.verses ?? [];

  // Save bookmark whenever the main single-study ayah changes
  useEffect(() => {
    saveBookmark(childId, {
      surahId: chapter.id,
      surahName: chapter.name_simple,
      from: fromAyah,
      to: toAyah,
      currentAyah: currentAyahNum,
      repeatCount,
      autoAdvance,
      cumulativeReview,
      reviewRepeatCount,
      savedAt: Date.now(),
    });
  }, [childId, chapter, fromAyah, toAyah, currentAyahNum, repeatCount, autoAdvance, cumulativeReview, reviewRepeatCount]);

  // Session verses ordered by verse_number for recite mode indexing.
  const sessionVerses = useMemo(
    () =>
      verses
        .filter((v) => v.verse_number >= fromAyah && v.verse_number <= toAyah)
        .sort((a, b) => a.verse_number - b.verse_number),
    [verses, fromAyah, toAyah]
  );
  const sessionVersesRef = useRef<VerseData[]>([]);
  sessionVersesRef.current = sessionVerses;

  // Speech recognition — runs only while recite mode is active.
  useEffect(() => {
    if (!isReciteMode) {
      recognitionRef.current?.stop();
      return;
    }
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition not supported in this browser. Try Chrome.");
      setIsReciteMode(false);
      return;
    }
    const rec = new SR();
    rec.lang = "ar";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e: any) => {
      const result = e.results[e.resultIndex];

      // Full accumulated transcript for this utterance.
      const bestTranscript = result[0].transcript.trim();
      const allHeardWords = stripTashkeel(bestTranscript).split(/\s+/).filter(Boolean);

      // Skip words already matched in previous interim events for this utterance
      // so each event only processes newly spoken words.
      const heardWords = allHeardWords.slice(matchedWordCountRef.current);

      // Walk new heard words against expected words sequentially.
      // Advance local cursors (not state) so we can batch a single state update.
      let vIdx = reciteVerseIndexRef.current;
      let wIdx = reciteWordIndexRef.current;
      let advanced = false;

      for (const heardWord of heardWords) {
        const verse = sessionVersesRef.current[vIdx];
        if (!verse) break;
        const expectedWords = verse.text_uthmani.split(/\s+/).filter(Boolean);
        const expectedAr = stripTashkeel(expectedWords[wIdx] || "");

        const hw = heardWord.replace(/^ال/, "");
        const ew = expectedAr.replace(/^ال/, "");

        console.log("SR word:", hw, "| expected:", ew);

        if (
          hw === ew ||
          hw.includes(ew) ||
          ew.includes(hw)
        ) {
          advanced = true;
          matchedWordCountRef.current++;
          if (wIdx + 1 >= expectedWords.length) {
            vIdx++;
            wIdx = 0;
          } else {
            wIdx++;
          }
        } else {
          break; // stop on first non-matching word
        }
      }

      console.log("match result:", advanced, "| new reciteVerseIndex:", vIdx, "| new reciteWordIndex:", wIdx);

      if (advanced) {
        // Write back to refs immediately so subsequent interim results start
        // from the correct verse/word position.
        reciteVerseIndexRef.current = vIdx;
        reciteWordIndexRef.current = wIdx;
        setReciteAttempts(0);
        setReciteVerseIndex(vIdx);
        setReciteWordIndex(wIdx);
      } else {
        // Only penalise on final results; interim mismatches are expected mid-word.
        if (result.isFinal) {
          setReciteAttempts((a) => a + 1);
        }
      }

      // Final result closes this utterance — reset so the next starts fresh.
      if (result.isFinal) {
        matchedWordCountRef.current = 0;
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") console.error("Speech error:", e.error);
    };

    rec.onend = () => {
      console.log("SR ended, isReciteMode:", isReciteModeRef.current);
      // Restart through the ref — not the closed-over local — so cleanup can
      // null it out first and prevent a restart after teardown.
      if (isReciteModeRef.current) {
        console.log("SR restarting...");
        try { recognitionRef.current?.start(); } catch {}
      }
    };

    // Assign to ref BEFORE start() so onend can reach it immediately.
    recognitionRef.current = rec;
    rec.start();

    return () => {
      // Null onend first so the handler cannot fire and call start() after we stop.
      rec.onend = null;
      rec.stop();
      recognitionRef.current = null;
    };
  }, [isReciteMode]);

  const handleAllRepeatsDone = useCallback(() => {
    if (internalPhaseRef.current === "single") {
      if (autoAdvanceRef.current && cumulativeReviewRef.current && currentAyahNumRef.current > fromAyahRef.current) {
        // Enter cumulative review for ayahs fromAyah..currentAyahNum (only when >1 ayah covered)
        const upTo = currentAyahNumRef.current;
        setCumUpTo(upTo);
        cumUpToRef.current = upTo;
        setCumAyahIdx(0);
        cumAyahIdxRef.current = 0;
        setCumPass(1);
        cumPassRef.current = 1;
        setInternalPhase("cumulative");
        internalPhaseRef.current = "cumulative";
        pendingPlayDelayRef.current = 150; // small gap entering review
        setPendingAutoPlay(true);
      } else if (autoAdvanceRef.current && currentAyahNumRef.current < toAyahRef.current) {
        pendingPlayDelayRef.current = 150;
        setPendingAutoPlay(true);
        setCurrentAyahNum((n) => n + 1);
      } else if (currentAyahNumRef.current >= toAyahRef.current) {
        // Last ayah finished — session complete
        onSessionCompleteRef.current();
      }
    } else {
      // cumulative phase — advance through ayahs, then passes, then return to single
      const rangeLen = cumUpToRef.current - fromAyahRef.current + 1;
      const nextIdx = cumAyahIdxRef.current + 1;

      if (nextIdx < rangeLen) {
        // flowing to next ayah within cumulative — no pause
        pendingPlayDelayRef.current = 0;
        setCumAyahIdx(nextIdx);
        cumAyahIdxRef.current = nextIdx;
        setPendingAutoPlay(true);
      } else {
        const nextPass = cumPassRef.current + 1;
        if (nextPass <= reviewRepeatCountRef.current) {
          // next pass — brief pause at the pass boundary
          pendingPlayDelayRef.current = 0;
          setCumAyahIdx(0);
          cumAyahIdxRef.current = 0;
          setCumPass(nextPass);
          cumPassRef.current = nextPass;
          setPendingAutoPlay(true);
        } else {
          // cumulative review complete — advance to next single ayah
          if (currentAyahNumRef.current < toAyahRef.current) {
            setInternalPhase("single");
            internalPhaseRef.current = "single";
            pendingPlayDelayRef.current = 150;
            setCurrentAyahNum((n) => n + 1);
            setPendingAutoPlay(true);
          } else {
            // finished entire session
            setInternalPhase("single");
            internalPhaseRef.current = "single";
            onSessionCompleteRef.current();
          }
        }
      }
    }
  }, []); // all access via refs

  const { playing, loading, error, currentRepeat, highlightedWord, words, play, skipRepeat, stopAudio } =
    useVerseAudio({
      surahNumber: chapter.id,
      verseNumber: activeVerseNumber,
      arabic: currentArabic,
      reciter,
      totalRepeats: activeTotalRepeats,
      onAllRepeatsDone: handleAllRepeatsDone,
    });

  // Keep playRef up to date on every render without triggering effects
  playRef.current = play;

  // Trigger recite mode from outside (e.g. "Recite to NoorPath" button)
  useEffect(() => {
    if (!triggerReciteMode) return;
    stopAudio();
    setIsReciteMode(true);
    setIsBlindMode(false);
    setReciteWordIndex(0);
    setReciteVerseIndex(0);
    setReciteAttempts(0);
    setRevealedWords(new Set());
    reciteWordIndexRef.current = 0;
    reciteVerseIndexRef.current = 0;
    matchedWordCountRef.current = 0;
    onReciteTriggered?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerReciteMode]);

  const handleShowWord = () => {
    const key = `${reciteVerseIndex}-${reciteWordIndex}`;
    setRevealedWords((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setReciteAttempts((a) => a + 3);
  };

  const handleReciteRestart = () => {
    setReciteVerseIndex(0);
    setReciteWordIndex(0);
    setReciteAttempts(0);
    setRevealedWords(new Set());
    reciteWordIndexRef.current = 0;
    reciteVerseIndexRef.current = 0;
    matchedWordCountRef.current = 0;
  };

  // After auto-advancing (single or cumulative), start playback once the hook has reset.
  // Cumulative ayah-to-ayah transitions use delay=0 for seamless flow;
  // single-ayah advances use 150ms to let the hook fully reset first.
  useEffect(() => {
    if (!pendingAutoPlay) return;
    setPendingAutoPlay(false);
    const delay = pendingPlayDelayRef.current;
    const timer = setTimeout(() => {
      playRef.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [activeVerseNumber, pendingAutoPlay]);

  // Scroll active ayah into view whenever it changes
  useEffect(() => {
    currentVerseRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeVerseNumber]);

  const rangeLength = toAyah - fromAyah + 1;
  const currentIndexInRange = currentAyahNum - fromAyah;
  const progressPercent =
    rangeLength > 1 ? (currentIndexInRange / (rangeLength - 1)) * 100 : 100;

  const goNext = () => {
    if (internalPhase === "single" && currentAyahNum < toAyah) {
      setInternalPhase("single");
      setCurrentAyahNum((n) => n + 1);
    }
  };

  const handleSkipRepeat = () => {
    if (internalPhase === "single") {
      // Skip current repeat of the single ayah (hook handles repeat/done logic)
      skipRepeat();
    } else {
      // Cumulative phase: skip current pass → jump to next pass, or exit if last
      stopAudio();
      const nextPass = cumPass + 1;
      if (nextPass <= reviewRepeatCount) {
        setCumAyahIdx(0);
        cumAyahIdxRef.current = 0;
        setCumPass(nextPass);
        cumPassRef.current = nextPass;
        pendingPlayDelayRef.current = 150;
        setPendingAutoPlay(true);
      } else {
        // Last pass done — advance to next single ayah or complete session
        setInternalPhase("single");
        internalPhaseRef.current = "single";
        if (currentAyahNum < toAyah) {
          pendingPlayDelayRef.current = 150;
          setCurrentAyahNum((n) => n + 1);
          setPendingAutoPlay(true);
        } else {
          onSessionCompleteRef.current();
        }
      }
    }
  };

  const skipAyah = () => {
    if (internalPhase === "single") {
      // Only enter cumulative when more than 1 ayah has been covered
      if (cumulativeReview && currentAyahNum > fromAyah) {
        const upTo = currentAyahNum;
        setCumUpTo(upTo);
        cumUpToRef.current = upTo;
        setCumAyahIdx(0);
        cumAyahIdxRef.current = 0;
        setCumPass(1);
        cumPassRef.current = 1;
        setInternalPhase("cumulative");
        internalPhaseRef.current = "cumulative";
        pendingPlayDelayRef.current = 150;
        setPendingAutoPlay(true);
      } else if (currentAyahNum < toAyah) {
        pendingPlayDelayRef.current = 150;
        setCurrentAyahNum((n) => n + 1);
      } else {
        // Last ayah, no cumulative review — session complete
        stopAudio();
        onSessionCompleteRef.current();
      }
    } else {
      // Cumulative phase: skip the entire review
      stopAudio();
      setInternalPhase("single");
      internalPhaseRef.current = "single";
      if (currentAyahNum < toAyah) {
        pendingPlayDelayRef.current = 150;
        setCurrentAyahNum((n) => n + 1);
        setPendingAutoPlay(true);
      } else {
        // Was reviewing the last ayah — session complete
        onSessionCompleteRef.current();
      }
    }
  };
  const goPrev = () => {
    if (internalPhase === "single" && currentAyahNum > fromAyah) {
      setCurrentAyahNum((n) => n - 1);
    } else if (internalPhase === "cumulative") {
      // bail out of cumulative review and stay on current single ayah
      setInternalPhase("single");
    }
  };


  const isCumulative = internalPhase === "cumulative";

  // Build the ordered verse list for the mushaf page view.
  // When page data has loaded, it provides the full-page context (may include
  // verses from other surahs). Before that, fall back to the per-surah verses.
  const displayList = useMemo(() => {
    if (pageVerses.length > 0) {
      return pageVerses.map((pv) => {
        const [surahStr, verseStr] = pv.verse_key.split(":");
        const surahId = parseInt(surahStr, 10);
        const verseNum = parseInt(verseStr, 10);
        const surahVerse =
          surahId === chapter.id
            ? verses.find((v) => v.verse_number === verseNum)
            : undefined;
        return { surahId, verseNum, surahVerse, pageVerse: pv };
      });
    }
    return verses.map((v) => ({
      surahId: chapter.id,
      verseNum: v.verse_number,
      surahVerse: v,
      pageVerse: undefined as PageVerseData | undefined,
    }));
  }, [pageVerses, verses, chapter.id]);

  // Descriptive label for controls bar
  const phaseLabel = isCumulative
    ? `Ayahs ${fromAyah}–${cumUpTo} · Pass ${cumPass}/${reviewRepeatCount}`
    : `Ayah ${currentAyahNum} · ${repeatCount}× repeat`;

  return (
    <div className="h-screen bg-[#f5f0e8] dark:bg-gray-950 flex flex-col md:flex-row overflow-hidden">

      {/* ── LEFT COLUMN (desktop only) ── */}
      <div className="hidden md:flex w-52 flex-col gap-6 p-4 justify-center shrink-0 bg-[#f5f0e8] dark:bg-gray-950">
        {/* Surah info + progress */}
        <div className="flex flex-col gap-2">
          <div>
            <h1 className="text-lg font-bold leading-tight text-[#1a5c2a] dark:text-emerald-400">
              {chapter.name_simple}
            </h1>
            <p className="text-sm text-muted-foreground">
              {chapter.translated_name?.name}
            </p>
            <span className="arabic-text text-2xl text-amber-700 mt-1 block text-right">
              {chapter.name_arabic}
            </span>
          </div>
          <div className="h-1.5 bg-border/60 rounded-full overflow-hidden">
            {isCumulative ? (
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${cumUpTo - fromAyah > 0 ? (cumAyahIdx / (cumUpTo - fromAyah)) * 100 : 100}%` }}
              />
            ) : (
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isCumulative
              ? `Reviewing ${cumUpTo - fromAyah + 1} ayahs · pass ${cumPass} of ${reviewRepeatCount}`
              : `${currentIndexInRange + 1} of ${rangeLength} ayahs`}
          </p>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline" size="sm" onClick={goPrev}
            disabled={isReciteMode || (isCumulative ? false : currentAyahNum <= fromAyah)}
            className="rounded-full w-10 h-10 p-0"
            title={isCumulative ? "Exit cumulative review" : "Previous ayah"}
          >
            <SkipBack size={16} />
          </Button>
          <Button
            size="lg" onClick={play}
            disabled={isReciteMode || loading || versesLoading || !currentArabic}
            className={cn("rounded-full w-14 h-14 p-0 shadow-lg", isCumulative ? "bg-teal-600 hover:bg-teal-700" : "")}
          >
            {loading ? <Loader2 size={22} className="animate-spin" /> : playing ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
          </Button>
          <Button
            variant="outline" size="sm" onClick={handleSkipRepeat}
            disabled={isReciteMode || (!isCumulative && repeatCount <= 1)}
            className="rounded-full w-10 h-10 p-0"
            title={isCumulative ? "Skip pass" : "Skip repeat (stay on same ayah)"}
          >
            <ChevronsRight size={16} />
          </Button>
          <Button
            variant="outline" size="sm" onClick={skipAyah}
            disabled={isReciteMode}
            className="rounded-full w-10 h-10 p-0"
            title={isCumulative ? "Skip cumulative review" : "Skip ayah (advance to next ayah)"}
          >
            <SkipForward size={16} />
          </Button>
        </div>

        {/* Auto-advance toggle */}
        <button
          onClick={() => setAutoAdvance((a) => !a)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors self-start",
            autoAdvance
              ? "border-primary/30 text-primary bg-primary/5"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <RotateCcw size={11} />
          Auto-advance {autoAdvance ? "on" : "off"}
        </button>
      </div>

      {/* ── CENTER COLUMN ── */}
      <div className="flex-1 h-full overflow-hidden flex flex-col items-center justify-start py-3">

      {/* Mobile-only header */}
      <div className="md:hidden pattern-bg text-white px-4 pt-8 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-emerald-200 text-sm"
            >
              <ChevronLeft size={16} /> Settings
            </button>
            <div className="text-right">
              {isCumulative ? (
                <>
                  <p className="text-emerald-200/70 text-[10px] uppercase tracking-wide">
                    Cumulative Review
                  </p>
                  <p className="text-2xl font-bold leading-none">
                    {fromAyah + cumAyahIdx}
                  </p>
                  <p className="text-emerald-200/60 text-xs">
                    Pass {cumPass}/{reviewRepeatCount} · {fromAyah}–{cumUpTo}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-emerald-200/70 text-[10px] uppercase tracking-wide">
                    Ayah
                  </p>
                  <p className="text-2xl font-bold leading-none">{currentAyahNum}</p>
                  <p className="text-emerald-200/60 text-xs">
                    {fromAyah}–{toAyah}
                  </p>
                </>
              )}
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

          {/* Range progress bar — shows single-ayah progress; turns teal in cumulative */}
          <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
            {isCumulative ? (
              // cumulative progress: position within the cumulative ayah range
              <div
                className="h-full bg-teal-300 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    cumUpTo - fromAyah > 0
                      ? (cumAyahIdx / (cumUpTo - fromAyah)) * 100
                      : 100
                  }%`,
                }}
              />
            ) : (
              <div
                className="h-full bg-amber-300 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            )}
          </div>
          <p className="text-emerald-200/60 text-xs mt-1">
            {isCumulative
              ? `Reviewing ${cumUpTo - fromAyah + 1} ayahs · pass ${cumPass} of ${reviewRepeatCount}`
              : `${currentIndexInRange + 1} of ${rangeLength} ayahs`}
          </p>
        </div>
      </div>

      {/* Arabic text area — mushaf page view */}
      <div className="flex-1 w-full min-h-0 overflow-hidden flex flex-col">
        <style>{TAJWEED_CSS}</style>
        {versesLoading || !currentArabic ? (
          <div className="w-full space-y-4 pt-8 px-5">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-4/5 rounded-xl mx-auto" />
            <Skeleton className="h-10 w-3/5 rounded-xl mx-auto" />
          </div>
        ) : (
          <div className="mushaf-page" style={{ width: "min(680px, 96vw)", height: "100%", margin: "0 auto", padding: "12px", display: "flex", flexDirection: "column" }}>
            {/* Parchment page card */}
            <div
              className="relative"
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: `2px solid ${theme.bannerBorder}`,
                outline: `1px solid ${theme.bannerBorder}`,
                outlineOffset: "-8px",
                background: theme.parchment,
                boxShadow: "0 1px 16px rgba(100,60,0,0.14)",
                borderRadius: "3px",
              }}
            >
              {/* Corner ornaments */}
              <span aria-hidden="true" style={{ position: "absolute", top: 5, left: 5, color: theme.accent, fontSize: "10px", lineHeight: 1, userSelect: "none", zIndex: 1 }}>◆</span>
              <span aria-hidden="true" style={{ position: "absolute", top: 5, right: 5, color: theme.accent, fontSize: "10px", lineHeight: 1, userSelect: "none", zIndex: 1 }}>◆</span>
              <span aria-hidden="true" style={{ position: "absolute", bottom: 5, left: 5, color: theme.accent, fontSize: "10px", lineHeight: 1, userSelect: "none", zIndex: 1 }}>◆</span>
              <span aria-hidden="true" style={{ position: "absolute", bottom: 5, right: 5, color: theme.accent, fontSize: "10px", lineHeight: 1, userSelect: "none", zIndex: 1 }}>◆</span>

              {/* Verse body */}
              <div
                className="arabic-text px-6 pt-4 pb-5 select-none"
                dir="rtl"
                lang="ar"
                style={{
                  fontFamily: '"Amiri Quran", "me_quran", serif',
                  fontSize: "1.57rem",
                  lineHeight: "2.15",
                  textAlign: "justify",
                  textAlignLast: "right",
                  textJustify: "inter-word",
                  color: theme.textColor ?? "#1a0a00",
                  flex: 1,
                  overflowY: "auto",
                  minHeight: 0,
                }}
              >

                {displayList.map(
                  ({ surahId, verseNum, surahVerse, pageVerse }, listIdx) => {
                    const isActiveSurah = surahId === chapter.id;
                    const isActive =
                      isActiveSurah && verseNum === activeVerseNumber;
                    const inSelectedRange =
                      isActiveSurah &&
                      verseNum >= fromAyah &&
                      verseNum <= toAyah;
                    const inCumRange =
                      isCumulative && isActiveSurah && verseNum <= cumUpTo;

                    // Show surah banner whenever this verse is verse 1 of its surah
                    // (the surah starts on this page, either at the top or mid-page).
                    const showSurahHeader = verseNum === 1;

                    const tajweedHtml = stripVerseEndHtml(
                      surahVerse?.text_uthmani_tajweed ??
                      pageVerse?.text_uthmani_tajweed ??
                      ""
                    );
                    // Pre-compute for active verse only (used inside words.map)
                    const tajweedWords = isActive
                      ? splitTajweedIntoWords(tajweedHtml)
                      : [];
                    const hasValidTajweed =
                      isActive && tajweedWords.length === words.length;

                    const ornamentClass = "inline-block arabic-text text-[0.85rem] mx-[0.3em] transition-colors duration-300";
                    const ornamentColor = isActive
                      ? (isCumulative ? "rgba(13,148,136,0.55)" : "rgba(217,119,6,0.55)")
                      : isActiveSurah && inSelectedRange
                        ? `${theme.accent}47`
                        : `${theme.accent}21`;

                    const surahChapter = allChapters.find(
                      (c) => c.id === surahId
                    );

                    return (
                      <span key={`${surahId}:${verseNum}`}>
                        {/* Inline surah banner — only at the start of a surah */}
                        {showSurahHeader && (
                          <span className="block" dir="rtl" style={{ textAlign: "center", isolation: "isolate" }}>
                            <span
                              className="arabic-text mx-0 mt-3 mb-2 flex items-center justify-center gap-3"
                              style={{
                                background: theme.banner,
                                border: `2px solid ${theme.bannerBorder}`,
                                boxShadow:
                                  `inset 0 0 0 3px ${theme.banner}, inset 0 0 0 4px ${theme.bannerBorder}`,
                                borderRadius: "3px",
                                padding: "7px 16px",
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  color: theme.accent,
                                  fontSize: "18px",
                                  lineHeight: 1,
                                  flexShrink: 0,
                                }}
                              >
                                ✿
                              </span>
                              <span
                                style={{
                                  color: "#ffffff",
                                  fontSize: "1.1rem",
                                  textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                                }}
                              >
                                {surahChapter?.name_arabic ?? `سُورَة ${surahId}`}
                              </span>
                              <span
                                aria-hidden="true"
                                style={{
                                  color: theme.accent,
                                  fontSize: "18px",
                                  lineHeight: 1,
                                  flexShrink: 0,
                                }}
                              >
                                ✿
                              </span>
                            </span>
                            {surahId !== 1 && surahId !== 9 && (
                              <div style={{ display: "flex", justifyContent: "center", width: "100%", margin: "4px 0" }}>
                                <span style={{ fontFamily: '"Amiri Quran", "me_quran", serif', fontSize: "1.3rem", color: theme.accent }}>
                                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                                </span>
                              </div>
                            )}
                          </span>
                        )}

                        {/* Verse content */}
                        {isActive ? (
                          // Active verse — word-by-word tracking with tajweed
                          <span
                            ref={currentVerseRef}
                            style={{
                              backgroundColor: "rgba(254, 240, 138, 0.35)",
                              borderRadius: "8px",
                              padding: "2px 6px",
                              margin: "0 -6px",
                              transition: "background-color 0.3s",
                            }}
                          >
                            {(() => {
                              const blindActive = isBlindMode && !revealedAyahs.has(verseNum);
                              // verseIdx of the active verse relative to fromAyah
                              const reciteVerseIdx = activeVerseNumber - fromAyah;
                              const wordSpans = words.map((_, i) => {
                                const isHighlighted = highlightedWord === i;
                                const isPast = playing && highlightedWord > i;

                                if (isReciteMode) {
                                  // A word is "done" if its verse is past, or same verse and word index is past
                                  const isWordDone =
                                    reciteVerseIdx < reciteVerseIndex ||
                                    (reciteVerseIdx === reciteVerseIndex && i < reciteWordIndex);
                                  // Current word: this verse + word is exactly the recite cursor
                                  const isCurrentWord =
                                    reciteVerseIdx === reciteVerseIndex && i === reciteWordIndex;
                                  // Future: not done and not current
                                  const isFutureWord = !isWordDone && !isCurrentWord;
                                  // Revealed: word was shown via the Show Word button
                                  const isRevealed = isCurrentWord && revealedWords.has(`${reciteVerseIndex}-${reciteWordIndex}`);

                                  // current word: blurred with green outline (target indicator), unless revealed
                                  // future word: blurred, no indicator
                                  // done word: fully visible
                                  const reciteStyle: React.CSSProperties = isCurrentWord && !isRevealed
                                    ? {
                                        filter: "blur(4px)",
                                        outline: "2px solid #22c55e",
                                        borderRadius: "4px",
                                        animation: "recite-word-pulse 1.2s ease-in-out infinite",
                                      }
                                    : isFutureWord
                                      ? { filter: "blur(6px)", userSelect: "none" }
                                      : {}; // done words and revealed current word: fully visible

                                  return (
                                    <span
                                      key={i}
                                      className="inline-block transition-all duration-100 rounded-sm px-[0.15em] mx-[0.15em]"
                                      style={reciteStyle}
                                    >
                                      {hasValidTajweed ? (
                                        <span dangerouslySetInnerHTML={{ __html: tajweedWords[i] }} />
                                      ) : (
                                        stripVerseEnd(surahVerse?.text_uthmani ?? currentArabic)
                                          .split(/\s+/)
                                          .filter(Boolean)[i] ?? ""
                                      )}
                                    </span>
                                  );
                                }

                                // Normal (non-recite) word span
                                return (
                                  <span
                                    key={i}
                                    className={cn(
                                      "inline-block transition-all duration-100 rounded-sm px-[0.15em] mx-[0.15em]",
                                      isHighlighted
                                        ? isCumulative
                                          ? "bg-teal-300 text-teal-900 scale-110 shadow-sm"
                                          : "bg-amber-300 text-amber-900 scale-110 shadow-sm"
                                        : isPast
                                          ? "opacity-35"
                                          : ""
                                    )}
                                  >
                                    {hasValidTajweed ? (
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: tajweedWords[i],
                                        }}
                                      />
                                    ) : (
                                      stripVerseEnd(
                                        surahVerse?.text_uthmani ?? currentArabic
                                      )
                                        .split(/\s+/)
                                        .filter(Boolean)[i] ?? ""
                                    )}
                                  </span>
                                );
                              });
                              const toggleActiveReveal = () =>
                                setRevealedAyahs((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(verseNum)) next.delete(verseNum); else next.add(verseNum);
                                  return next;
                                });
                              if (isReciteMode) {
                                return <>{wordSpans}</>;
                              }
                              if (blindActive) {
                                return (
                                  <span
                                    style={{ filter: "blur(6px)", userSelect: "none", cursor: "pointer" }}
                                    onClick={toggleActiveReveal}
                                  >
                                    {wordSpans}
                                  </span>
                                );
                              }
                              if (isBlindMode) {
                                // Revealed active ayah — tap to cover again
                                return (
                                  <span style={{ cursor: "pointer" }} onClick={toggleActiveReveal}>
                                    {wordSpans}
                                  </span>
                                );
                              }
                              return wordSpans;
                            })()}
                          </span>
                        ) : (
                          // Non-active verse — full tajweed block, dimmed by range/phase
                          (() => {
                            const outOfRange = !isActiveSurah || !inSelectedRange;
                            const toggleReveal = () =>
                              setRevealedAyahs((prev) => {
                                const next = new Set(prev);
                                if (next.has(verseNum)) next.delete(verseNum); else next.add(verseNum);
                                return next;
                              });
                            const inner = (
                              <span
                                className="transition-opacity duration-300"
                                style={{
                                  opacity: !isActiveSurah
                                    ? 0.13
                                    : !inSelectedRange
                                      ? 0.17
                                      : isCumulative && !inCumRange
                                        ? 0.28
                                        : 0.55,
                                }}
                              >
                                {tajweedHtml ? (
                                  <span
                                    dangerouslySetInnerHTML={{ __html: tajweedHtml }}
                                  />
                                ) : (
                                  stripVerseEnd(surahVerse?.text_uthmani ?? "")
                                )}
                              </span>
                            );
                            // Recite mode: word-by-word blur for in-session verses.
                            // Out-of-range verses keep existing dim with no special recite treatment.
                            if (isReciteMode && isActiveSurah && inSelectedRange) {
                              const verseSessionIdx = verseNum - fromAyah;
                              // Future verse — blur entire block
                              if (verseSessionIdx > reciteVerseIndex) {
                                return (
                                  <span style={{ filter: "blur(6px)", userSelect: "none" }}>
                                    {inner}
                                  </span>
                                );
                              }
                              // Past verse — fully visible
                              if (verseSessionIdx < reciteVerseIndex) {
                                return inner;
                              }
                              // Current verse (verseSessionIdx === reciteVerseIndex) — word-by-word
                              const verseText = stripVerseEnd(surahVerse?.text_uthmani ?? "");
                              const verseWordList = verseText.split(/\s+/).filter(Boolean);
                              return (
                                <>
                                  {verseWordList.map((word, wi) => {
                                    const isWordDone = wi < reciteWordIndex;
                                    const isCurrentWord = wi === reciteWordIndex;
                                    const isFutureWord = !isWordDone && !isCurrentWord;
                                    const isRevealed = isCurrentWord && revealedWords.has(`${verseSessionIdx}-${reciteWordIndex}`);
                                    const wordStyle: React.CSSProperties = isCurrentWord && !isRevealed
                                      ? { filter: "blur(4px)", outline: "2px solid #22c55e", borderRadius: "4px", display: "inline-block" }
                                      : isFutureWord
                                        ? { filter: "blur(6px)", userSelect: "none", display: "inline-block" }
                                        : { display: "inline-block" };
                                    return (
                                      <span key={wi} className="px-[0.15em] mx-[0.15em]" style={wordStyle}>
                                        {word}
                                      </span>
                                    );
                                  })}
                                </>
                              );
                            }
                            if (!isBlindMode) return inner;
                            if (outOfRange) {
                              // Out-of-range: always blurred, not tappable
                              return (
                                <span style={{ filter: "blur(6px)", userSelect: "none" }}>
                                  {inner}
                                </span>
                              );
                            }
                            if (!revealedAyahs.has(verseNum)) {
                              // In-range, hidden: tap to reveal
                              return (
                                <span
                                  style={{ filter: "blur(6px)", userSelect: "none", cursor: "pointer" }}
                                  onClick={toggleReveal}
                                >
                                  {inner}
                                </span>
                              );
                            }
                            // In-range, revealed: tap to cover again
                            return (
                              <span style={{ cursor: "pointer" }} onClick={toggleReveal}>
                                {inner}
                              </span>
                            );
                          })()
                        )}

                        {/* Verse-end marker — after verse text so it appears at the END in RTL flow */}
                        <span
                          className={ornamentClass}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.8em",
                            height: "1.8em",
                            border: `2px solid ${theme.accent}`,
                            borderRadius: "2px",
                            transform: "rotate(45deg)",
                            fontSize: "0.7em",
                            direction: "ltr",
                            margin: "0 0.5em",
                            flexShrink: 0,
                            verticalAlign: "middle",
                            color: theme.accent,
                            opacity: 1,
                          }}
                        >
                          <bdo dir="ltr" style={{ transform: "rotate(-45deg)", display: "block" }}>
                            {verseNum}
                          </bdo>
                        </span>

                      </span>
                    );
                  }
                )}
              </div>

              {/* Page footer */}
              <div
                className="flex items-center justify-center px-6 pb-5 pt-2"
                style={{ borderTop: "1px solid rgba(160,110,30,0.18)" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "44px",
                    height: "20px",
                    border: `1px solid ${theme.accent}`,
                    borderRadius: "2px",
                    transform: "rotate(45deg)",
                    direction: "ltr",
                  }}
                >
                  <bdo
                    dir="ltr"
                    className="tabular-nums"
                    style={{
                      transform: "rotate(-45deg)",
                      display: "block",
                      fontSize: "9px",
                      color: theme.accent,
                      fontWeight: 600,
                      letterSpacing: "0.2em",
                    }}
                  >
                    {activePage ?? ""}
                  </bdo>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recite completion overlay — shown when all session verses have been recited */}
      {isReciteMode && sessionVerses.length > 0 && reciteVerseIndex >= sessionVerses.length && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 mx-6 flex flex-col items-center gap-4 max-w-xs w-full">
            <div className="text-4xl">🌟</div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 text-center">
              Recitation Complete!
            </p>
            <p className="text-sm text-muted-foreground text-center">
              You recited all {sessionVerses.length} {sessionVerses.length === 1 ? "verse" : "verses"}.
            </p>
            <button
              onClick={() => {
                const totalWords = sessionVerses.reduce(
                  (sum, v) => sum + v.text_uthmani.split(/\s+/).filter(Boolean).length,
                  0
                );
                const hintsUsed = revealedWords.size;
                const failedAttempts = Math.max(0, reciteAttempts - hintsUsed * 3);
                const penalty = hintsUsed * 15 + failedAttempts * 3;
                const reciteScore = Math.max(0, 100 - penalty);
                console.log("score debug:", { totalWords, hintsUsed, reciteAttempts, failedAttempts, penalty, reciteScore });
                onReciteComplete?.(reciteScore);
              }}
              className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl transition-colors"
            >
              Submit Results →
            </button>
            <button
              onClick={handleReciteRestart}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Pause & Save modal */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-foreground">How far did you get?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose which ayah you finished so we can check the right range.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-foreground">
                I completed ayahs <span className="font-semibold">{fromAyah}</span> to
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPauseToAyah((n) => Math.max(fromAyah, n - 1))}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-lg font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex-shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  min={fromAyah}
                  max={toAyah}
                  value={pauseToAyah}
                  onChange={(e) => {
                    const v = Math.max(fromAyah, Math.min(toAyah, parseInt(e.target.value) || fromAyah));
                    setPauseToAyah(v);
                  }}
                  className="flex-1 border border-border rounded-xl px-3 py-3 text-2xl text-center font-bold outline-none focus:border-primary"
                />
                <button
                  onClick={() => setPauseToAyah((n) => Math.min(toAyah, n + 1))}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-lg font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex-shrink-0"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Session range: ayahs {fromAyah}–{toAyah}
              </p>
            </div>

            <button
              onClick={() => {
                setShowPauseModal(false);
                onPauseAndSave(pauseToAyah);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-2xl py-4 text-base transition-colors"
            >
              Go to Recitation Check →
            </button>
            <button
              onClick={() => setShowPauseModal(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              Cancel — keep going
            </button>
          </div>
        </div>
      )}

      {/* Player controls */}
      <div className="md:hidden bg-white dark:bg-gray-900 border-t border-border dark:border-gray-700 px-4 pt-3 pb-6">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Phase badge + repeat dots */}
          <div className="flex items-center justify-center gap-3">
            {isCumulative ? (
              <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-teal-100 text-teal-700 tabular-nums">
                Cumulative Review · {phaseLabel}
              </span>
            ) : (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Single Ayah
                </span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: repeatCount }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-full transition-all duration-300",
                        i < currentRepeat
                          ? "bg-primary w-2.5 h-2.5"
                          : "bg-muted w-2 h-2",
                        i === currentRepeat - 1 && playing
                          ? "scale-125 shadow-md"
                          : ""
                      )}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                    {currentRepeat}/{repeatCount}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Prev / Play-Pause / Next */}
          <div className="flex items-center justify-center gap-5">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={
                isReciteMode ||
                (isCumulative
                  ? false // tapping prev exits cumulative
                  : currentAyahNum <= fromAyah)
              }
              className="rounded-full w-11 h-11 p-0"
              title={isCumulative ? "Exit cumulative review" : "Previous ayah"}
            >
              <SkipBack size={18} />
            </Button>

            <Button
              size="lg"
              onClick={play}
              disabled={isReciteMode || loading || versesLoading || !currentArabic}
              className={cn(
                "rounded-full w-16 h-16 p-0 shadow-lg",
                isCumulative ? "bg-teal-600 hover:bg-teal-700" : ""
              )}
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
              onClick={handleSkipRepeat}
              disabled={isReciteMode || (!isCumulative && repeatCount <= 1)}
              className="rounded-full w-11 h-11 p-0"
              title={isCumulative ? "Skip pass" : "Skip repeat (stay on same ayah)"}
            >
              <ChevronsRight size={18} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={skipAyah}
              disabled={isReciteMode}
              className="rounded-full w-11 h-11 p-0"
              title={isCumulative ? "Skip cumulative review" : "Skip ayah (advance to next ayah)"}
            >
              <SkipForward size={18} />
            </Button>
          </div>

          {/* Theme picker (mobile) + dark mode toggle */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={toggleDarkMode}
              className="flex items-center justify-center w-[18px] h-[18px] rounded-full border border-border/60 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun size={10} /> : <Moon size={10} />}
            </button>
            {(Object.keys(MUSHAF_THEMES) as Array<keyof typeof MUSHAF_THEMES>)
              .filter((key) => isDarkMode ? key.endsWith("_dark") : !key.endsWith("_dark"))
              .map((key) => (
              <button
                key={key}
                onClick={() => setMushafTheme(key)}
                title={MUSHAF_THEMES[key].name}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: MUSHAF_THEMES[key].banner,
                  border: mushafTheme === key ? `2px solid #d4af37` : "2px solid transparent",
                  outline: mushafTheme === key ? "1px solid #d4af37" : "none",
                  outlineOffset: "1px",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          {/* Auto-advance toggle + blind mode toggle + recite mode toggle + reciter label */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 flex-wrap">
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
              <button
                onClick={() => { setIsBlindMode((v) => !v); setIsReciteMode(false); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors",
                  isBlindMode
                    ? "border-primary/30 text-primary bg-primary/5"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <EyeOff size={11} />
                Blind {isBlindMode ? "on" : "off"}
              </button>
              <button
                onClick={() => {
                          setIsReciteMode((v) => {
                            if (!v) {
                              // Resetting state when enabling
                              stopAudio();
                              setReciteWordIndex(0);
                              setReciteVerseIndex(0);
                              setReciteAttempts(0);
                              setRevealedWords(new Set());
                              reciteWordIndexRef.current = 0;
                              reciteVerseIndexRef.current = 0;
                              matchedWordCountRef.current = 0;
                            }
                            return !v;
                          });
                          setIsBlindMode(false);
                        }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors",
                  isReciteMode
                    ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {isReciteMode ? <Mic size={11} /> : <MicOff size={11} />}
                Recite
              </button>
            </div>

            <span className="text-xs text-muted-foreground/70 truncate max-w-[100px]">
              {reciter.fullName}
            </span>

            {error && (
              <span className="text-xs text-red-500">⚠ Audio unavailable</span>
            )}
          </div>

          {/* Show Word + Restart — only visible in recite mode */}
          {isReciteMode && reciteVerseIndex < sessionVerses.length && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/40">
              <button
                onClick={handleShowWord}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
              >
                <Eye size={11} />
                Show Word
              </button>
              <button
                onClick={handleReciteRestart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
              >
                <RotateCcw size={11} />
                Restart
              </button>
            </div>
          )}

          {/* Pause & Save — always visible shortcut to recitation check */}
          <div className="flex justify-center pt-1 border-t border-border/40">
            <button
              onClick={() => {
                stopAudio();
                setPauseToAyah(currentAyahNum);
                setShowPauseModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50 text-xs font-semibold hover:bg-amber-100 active:bg-amber-200 transition-colors"
            >
              <Flag size={12} />
              Pause &amp; Save
            </button>
          </div>
        </div>
      </div>
      </div>{/* end center column */}

      {/* ── RIGHT COLUMN (desktop only) ── */}
      <div className="hidden md:flex w-40 flex-col gap-6 p-4 justify-center shrink-0 bg-[#f5f0e8] dark:bg-gray-950">
        {/* Ayah number + range */}
        <div className="flex flex-col gap-0.5">
          {isCumulative ? (
            <>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cumulative</p>
              <p className="text-3xl font-bold tabular-nums">{fromAyah + cumAyahIdx}</p>
              <p className="text-xs text-muted-foreground">Pass {cumPass}/{reviewRepeatCount}</p>
              <p className="text-xs text-muted-foreground">{fromAyah}–{cumUpTo}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ayah</p>
              <p className="text-3xl font-bold tabular-nums">{currentAyahNum}</p>
              <p className="text-xs text-muted-foreground">{fromAyah}–{toAyah}</p>
            </>
          )}
        </div>

        {/* Phase badge + repeat dots */}
        <div className="flex flex-col gap-1.5">
          {isCumulative ? (
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-teal-100 text-teal-700 tabular-nums">
              Cumulative · {phaseLabel}
            </span>
          ) : (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary self-start">
                Single Ayah
              </span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: repeatCount }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      i < currentRepeat ? "bg-primary w-2.5 h-2.5" : "bg-muted w-2 h-2",
                      i === currentRepeat - 1 && playing ? "scale-125 shadow-md" : ""
                    )}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                  {currentRepeat}/{repeatCount}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Reciter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground/70 truncate">
            {reciter.fullName}
          </span>
          {error && <span className="text-xs text-red-500">⚠ Audio unavailable</span>}
        </div>

        {/* Pause & Save */}
        <button
          onClick={() => { stopAudio(); setPauseToAyah(currentAyahNum); setShowPauseModal(true); }}
          className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50 text-xs font-semibold hover:bg-amber-100 active:bg-amber-200 transition-colors"
        >
          <Flag size={12} />
          Pause &amp; Save
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Theme picker */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(MUSHAF_THEMES) as Array<keyof typeof MUSHAF_THEMES>)
            .filter((key) => isDarkMode ? key.endsWith("_dark") : !key.endsWith("_dark"))
            .map((key) => (
            <button
              key={key}
              onClick={() => setMushafTheme(key)}
              title={MUSHAF_THEMES[key].name}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: MUSHAF_THEMES[key].banner,
                border: mushafTheme === key ? `2px solid #d4af37` : "2px solid transparent",
                outline: mushafTheme === key ? "1px solid #d4af37" : "none",
                outlineOffset: "1px",
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        {/* Blind mode toggle */}
        <button
          onClick={() => { setIsBlindMode((v) => !v); setIsReciteMode(false); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors self-start",
            isBlindMode
              ? "border-primary/30 text-primary bg-primary/5"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <EyeOff size={11} />
          Blind mode {isBlindMode ? "on" : "off"}
        </button>

        {/* Recite mode toggle */}
        <button
          onClick={() => {
                          setIsReciteMode((v) => {
                            if (!v) {
                              // Resetting state when enabling
                              stopAudio();
                              setReciteWordIndex(0);
                              setReciteVerseIndex(0);
                              setReciteAttempts(0);
                              setRevealedWords(new Set());
                              reciteWordIndexRef.current = 0;
                              reciteVerseIndexRef.current = 0;
                              matchedWordCountRef.current = 0;
                            }
                            return !v;
                          });
                          setIsBlindMode(false);
                        }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors self-start",
            isReciteMode
              ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {isReciteMode ? <Mic size={11} /> : <MicOff size={11} />}
          Recite mode
        </button>

        {/* Show Word + Restart — only visible in recite mode */}
        {isReciteMode && reciteVerseIndex < sessionVerses.length && (
          <>
            <button
              onClick={handleShowWord}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors self-start"
            >
              <Eye size={11} />
              Show Word
            </button>
            <button
              onClick={handleReciteRestart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors self-start"
            >
              <RotateCcw size={11} />
              Restart
            </button>
          </>
        )}

        {/* Settings back link */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-muted-foreground text-sm"
        >
          <ChevronLeft size={16} /> Memorization
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuranMemorizePage() {
  const { childId } = useParams<{ childId: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<"pick" | "setup" | "play" | "check">("pick");
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(10);
  const [repeatCount, setRepeatCount] = useState(3);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [cumulativeReview, setCumulativeReview] = useState(false);
  const [reviewRepeatCount, setReviewRepeatCount] = useState(3);
  const [startAyah, setStartAyah] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkRating, setCheckRating] = useState<"needs_work" | "good" | "excellent" | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [triggerReciteMode, setTriggerReciteMode] = useState(false);
  const [reciteSource, setReciteSource] = useState(false);
  const [reciteScore, setReciteScore] = useState(0);
  const [celebration, setCelebration] = useState<{ message: string; subMessage?: string } | null>(null);

  const saveMutation = useMutation({
    mutationFn: (qualityRating: number) => {
      const memorizedAyahs = Array.from({ length: toAyah - fromAyah + 1 }, (_, i) => fromAyah + i);
      const isComplete = toAyah >= selectedChapter!.verses_count;
      const payload = {
        surahId: selectedChapter!.id,
        memorizedAyahs,
        qualityRating,
        status: (isComplete ? "memorized" : "in_progress") as "memorized" | "in_progress",
      };
      console.log("[quran-memorize] Saving memorization:", {
        childId: parseInt(childId),
        surahName: selectedChapter!.name_simple,
        fromAyah,
        toAyah,
        totalVerses: selectedChapter!.verses_count,
        isComplete,
        ...payload,
      });
      return updateMemorization(parseInt(childId), payload);
    },
    onSuccess: (result) => {
      console.log("[quran-memorize] Save succeeded, API returned:", result);
      console.log("[quran-memorize] Invalidating query key:", ["memorization", childId]);
      qc.invalidateQueries({ queryKey: ["memorization", childId] });
      qc.invalidateQueries({ queryKey: ["dashboard", childId] });
      setSaveSuccess(true);
      const isComplete = toAyah >= selectedChapter!.verses_count;
      if (isComplete) {
        setCelebration({ message: "Surah Complete!", subMessage: "You've memorized the full surah!" });
      }
    },
    onError: (err) => {
      console.error("[quran-memorize] Save failed:", err);
    },
  });

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

  const surahParam = useMemo(() => new URLSearchParams(search).get("surah"), [search]);

  useEffect(() => {
    if (!surahParam || chapters.length === 0 || phase !== "pick") return;
    const surahNum = parseInt(surahParam, 10);
    const ch = chapters.find((c) => c.id === surahNum);
    if (ch) {
      setSelectedChapter(ch);
      setFromAyah(1);
      setToAyah(Math.min(10, ch.verses_count));
      setPhase("setup");
    }
  }, [chapters, surahParam, phase]);

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

  const handleSessionComplete = useCallback(() => {
    setShowReadyModal(true);
    setCelebration({ message: "Session Complete!", subMessage: "Keep up the great work" });
  }, []);

  const handlePauseAndSave = useCallback((completedToAyah: number) => {
    setToAyah(completedToAyah);
    setCheckRating(null);
    setSaveSuccess(false);
    setReciteSource(false);
    setPhase("check");
  }, []);

  const handleReciteComplete = useCallback((score: number) => {
    setReciteScore(score);
    setReciteSource(true);
    setCheckRating(null);
    setSaveSuccess(false);
    setPhase("check");
  }, []);

  const handleResumeBookmark = () => {
    if (!bookmark) return;
    const ch = chapters.find((c) => c.id === bookmark.surahId);
    if (!ch) return;
    setSelectedChapter(ch);
    setFromAyah(bookmark.from);
    setToAyah(bookmark.to);
    setRepeatCount(bookmark.repeatCount);
    setAutoAdvance(bookmark.autoAdvance);
    setCumulativeReview(bookmark.cumulativeReview ?? false);
    setReviewRepeatCount(bookmark.reviewRepeatCount ?? 3);
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
            <Link href={`/child/${childId}/memorization`}>
              <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
                <ChevronLeft size={16} /> Back to Memorization
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

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 shadow-sm overflow-hidden">
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
              onClick={() => navigate(`/child/${childId}/memorization`)}
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 p-5 shadow-sm space-y-4">
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 p-5 shadow-sm space-y-4">
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 p-5 shadow-sm">
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

          {/* Cumulative Review */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Cumulative Review
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  After each new ayah, replay all ayahs from the start of the
                  range up to the current one
                </p>
              </div>
              <Switch
                checked={cumulativeReview}
                onCheckedChange={setCumulativeReview}
              />
            </div>
            {cumulativeReview && (
              <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Review repeat count
                  </label>
                  <p className="text-[11px] text-muted-foreground/70">
                    How many times to loop through the cumulative range
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setReviewRepeatCount((n) => Math.max(1, n - 1))
                    }
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">
                    {reviewRepeatCount}×
                  </span>
                  <button
                    onClick={() =>
                      setReviewRepeatCount((n) => Math.min(10, n + 1))
                    }
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
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
  // PHASE: CHECK — Recitation check after session completes
  // ══════════════════════════════════════════════════════════════════════════

  const celebrationOverlay = (
    <CelebrationOverlay
      show={celebration !== null}
      onDone={() => setCelebration(null)}
      message={celebration?.message ?? ""}
      subMessage={celebration?.subMessage}
    />
  );

  if (phase === "check" && selectedChapter) {
    const ratingOptions: { value: "needs_work" | "good" | "excellent"; label: string; quality: number; color: string; bg: string; border: string }[] = [
      { value: "needs_work", label: "Needs Work", quality: 2, color: "text-red-600", bg: "bg-red-50", border: "border-red-300" },
      { value: "good",       label: "Good",        quality: 4, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-300" },
      { value: "excellent",  label: "Excellent",   quality: 5, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-300" },
    ];
    const selectedOption = ratingOptions.find((r) => r.value === checkRating);

    return (
      <>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="pattern-bg text-white px-4 pt-8 pb-10">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => navigate(`/child/${childId}/memorization`)}
              className="flex items-center gap-1 text-emerald-200 text-sm mb-4"
            >
              <ChevronLeft size={16} /> Back to Memorization
            </button>
            <h1 className="text-xl font-bold">Recitation Check</h1>
            <p className="text-emerald-200 text-sm mt-1">
              {selectedChapter.name_simple} · Ayahs {fromAyah}–{toAyah}
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto w-full px-4 -mt-6 space-y-5 pb-24">
          {/* Score card — only shown after Recite to NoorPath */}
          {reciteSource && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 shadow-sm p-6 flex flex-col items-center gap-1">
              <p className="text-7xl font-black tabular-nums text-foreground leading-none">
                {reciteScore}%
              </p>
              <p className="text-base font-semibold text-foreground mt-2">
                {reciteScore >= 90
                  ? "Excellent 🌟"
                  : reciteScore >= 70
                  ? "Good 👍"
                  : reciteScore >= 50
                  ? "Needs Work 💪"
                  : "Keep Practicing 📖"}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Based on attempts and hints used — your honest rating below is what counts
              </p>
            </div>
          )}

          {/* Instruction card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 shadow-sm p-5">
            <p className="text-sm font-semibold text-foreground mb-1">
              {reciteSource
                ? "How did your recitation go? Rate yourself honestly."
                : "Listen to your child recite"}
            </p>
            <p className="text-muted-foreground text-sm">
              {reciteSource ? (
                <>
                  Rate your own recitation of{" "}
                  <span className="font-medium text-foreground">
                    {fromAyah === toAyah
                      ? `Ayah ${fromAyah}`
                      : `Ayahs ${fromAyah}–${toAyah}`}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground arabic-text">
                    {selectedChapter.name_simple}
                  </span>{" "}
                  below.
                </>
              ) : (
                <>
                  Ask them to recite{" "}
                  <span className="font-medium text-foreground">
                    {fromAyah === toAyah
                      ? `Ayah ${fromAyah}`
                      : `Ayahs ${fromAyah}–${toAyah}`}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground arabic-text">
                    {selectedChapter.name_simple}
                  </span>{" "}
                  from memory, then rate their recitation below.
                </>
              )}
            </p>
          </div>

          {/* Rating selector */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-700 shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {reciteSource ? "How did you do?" : "How did they do?"}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {ratingOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCheckRating(opt.value)}
                  className={cn(
                    "rounded-xl border-2 py-4 flex flex-col items-center gap-1.5 text-sm font-semibold transition-all",
                    checkRating === opt.value
                      ? `${opt.bg} ${opt.border} ${opt.color} shadow-sm scale-105`
                      : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40"
                  )}
                >
                  <span className="text-xl">
                    {opt.value === "needs_work" ? "😔" : opt.value === "good" ? "😊" : "🌟"}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          {saveSuccess ? (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
                <CheckCircle size={24} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">Progress saved!</p>
                  <p className="text-sm text-emerald-600">
                    {selectedChapter.name_simple} ayahs {fromAyah}–{toAyah} marked as memorized.
                  </p>
                </div>
              </div>
              <Button
                className="w-full h-12 text-base"
                onClick={() => navigate(`/child/${childId}/memorization`)}
              >
                Back to Memorization
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => {
                  setSaveSuccess(false);
                  setCheckRating(null);
                  setPhase("setup");
                }}
              >
                Keep Practicing
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full h-12 text-base"
                disabled={!checkRating || saveMutation.isPending}
                onClick={() => {
                  if (!selectedOption) return;
                  saveMutation.mutate(selectedOption.quality);
                }}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Mark as Memorized"
                )}
              </Button>

              {saveMutation.isError && (
                <p className="text-sm text-red-500 text-center">
                  Failed to save — please try again.
                </p>
              )}

              <Button
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => navigate(`/child/${childId}/memorization`)}
              >
                Back to Memorization
              </Button>
            </>
          )}
        </div>
      </div>
      {celebrationOverlay}
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: PLAY — delegate entirely to MemorizationPlayer
  // ══════════════════════════════════════════════════════════════════════════

  if (!selectedChapter) return null;

  return (
    <>
      <MemorizationPlayer
        key={`${selectedChapter.id}-${fromAyah}-${toAyah}-${startAyah}`}
        childId={childId}
        chapter={selectedChapter}
        allChapters={chapters}
        verses={verses}
        versesLoading={versesLoading}
        fromAyah={fromAyah}
        toAyah={toAyah}
        repeatCount={repeatCount}
        initialAyah={startAyah}
        initialAutoAdvance={autoAdvance}
        cumulativeReview={cumulativeReview}
        reviewRepeatCount={reviewRepeatCount}
        onBack={() => navigate(`/child/${childId}/memorization`)}
        onSessionComplete={handleSessionComplete}
        onPauseAndSave={handlePauseAndSave}
        triggerReciteMode={triggerReciteMode}
        onReciteTriggered={() => setTriggerReciteMode(false)}
        onReciteComplete={handleReciteComplete}
      />

      {showReadyModal && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 pt-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto space-y-3">
            <p className="text-center text-white font-semibold text-sm drop-shadow">
              Ready to Recite?
            </p>
            <button
              onClick={() => {
                setShowReadyModal(false);
                setCheckRating(null);
                setSaveSuccess(false);
                setReciteSource(false);
                setCelebration(null);
                setPhase("check");
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-2xl py-3 text-base shadow-2xl transition-colors"
            >
              Recite to Teacher →
            </button>
            <button
              onClick={() => {
                setShowReadyModal(false);
                setTriggerReciteMode(true);
              }}
              className="w-full bg-white/90 hover:bg-white active:bg-white/80 text-emerald-800 font-semibold rounded-2xl py-3 text-base shadow-2xl transition-colors"
            >
              Recite to NoorPath →
            </button>
          </div>
        </div>
      )}
      {celebrationOverlay}
    </>
  );
}
