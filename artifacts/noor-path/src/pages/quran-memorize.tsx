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
  ChevronRight,
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
import { useSettings } from "@/hooks/use-settings";

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
  wordIdxInVerse: number; // 0-indexed among actual words; -1 for end markers
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
};

interface PageVerseData {
  verse_key: string;
  text_uthmani: string;
  text_uthmani_tajweed?: string;
  words?: ApiWord[];
}

async function fetchVersesByPage(
  pageNumber: number
): Promise<{ verses: PageVerseData[] }> {
  const r = await fetch(
    `${QURAN_API}/verses/by_page/${pageNumber}?words=true&fields=text_uthmani,text_uthmani_tajweed&word_fields=text_uthmani,line_number,char_type_name&per_page=50`
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
    return segs.map((s, i) => [i + 1, s[1] / span, s[2] / span] as Segment);
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
        const reindexed = segs.map((s, i) => [i + 1, s[1], s[2]] as Segment);
        result.set(vt.verse_key, reindexed);
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
.mushaf-page .ham_wasl,
.mushaf-page .slnt,
.mushaf-page .lam_shamsiyya,
.mushaf-page .madda_normal,
.mushaf-page .madda_permissible,
.mushaf-page .madda_necessary,
.mushaf-page .madda_obligatory,
.mushaf-page .qalaqah,
.mushaf-page .ikhafa_shafawi,
.mushaf-page .ikhafa,
.mushaf-page .idgham_ghunna,
.mushaf-page .idgham_wo_ghunna,
.mushaf-page .idgham_mutajanisayn,
.mushaf-page .idgham_mutaqaribain,
.mushaf-page .idgham_shafawi,
.mushaf-page .iqlab,
.mushaf-page .ghunna { color: inherit; }
@keyframes recite-word-pulse {
  0%, 100% { box-shadow: 0 2px 0 #22c55e; opacity: 1; }
  50%       { box-shadow: 0 3px 8px #22c55e99; opacity: 0.85; }
}
`;


// Strip Arabic diacritics (tashkeel) and normalize letter variants for fuzzy
// speech-recognition matching.
const stripTashkeel = (s: string): string => {
  // Diagnostic: trace each step for words containing إله/اله
  const traceWord = /[إا]له/.test(s);
  const t = (label: string, val: string) => { if (traceWord) console.log(`[stripTashkeel] ${label}:`, JSON.stringify(val)); return val; };

  let r = s;
  r = t("0-input",         r);
  r = t("1-dagger-alif",   r.replace(/\u0670/g, "ا"));
  r = t("2-tashkeel",      r.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, ""));
  r = t("3-tatweel",       r.replace(/[ـ]/g, ""));
  r = t("4-pres-forms",    r.replace(/[\uFB50-\uFDFF]/g, (c) => c.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")));
  r = t("5-alef-norm",     r.replace(/[أإآاٱ]/g, "ا"));
  r = t("6-alef-maqsura",  r.replace(/ى/g, "ي"));
  r = t("7-ta-marbuta",    r.replace(/ة/g, "ه"));
  r = t("8-waw-hamza",     r.replace(/ؤ/g, "و"));
  r = t("9-ya-hamza",      r.replace(/ئ/g, "ي"));
  r = t("10-hamza",        r.replace(/ء/g, ""));
  r = t("11-non-arabic",   r.replace(/[^\u0600-\u06FF\s]/g, ""));
  r = t("12-alef-madd",    r.replace(/ا+/g, "ا"));
  r = t("13-waw-madd",     r.replace(/و+/g, "و"));
  r = t("14-ya-madd",      r.replace(/ي+/g, "ي"));
  const result = r.trim();
  t("15-trim", result);

  if (result.length <= 2) console.log("short stripped word:", s, "→", result);
  // Never return empty — an empty expected word causes the matcher to spin forever.
  return result || s;
};


// Quranic pause marks, annotation signs, and verse marks — not real words.
const SKIP_CHARS = /^[\u06D6-\u06ED\u0600-\u0605\u061B\u061E\u061F\u06DD\u06DE\u06DF]+$/;

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
  const [, setLocation] = useLocation();
  const leaveDestinationRef = useRef<string | null>(null);

  const reciter = RECITERS.find((r) => r.id === "husary")!;

  const [currentAyahNum, setCurrentAyahNum] = useState(initialAyah);
  const pendingAutoPlayRef = useRef(false);
  const [autoAdvance, setAutoAdvance] = useState(initialAutoAdvance);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pauseToAyah, setPauseToAyah] = useState(initialAyah);
  // Local dark mode: initialised from global setting but does NOT write back to it
  const [localDarkMode, setLocalDarkMode] = useState(() => {
    try { return localStorage.getItem("noor-dark-mode") === "true"; }
    catch { return false; }
  });
  const toggleLocalDarkMode = () => setLocalDarkMode((d) => !d);
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
  const lastMatchedWordRef = useRef("");
  const lastMatchTimeRef = useRef(0);
  const [mushafTheme, setMushafThemeState] = useState<keyof typeof MUSHAF_THEMES>(() => {
    try {
      // Prefer the settings store mushafTheme, fall back to legacy key
      const settingsRaw = localStorage.getItem("noor-settings");
      if (settingsRaw) {
        const s = JSON.parse(settingsRaw) as { mushafTheme?: string };
        if (s.mushafTheme && s.mushafTheme in MUSHAF_THEMES) {
          return s.mushafTheme as keyof typeof MUSHAF_THEMES;
        }
      }
      const saved = localStorage.getItem("mushaf-theme");
      const darkNow = localStorage.getItem("noor-dark-mode") === "true";
      const isDarkKey = (k: string) => k.endsWith("_dark");
      if (saved && saved in MUSHAF_THEMES && isDarkKey(saved) === darkNow) {
        return saved as keyof typeof MUSHAF_THEMES;
      }
      return darkNow ? "madinah_dark" : "teal";
    } catch { return "teal"; }
  });

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Auto-switch theme when local dark mode toggles (independent of global dark mode)
  useEffect(() => {
    const isThemeDark = mushafTheme.endsWith("_dark");
    if (localDarkMode && !isThemeDark) {
      setMushafThemeState("madinah_dark");
      try { localStorage.setItem("mushaf-theme", "madinah_dark"); } catch { /* ignore */ }
    } else if (!localDarkMode && isThemeDark) {
      setMushafThemeState("teal");
      try { localStorage.setItem("mushaf-theme", "teal"); } catch { /* ignore */ }
    }
  }, [localDarkMode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const reciteActiveVerseNumber = isReciteMode
    ? (sessionVerses[reciteVerseIndex]?.verse_number ?? activeVerseNumber)
    : activeVerseNumber;

  const sessionPageNumbers = useMemo(
    () => {
      const pages = sessionVerses
        .map((v) => v.page_number)
        .filter((p): p is number => p !== undefined);
      return [...new Set(pages)].sort((a, b) => a - b);
    },
    [sessionVerses]
  );
  const sessionSpansMultiplePages = sessionPageNumbers.length > 1;

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
      // Debounce: ignore rapid-fire interim events immediately after a match.
      if (Date.now() - lastMatchTimeRef.current < 300) return;

      const result = e.results[e.resultIndex];

      // Full accumulated transcript for this utterance.
      const bestTranscript = result[0].transcript.trim();
      const allHeardWords = stripTashkeel(bestTranscript).split(/\s+/).filter(Boolean);

      // Helper: check whether a normalised heard word matches a normalised expected word.
      const isSubsequence = (short: string, long: string) => {
        const needed = short.length;
        let i = 0;
        for (const c of long) {
          if (c === short[i]) i++;
          if (i === needed) return true;
        }
        return false;
      };
      const stripNW = (w: string) => w.replace(/[نو]/g, "");
      const wordMatches = (hw: string, ew: string): boolean => {
        if (hw.length === 1 && hw !== ew) return false;
        if (hw === lastMatchedWordRef.current) return false;
        if (
          hw === ew ||
          hw.includes(ew) ||
          ew.includes(hw) ||
          isSubsequence(hw, ew) ||
          isSubsequence(ew, hw) ||
          (stripNW(hw).length > 0 && stripNW(ew).length > 0 && stripNW(hw) === stripNW(ew))
        ) return true;
        // Fallback: normalize word-final ت → ه on both sides (handles Uthmani نعمت vs spoken نعمة).
        const hwT = hw.replace(/ت$/, "ه");
        const ewT = ew.replace(/ت$/, "ه");
        return hwT === ewT || hwT.includes(ewT) || ewT.includes(hwT);
      };

      // For each expected word, scan the FULL remaining transcript (from the last
      // matched position onward) rather than requiring a positional match.
      const startVIdx = reciteVerseIndexRef.current;
      let vIdx = startVIdx;
      let wIdx = reciteWordIndexRef.current;
      let advanced = false;
      let searchFrom = matchedWordCountRef.current;

      while (true) {
        const verse = sessionVersesRef.current[vIdx];
        if (!verse) break;
        const expectedWords = verse.text_uthmani.split(/\s+/).filter((w) => w.length > 0 && !SKIP_CHARS.test(w));
        const expectedAr = stripTashkeel(expectedWords[wIdx] || "");

        // Skip Uthmani words that strip down to ≤2 chars of only ه/ا — these
        // are pause markers or ligature fragments that speech recognition can never produce.
        if (expectedAr.length <= 2 && /^[هاا]+$/.test(expectedAr)) {
          if (wIdx + 1 >= expectedWords.length) { vIdx++; wIdx = 0; } else { wIdx++; }
          continue;
        }

        const ewRaw = expectedAr;
        const ewTry = ewRaw.replace(/^ال/, "");
        const ew = ewTry.length >= 2 ? ewTry : ewRaw;

        // Scan from searchFrom onward for any transcript word matching ew.
        let foundAt = -1;
        for (let i = searchFrom; i < allHeardWords.length; i++) {
          const hwRaw = allHeardWords[i];
          const hwTry = hwRaw.replace(/^ال/, "");
          const hw = hwTry.length >= 2 ? hwTry : hwRaw;
          console.log("SR scan:", hw, "| expected:", ew);
          if (wordMatches(hw, ew)) {
            foundAt = i;
            break;
          }
        }

        if (foundAt === -1) break; // expected word not found anywhere in transcript

        advanced = true;
        lastMatchTimeRef.current = Date.now();
        const lmwRaw = allHeardWords[foundAt];
        const lmwTry = lmwRaw.replace(/^ال/, "");
        lastMatchedWordRef.current = lmwTry.length >= 2 ? lmwTry : lmwRaw;
        matchedWordCountRef.current = foundAt + 1;
        searchFrom = foundAt + 1;

        if (wIdx + 1 >= expectedWords.length) {
          vIdx++;
          wIdx = 0;
        } else {
          wIdx++;
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

        // Auto-flip mushaf page when recite crosses a page boundary.
        const nextReciteVerse = sessionVersesRef.current[vIdx];
        const prevReciteVerse = sessionVersesRef.current[startVIdx];
        if (
          nextReciteVerse &&
          nextReciteVerse.page_number !== undefined &&
          nextReciteVerse.page_number !== prevReciteVerse?.page_number
        ) {
          setCurrentAyahNum(nextReciteVerse.verse_number);
        }
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
    console.log('handleAllRepeatsDone:', { autoAdvance, autoAdvanceRef: autoAdvanceRef.current, pendingAutoPlay: pendingAutoPlayRef.current, currentAyahNum: currentAyahNumRef.current });
    if (internalPhaseRef.current === "single") {
      if (cumulativeReviewRef.current && currentAyahNumRef.current > fromAyahRef.current) {
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
        pendingAutoPlayRef.current = autoAdvanceRef.current;
      } else if (currentAyahNumRef.current < toAyahRef.current) {
        // Always advance to next ayah; auto-play iff auto-advance is ON
        pendingPlayDelayRef.current = 150;
        pendingAutoPlayRef.current = autoAdvanceRef.current;
        setCurrentAyahNum((n) => n + 1);
      } else {
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
        pendingAutoPlayRef.current = true;
      } else {
        const nextPass = cumPassRef.current + 1;
        if (nextPass <= reviewRepeatCountRef.current) {
          // next pass — brief pause at the pass boundary
          pendingPlayDelayRef.current = 0;
          setCumAyahIdx(0);
          cumAyahIdxRef.current = 0;
          setCumPass(nextPass);
          cumPassRef.current = nextPass;
          pendingAutoPlayRef.current = true;
        } else {
          // cumulative review complete — advance to next single ayah
          if (currentAyahNumRef.current < toAyahRef.current) {
            setInternalPhase("single");
            internalPhaseRef.current = "single";
            pendingPlayDelayRef.current = 150;
            pendingAutoPlayRef.current = autoAdvanceRef.current;
            setCurrentAyahNum((n) => n + 1);
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
    setCurrentAyahNum(fromAyah);
    setReciteWordIndex(0);
    setReciteVerseIndex(0);
    setReciteAttempts(0);
    setRevealedWords(new Set());
    reciteWordIndexRef.current = 0;
    reciteVerseIndexRef.current = 0;
    matchedWordCountRef.current = 0;
    lastMatchedWordRef.current = "";
    onReciteTriggered?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerReciteMode]);

  const handleShowWord = () => {
    const key = `${reciteVerseIndex}-${reciteWordIndex}`;
    console.log("showWord adding key:", key);
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
    lastMatchedWordRef.current = "";
    const firstVerse = sessionVerses[0];
    if (firstVerse?.verse_number !== undefined) setCurrentAyahNum(firstVerse.verse_number);
  };

  // After auto-advancing (single or cumulative), start playback once the hook has reset.
  // Cumulative ayah-to-ayah transitions use delay=0 for seamless flow;
  // single-ayah advances use 150ms to let the hook fully reset first.
  useEffect(() => {
    if (!pendingAutoPlayRef.current) return;
    pendingAutoPlayRef.current = false;
    const delay = pendingPlayDelayRef.current;
    const timer = setTimeout(() => {
      playRef.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [activeVerseNumber]);

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
        pendingAutoPlayRef.current = true;
      } else {
        // Last pass done — advance to next single ayah or complete session
        setInternalPhase("single");
        internalPhaseRef.current = "single";
        if (currentAyahNum < toAyah) {
          pendingPlayDelayRef.current = 150;
          setCurrentAyahNum((n) => n + 1);
          pendingAutoPlayRef.current = true;
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
        pendingAutoPlayRef.current = true;
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
        pendingAutoPlayRef.current = true;
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

  // Precomputed active-verse tajweed + recite index map for line-based rendering
  const activeVerseEntry = displayList.find(
    ({ surahId, verseNum }) => surahId === chapter.id && verseNum === (isReciteMode ? reciteActiveVerseNumber : activeVerseNumber)
  );
  const activeTajweedHtml = stripVerseEndHtml(
    activeVerseEntry?.surahVerse?.text_uthmani_tajweed ??
    activeVerseEntry?.pageVerse?.text_uthmani_tajweed ?? ""
  );
  const activeTajweedWords = splitTajweedIntoWords(activeTajweedHtml);
  const activeHasValidTajweed = activeTajweedWords.length === words.length;
  const activeWordToReciteIdx = (() => {
    const m = new Map<number, number>();
    let ri = 0;
    for (let j = 0; j < words.length; j++) {
      if (!SKIP_CHARS.test(words[j])) m.set(j, ri++);
    }
    return m;
  })();

  // Group page words by mushaf line number (null when word data not yet loaded)
  const lineGroups = useMemo((): Array<{ lineNum: number; words: LineWord[] }> | null => {
    const all: LineWord[] = [];
    for (const { surahId, verseNum, pageVerse } of displayList) {
      if (!pageVerse?.words?.length) return null;
      // Build a forward-match map: for each API word, find its actual index in
      // the text_uthmani token array. w.position is 1-based and counts pause
      // marks (ۖ) as separate slots, but those marks are embedded in the
      // preceding token when splitting text_uthmani on whitespace — so
      // w.position - 1 is wrong for verses that contain embedded pause marks.
      const verseTokens = (pageVerse.text_uthmani ?? "").split(/\s+/).filter(Boolean);
      let lastMatchedJ = -1;
      for (const w of pageVerse.words) {
        let wordIdxInVerse: number;
        if (w.char_type_name === "end") {
          wordIdxInVerse = -1;
        } else {
          const target = stripTashkeel(w.text_uthmani);
          let found = -1;
          for (let j = lastMatchedJ + 1; j < verseTokens.length; j++) {
            if (stripTashkeel(verseTokens[j]) === target) { found = j; break; }
          }
          if (found !== -1) { lastMatchedJ = found; wordIdxInVerse = found; }
          else { wordIdxInVerse = w.position - 1; } // fallback
        }
        all.push({ verse_key: pageVerse.verse_key, surahId, verseNum, position: w.position, wordIdxInVerse, text_uthmani: w.text_uthmani, char_type_name: w.char_type_name, line_number: w.line_number });
      }
    }
    if (all.length === 0) return null;
    const map = new Map<number, LineWord[]>();
    for (const w of all) {
      if (!map.has(w.line_number)) map.set(w.line_number, []);
      map.get(w.line_number)!.push(w);
    }
    return [...map.entries()].sort(([a], [b]) => a - b).map(([lineNum, wds]) => ({ lineNum, words: wds }));
  }, [displayList]);

  // Page navigation derived values for multi-page recite sessions
  const currentWordPage = sessionVerses[reciteVerseIndex]?.page_number;
  const activePageIdx = activePage !== undefined ? sessionPageNumbers.indexOf(activePage) : -1;
  const prevPageVerse = activePageIdx > 0
    ? sessionVerses.find((v) => v.page_number === sessionPageNumbers[activePageIdx - 1])
    : undefined;
  const nextPageVerse = activePageIdx >= 0 && activePageIdx < sessionPageNumbers.length - 1
    ? sessionVerses.find((v) => v.page_number === sessionPageNumbers[activePageIdx + 1])
    : undefined;

  // Descriptive label for controls bar
  const phaseLabel = isCumulative
    ? `Ayahs ${fromAyah}–${cumUpTo} · Pass ${cumPass}/${reviewRepeatCount}`
    : `Ayah ${currentAyahNum} · ${repeatCount}× repeat`;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: localDarkMode ? "#111111" : "#f0f0f0",
      }}
    >
      {/* ── Minimal top bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: localDarkMode ? "#1a1a1a" : "#ffffff",
          borderBottom: `1px solid ${localDarkMode ? "#2a2a2a" : "#f0f0f0"}`,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setShowLeaveModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            color: localDarkMode ? "#9ca3af" : "#6b7280",
            fontSize: 14, background: "none", border: "none",
            cursor: "pointer", padding: "4px 0", minWidth: 60,
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: localDarkMode ? "#e5e5e5" : "#1a1a1a", lineHeight: 1.3 }}>
            {chapter.name_simple}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.3, marginTop: 1 }}>
            {isCumulative
              ? `Pass ${cumPass}/${reviewRepeatCount} · ${fromAyah}–${cumUpTo}`
              : `Ayah ${currentAyahNum} · ${fromAyah}–${toAyah}`}
          </p>
        </div>
        <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowSettingsPanel((v) => !v)}
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "1px solid",
              borderColor: showSettingsPanel ? "#22c55e" : (localDarkMode ? "#333" : "#e5e7eb"),
              background: showSettingsPanel ? "#f0fdf4" : (localDarkMode ? "#222" : "#fff"),
              color: showSettingsPanel ? "#16a34a" : (localDarkMode ? "#9ca3af" : "#6b7280"),
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, padding: 0, transition: "all 0.15s",
            }}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* ── Mushaf area ── */}
      <div
        style={{
          flex: 1, overflow: "hidden",
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "16px 12px 100px",
        }}
      >
        <style>{TAJWEED_CSS}</style>
        {versesLoading || !currentArabic ? (
          <div className="w-full space-y-4 pt-8 px-5" style={{ maxWidth: 680 }}>
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-4/5 rounded-xl mx-auto" />
            <Skeleton className="h-10 w-3/5 rounded-xl mx-auto" />
          </div>
        ) : (
          <div
            className="mushaf-page"
            style={{
              width: "min(680px, 96vw)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Clean page card */}
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                background: localDarkMode ? theme.parchment : "#ffffff",
                boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
                borderRadius: 12,
              }}
            >

              {/* Verse body */}
              <div
                className="arabic-text select-none"
                dir="rtl"
                lang="ar"
                style={{
                  fontFamily: '"Scheherazade New", "Amiri Quran", "me_quran", serif',
                  fontSize: "clamp(14px, 2.2vh, 28px)",
                  lineHeight: 2.0,
                  textAlign: "justify",
                  textAlignLast: "right",
                  textJustify: "inter-word",
                  wordSpacing: "0.06em",
                  letterSpacing: "0.01em",
                  color: localDarkMode ? (theme.textColor ?? "#e8d5b0") : "#1a1a1a",
                  flex: 1,
                  overflow: "hidden",
                  padding: "20px 24px 8px",
                  minHeight: 0,
                }}
              >

                {/* ── Line-based mushaf rendering (when API word data available) ── */}
                {lineGroups && (() => {
                  const nodes: React.ReactNode[] = [];
                  const seenSurahIds = new Set<number>();
                  const deco = localDarkMode ? "#3a3a3a" : "#e5e7eb";
                  const hdrColor = localDarkMode ? "#e8d5b0" : "#1a1a1a";

                  // Only show name/basmala for surahs that actually start on this page (have verse 1)
                  const surahsStartingOnPage = new Set<number>();
                  for (const { words: lws } of lineGroups) {
                    for (const lw of lws) {
                      if (lw.verseNum === 1) surahsStartingOnPage.add(lw.surahId);
                    }
                  }

                  for (const { lineNum, words: lws } of lineGroups) {
                    // Insert surah header(s) before first line of each surah that starts here
                    const newSurahs: number[] = [];
                    for (const lw of lws) {
                      if (!seenSurahIds.has(lw.surahId)) { seenSurahIds.add(lw.surahId); newSurahs.push(lw.surahId); }
                    }
                    for (const sid of newSurahs) {
                      if (!surahsStartingOnPage.has(sid)) continue;
                      const sc = allChapters.find((c) => c.id === sid);
                      nodes.push(
                        <div key={`hdr-${sid}`} style={{ textAlign: "center", margin: "8px 0 2px", direction: "rtl", ...(sid !== chapter.id ? { opacity: 0.15 } : {}) }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                            <span style={{ flex: 1, height: 1, background: deco, maxWidth: 60, display: "block" }} />
                            <span style={{ fontFamily: '"Scheherazade New", serif', fontSize: "0.85em", color: hdrColor }}>{sc?.name_arabic ?? `سُورَة ${sid}`}</span>
                            <span style={{ flex: 1, height: 1, background: deco, maxWidth: 60, display: "block" }} />
                          </div>
                          {sid !== 1 && sid !== 9 && (
                            <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 2px" }}>
                              <span style={{ fontFamily: '"Scheherazade New", serif', fontSize: "1.1em", color: localDarkMode ? "#b8a060" : "#6b5830", direction: "rtl" }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    nodes.push(
                      <div key={`ln-${lineNum}`} style={{ display: "flex", direction: "rtl", justifyContent: "center", alignItems: "center", flexWrap: "nowrap", lineHeight: 2.1, padding: "0 4px", width: "100%", gap: "0.35em" }}>
                        {lws.map((lw) => {
                          const isActiveSurah = lw.surahId === chapter.id;
                          const isActive = isActiveSurah && lw.verseNum === (isReciteMode ? reciteActiveVerseNumber : activeVerseNumber);
                          const inSelectedRange = isActiveSurah && lw.verseNum >= fromAyah && lw.verseNum <= toAyah;
                          const inCumRange = isCumulative && isActiveSurah && lw.verseNum <= cumUpTo;
                          const k = `${lw.verse_key}:${lw.position}`;

                          if (lw.char_type_name === "end") {
                            return (
                              <span key={k} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2em", height: "2em", borderRadius: "50%", border: `1.5px solid ${localDarkMode ? "#8a7a50" : "#b8974a"}`, background: localDarkMode ? "#2a2418" : "#fdf8ee", flexShrink: 0, userSelect: "none", direction: "ltr" as const, ...(!isActiveSurah ? { opacity: 0.12 } : {}) }}>
                                <span style={{ fontSize: "0.62em", color: localDarkMode ? "#c9a84c" : "#8a6020", fontFamily: "Georgia, serif", lineHeight: 1 }}>{lw.verseNum}</span>
                              </span>
                            );
                          }

                          const wi = lw.wordIdxInVerse;
                          const wc = (activeHasValidTajweed && isActive)
                            ? <span dangerouslySetInnerHTML={{ __html: activeTajweedWords[wi] ?? lw.text_uthmani }} />
                            : <>{lw.text_uthmani}</>;

                          if (isActive) {
                            const isHighlighted = highlightedWord === wi;
                            const isPast = playing && highlightedWord > wi;
                            if (isReciteMode) {
                              const ri = activeWordToReciteIdx.get(wi);
                              const rvIdx = reciteActiveVerseNumber - fromAyah;
                              const done = ri !== undefined && (rvIdx < reciteVerseIndex || (rvIdx === reciteVerseIndex && ri < reciteWordIndex));
                              const isCurr = ri !== undefined && rvIdx === reciteVerseIndex && ri === reciteWordIndex;
                              const rKey = `${rvIdx}-${ri!}`;
                              const revealed = isCurr && revealedWords.has(rKey);
                              const rs: React.CSSProperties = isCurr
                                ? { filter: revealed ? "none" : "blur(4px)", outline: "2px solid #22c55e", borderRadius: "4px", animation: revealed ? "none" : "recite-word-pulse 1.2s ease-in-out infinite" }
                                : done || ri === undefined ? {} : { filter: "blur(6px)", userSelect: "none" };
                              return <span key={k} className="inline-block transition-all duration-100 rounded-sm px-[0.1em]" style={rs}>{wc}</span>;
                            }
                            if (isBlindMode && !revealedAyahs.has(lw.verseNum)) {
                              return <span key={k} className="inline-block transition-all duration-100 rounded-sm px-[0.1em]" style={{ filter: "blur(6px)", userSelect: "none", cursor: "pointer" }} onClick={() => setRevealedAyahs((p) => { const n = new Set(p); n.add(lw.verseNum); return n; })}>{wc}</span>;
                            }
                            return (
                              <span key={k} className={cn("inline-block transition-all duration-100 rounded-sm px-[0.1em]", isHighlighted ? (isCumulative ? "bg-teal-300 text-teal-900 scale-110 shadow-sm" : "bg-amber-300 text-amber-900 scale-110 shadow-sm") : isPast ? "opacity-35" : "")} style={!isHighlighted ? { backgroundColor: "rgba(254,240,138,0.25)" } : {}}>
                                {wc}
                              </span>
                            );
                          }

                          const op = !isActiveSurah ? 0.10 : !inSelectedRange ? 0.17 : isCumulative && !inCumRange ? 0.28 : 0.55;
                          if (isReciteMode && isActiveSurah && inSelectedRange) {
                            const vi = lw.verseNum - fromAyah;
                            return <span key={k} style={{ opacity: op, display: "inline-block", ...(vi >= reciteVerseIndex ? { filter: "blur(6px)", userSelect: "none" } : {}) }}>{lw.text_uthmani}</span>;
                          }
                          if (isBlindMode) {
                            if (!isActiveSurah || !inSelectedRange) return <span key={k} style={{ opacity: op, filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{lw.text_uthmani}</span>;
                            if (!revealedAyahs.has(lw.verseNum)) return <span key={k} style={{ opacity: op, filter: "blur(6px)", userSelect: "none", cursor: "pointer", display: "inline-block" }} onClick={() => setRevealedAyahs((p) => { const n = new Set(p); n.add(lw.verseNum); return n; })}>{lw.text_uthmani}</span>;
                            return <span key={k} style={{ opacity: op, cursor: "pointer", display: "inline-block" }} onClick={() => setRevealedAyahs((p) => { const n = new Set(p); n.delete(lw.verseNum); return n; })}>{lw.text_uthmani}</span>;
                          }
                          return <span key={k} style={{ opacity: op, display: "inline-block", ...(!isActiveSurah ? { filter: "blur(0.5px)" } : {}) }}>{lw.text_uthmani}</span>;
                        })}
                      </div>
                    );
                  }
                  return nodes;
                })()}

                {/* ── Fallback flow rendering (no word data yet) ── */}
                {!lineGroups && displayList.map(
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

                    // Map each words[] position → recite index, skipping SKIP_CHARS tokens.
                    // Keeps the renderer aligned with the matcher which also filters SKIP_CHARS.
                    const wordToReciteIdx = new Map<number, number>();
                    if (isActive) {
                      let ri = 0;
                      for (let j = 0; j < words.length; j++) {
                        if (!SKIP_CHARS.test(words[j])) wordToReciteIdx.set(j, ri++);
                      }
                    }
                    if (isActive && isReciteMode) {
                      const rendererWords = words.filter(w => !SKIP_CHARS.test(w));
                      const matcherWords = (surahVerse?.text_uthmani ?? currentArabic)
                        .split(/\s+/).filter(w => w.length > 0 && !SKIP_CHARS.test(w));
                      console.log(
                        "[recite word-sync] verse", verseNum,
                        "\n  renderer:", rendererWords,
                        "\n  matcher: ", matcherWords,
                        "\n  match:", JSON.stringify(rendererWords) === JSON.stringify(matcherWords),
                      );
                    }


                    const surahChapter = allChapters.find(
                      (c) => c.id === surahId
                    );

                    const headerTextColor = localDarkMode ? "#e8d5b0" : "#1a1a1a";
                    const decorLineColor = localDarkMode ? "#3a3a3a" : "#e5e7eb";

                    return (
                      <span key={`${surahId}:${verseNum}`}>
                        {/* Inline surah header — clean centered with thin decorative lines */}
                        {showSurahHeader && (
                          <span className="block" dir="rtl" style={{ textAlign: "center", isolation: "isolate", margin: "10px 0" }}>
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                              <span style={{ flex: 1, height: 1, background: decorLineColor, maxWidth: 60, display: "block" }} />
                              <span
                                style={{
                                  fontFamily: '"Scheherazade New", "Amiri Quran", "me_quran", serif',
                                  fontSize: "1.1rem",
                                  fontWeight: 400,
                                  color: headerTextColor,
                                }}
                              >
                                {surahChapter?.name_arabic ?? `سُورَة ${surahId}`}
                              </span>
                              <span style={{ flex: 1, height: 1, background: decorLineColor, maxWidth: 60, display: "block" }} />
                            </span>
                            {surahId !== 1 && surahId !== 9 && (
                              <span style={{ display: "block", textAlign: "center", margin: "6px 0 2px" }}>
                                <span style={{ fontFamily: '"Scheherazade New", "Amiri Quran", "me_quran", serif', fontSize: "1.3rem", color: localDarkMode ? "#b8a060" : "#6b5830" }}>
                                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                                </span>
                              </span>
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
                                  // ri is undefined for SKIP_CHARS tokens — they are never
                                  // the current word and always render unblurred.
                                  const ri = wordToReciteIdx.get(i);
                                  const isWordDone =
                                    ri !== undefined && (
                                      reciteVerseIdx < reciteVerseIndex ||
                                      (reciteVerseIdx === reciteVerseIndex && ri < reciteWordIndex)
                                    );
                                  const isCurrentWord =
                                    ri !== undefined &&
                                    reciteVerseIdx === reciteVerseIndex && ri === reciteWordIndex;

                                  // Key matches handleShowWord: ${reciteVerseIndex}-${reciteWordIndex}
                                  // reciteVerseIdx === reciteVerseIndex and ri === reciteWordIndex when isCurrentWord is true.
                                  const revealKey = `${reciteVerseIdx}-${ri!}`;
                                  if (isCurrentWord) console.log("revealed check:", revealKey, revealedWords.has(revealKey));
                                  const isRevealed =
                                    isCurrentWord && revealedWords.has(revealKey);

                                  const reciteStyle: React.CSSProperties = isCurrentWord
                                    ? {
                                        filter: isRevealed ? "none" : "blur(4px)",
                                        outline: "2px solid #22c55e",
                                        borderRadius: "4px",
                                        animation: isRevealed ? "none" : "recite-word-pulse 1.2s ease-in-out infinite",
                                      }
                                    : isWordDone || ri === undefined
                                      ? {}
                                      : { filter: "blur(6px)", userSelect: "none" };

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
                              const verseWordList = verseText.split(/\s+/).filter(w => w.length > 0 && !SKIP_CHARS.test(w));
                              return (
                                <>
                                  {verseWordList.map((word, wi) => {
                                    const isWordDone = wi < reciteWordIndex;
                                    const isCurrentWord = wi === reciteWordIndex;
                                    const wordStyle: React.CSSProperties = isCurrentWord
                                      ? { filter: "blur(4px)", outline: "2px solid #22c55e", borderRadius: "4px", display: "inline-block" }
                                      : isWordDone
                                        ? { display: "inline-block" }
                                        : { filter: "blur(6px)", userSelect: "none", display: "inline-block" };
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

                        {/* Ayah end marker — small muted inline */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            fontSize: "0.6em",
                            color: "#9ca3af",
                            margin: "0 0.4em",
                            verticalAlign: "middle",
                            direction: "ltr",
                            unicodeBidi: "isolate",
                            userSelect: "none",
                            flexShrink: 0,
                          }}
                        >
                          ◆<bdo dir="ltr">{verseNum}</bdo>
                        </span>

                      </span>
                    );
                  }
                )}
              </div>

              {/* Page number */}
              <div
                style={{
                  padding: "6px 16px 14px",
                  textAlign: "center",
                  borderTop: `1px solid ${localDarkMode ? "#2a2a2a" : "#f5f5f5"}`,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    letterSpacing: "0.05em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {activePage ?? ""}
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
                  (sum, v) => sum + v.text_uthmani.split(/\s+/).filter((w) => w.length > 0 && !SKIP_CHARS.test(w)).length,
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

      {/* Leave session confirmation modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Leave this session?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your progress won't be saved unless you save first.
              </p>
            </div>
            <button
              onClick={() => {
                const dest = leaveDestinationRef.current;
                if (dest) {
                  leaveDestinationRef.current = null;
                  setShowLeaveModal(false);
                  setLocation(dest);
                } else {
                  setShowLeaveModal(false);
                  setShowPauseModal(true);
                }
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-2xl py-4 text-base transition-colors"
            >
              Save &amp; Leave
            </button>
            <button
              onClick={() => {
                const dest = leaveDestinationRef.current;
                leaveDestinationRef.current = null;
                setShowLeaveModal(false);
                if (dest) {
                  setLocation(dest);
                } else {
                  onBack();
                }
              }}
              className="w-full border border-border text-foreground font-medium rounded-2xl py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              Leave without saving
            </button>
            <button
              onClick={() => setShowLeaveModal(false)}
              className="w-full text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              Keep practicing
            </button>
          </div>
        </div>
      )}

      {/* Recite mode floating pills — shown above bottom bar in recite mode */}
      {isReciteMode && reciteVerseIndex < sessionVerses.length && (
        <div
          style={{
            position: "fixed", bottom: 92, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 8, alignItems: "center",
            zIndex: 30, flexWrap: "wrap", justifyContent: "center", padding: "0 16px",
          }}
        >
          <button
            onClick={handleShowWord}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 999,
              background: "#f0fdf4", border: "1px solid #86efac",
              color: "#15803d", fontSize: 13, fontWeight: 600,
              cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              whiteSpace: "nowrap",
            }}
          >
            <Eye size={13} />
            Show Word
          </button>
          <button
            onClick={handleReciteRestart}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 999,
              background: "#ffffff", border: "1px solid #e5e7eb",
              color: "#6b7280", fontSize: 13, fontWeight: 600,
              cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              whiteSpace: "nowrap",
            }}
          >
            <RotateCcw size={13} />
            Restart
          </button>
          {sessionSpansMultiplePages && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => nextPageVerse && setCurrentAyahNum(nextPageVerse.verse_number)}
                disabled={!nextPageVerse}
                title="Next page"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: "50%",
                  background: "#ffffff", border: "1px solid #e5e7eb",
                  color: "#6b7280", cursor: "pointer",
                  opacity: !nextPageVerse ? 0.3 : 1,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.10)", padding: 0,
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => prevPageVerse && setCurrentAyahNum(prevPageVerse.verse_number)}
                disabled={!prevPageVerse}
                title="Previous page"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: "50%",
                  background: "#ffffff", border: "1px solid #e5e7eb",
                  color: "#6b7280", cursor: "pointer",
                  opacity: !prevPageVerse ? 0.3 : 1,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.10)", padding: 0,
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          {sessionSpansMultiplePages && currentWordPage !== undefined && currentWordPage !== activePage && (
            <button
              onClick={() => { const v = sessionVerses[reciteVerseIndex]; if (v) setCurrentAyahNum(v.verse_number); }}
              style={{
                background: "none", border: "none", fontSize: 12,
                color: "#9ca3af", cursor: "pointer",
                textDecoration: "underline", padding: "0 4px",
              }}
            >
              {currentWordPage < (activePage ?? Infinity) ? "Current word →" : "← Current word"}
            </button>
          )}
        </div>
      )}

      {/* ── Floating bottom toolbar ── */}
      <div
        style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: localDarkMode ? "#1a1a1a" : "#ffffff",
          borderRadius: 999,
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          padding: "10px 20px",
          display: "flex", alignItems: "center", gap: 6,
          zIndex: 40,
          border: localDarkMode ? "1px solid #2a2a2a" : "none",
        }}
      >
        {/* Prev */}
        <button
          onClick={goPrev}
          disabled={isReciteMode || (isCumulative ? false : currentAyahNum <= fromAyah)}
          title={isCumulative ? "Exit cumulative review" : "Previous ayah"}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid",
            borderColor: localDarkMode ? "#333" : "#e5e7eb",
            background: "transparent",
            color: localDarkMode ? "#9ca3af" : "#6b7280",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, flexShrink: 0,
            opacity: (isReciteMode || (!isCumulative && currentAyahNum <= fromAyah)) ? 0.3 : 1,
          }}
        >
          <SkipBack size={16} />
        </button>

        {/* Repeat count or cumulative pass indicator */}
        {!isCumulative ? (
          <div style={{ display: "flex", alignItems: "center", gap: 3, margin: "0 2px" }}>
            {Array.from({ length: repeatCount }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i < currentRepeat ? 9 : 7,
                  height: i < currentRepeat ? 9 : 7,
                  borderRadius: "50%",
                  background: i < currentRepeat ? "#22c55e" : (localDarkMode ? "#333" : "#d1d5db"),
                  transition: "all 0.3s",
                  boxShadow: i === currentRepeat - 1 && playing ? "0 0 0 2px #22c55e40" : "none",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: "#0d9488", fontWeight: 600, whiteSpace: "nowrap", margin: "0 4px" }}>
            Pass {cumPass}/{reviewRepeatCount}
          </span>
        )}

        {/* Play / Pause — large green circle */}
        <button
          onClick={play}
          disabled={isReciteMode || loading || versesLoading || !currentArabic}
          style={{
            width: 52, height: 52, borderRadius: "50%",
            background: isCumulative ? "#0d9488" : "#22c55e",
            color: "#ffffff", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            flexShrink: 0, transition: "background 0.2s",
            opacity: (isReciteMode || loading || versesLoading || !currentArabic) ? 0.5 : 1,
            padding: 0,
          }}
        >
          {loading ? (
            <Loader2 size={22} className="animate-spin" />
          ) : playing ? (
            <Pause size={20} />
          ) : (
            <Play size={20} style={{ marginLeft: 2 }} />
          )}
        </button>

        {/* Skip repeat */}
        <button
          onClick={handleSkipRepeat}
          disabled={isReciteMode || (!isCumulative && repeatCount <= 1)}
          title={isCumulative ? "Skip pass" : "Skip repeat"}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid",
            borderColor: localDarkMode ? "#333" : "#e5e7eb",
            background: "transparent",
            color: localDarkMode ? "#9ca3af" : "#6b7280",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, flexShrink: 0,
            opacity: (isReciteMode || (!isCumulative && repeatCount <= 1)) ? 0.3 : 1,
          }}
        >
          <ChevronsRight size={16} />
        </button>

        {/* Skip ayah */}
        <button
          onClick={skipAyah}
          disabled={isReciteMode}
          title={isCumulative ? "Skip cumulative review" : "Skip ayah"}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid",
            borderColor: localDarkMode ? "#333" : "#e5e7eb",
            background: "transparent",
            color: localDarkMode ? "#9ca3af" : "#6b7280",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, flexShrink: 0,
            opacity: isReciteMode ? 0.3 : 1,
          }}
        >
          <SkipForward size={16} />
        </button>

        {/* Divider */}
        <span style={{ width: 1, height: 20, background: localDarkMode ? "#333" : "#e5e7eb", margin: "0 2px", flexShrink: 0 }} />

        {/* Page indicator */}
        <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 22, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {activePage ?? ""}
        </span>
      </div>

      {/* ── Settings overlay panel ── */}
      {showSettingsPanel && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.3)",
          }}
          onClick={() => setShowSettingsPanel(false)}
        >
          <div
            style={{
              position: "fixed", top: 0, right: 0,
              height: "100vh", width: 320,
              background: localDarkMode ? "#1a1a1a" : "#ffffff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
              padding: "24px 20px 32px",
              overflowY: "auto",
              transform: "translateX(0)",
              transition: "transform 0.25s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: localDarkMode ? "#e5e5e5" : "#1a1a1a", margin: 0 }}>Settings</h3>
              <button onClick={() => setShowSettingsPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: localDarkMode ? "#9ca3af" : "#6b7280", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            {/* Auto-advance */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 14, color: localDarkMode ? "#d1d5db" : "#374151", margin: 0 }}>Auto-advance</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Play continuously through all ayahs</p>
              </div>
              <button
                onClick={() => setAutoAdvance((a) => !a)}
                style={{
                  padding: "5px 14px", borderRadius: 999,
                  background: autoAdvance ? "#22c55e" : (localDarkMode ? "#2a2a2a" : "#f3f4f6"),
                  color: autoAdvance ? "#ffffff" : (localDarkMode ? "#9ca3af" : "#6b7280"),
                  border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                  transition: "all 0.15s", flexShrink: 0,
                }}
              >
                {autoAdvance ? "on" : "off"}
              </button>
            </div>

            {/* Blind mode */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 14, color: localDarkMode ? "#d1d5db" : "#374151", margin: 0 }}>Blind mode</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Blur ayahs for memorization challenge</p>
              </div>
              <button
                onClick={() => { setIsBlindMode((v) => !v); setIsReciteMode(false); }}
                style={{
                  padding: "5px 14px", borderRadius: 999,
                  background: isBlindMode ? "#22c55e" : (localDarkMode ? "#2a2a2a" : "#f3f4f6"),
                  color: isBlindMode ? "#ffffff" : (localDarkMode ? "#9ca3af" : "#6b7280"),
                  border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                  transition: "all 0.15s", flexShrink: 0,
                }}
              >
                {isBlindMode ? "on" : "off"}
              </button>
            </div>

            {/* Recite mode */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 14, color: localDarkMode ? "#d1d5db" : "#374151", margin: 0 }}>Recite mode</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Use speech recognition to recite</p>
              </div>
              <button
                onClick={() => {
                  setIsReciteMode((v) => {
                    if (!v) {
                      stopAudio();
                      setReciteWordIndex(0);
                      setReciteVerseIndex(0);
                      setReciteAttempts(0);
                      setRevealedWords(new Set());
                      reciteWordIndexRef.current = 0;
                      reciteVerseIndexRef.current = 0;
                      matchedWordCountRef.current = 0;
                      lastMatchedWordRef.current = "";
                    }
                    return !v;
                  });
                  setIsBlindMode(false);
                }}
                style={{
                  padding: "5px 14px", borderRadius: 999,
                  background: isReciteMode ? "#22c55e" : (localDarkMode ? "#2a2a2a" : "#f3f4f6"),
                  color: isReciteMode ? "#ffffff" : (localDarkMode ? "#9ca3af" : "#6b7280"),
                  border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                  transition: "all 0.15s", flexShrink: 0,
                }}
              >
                {isReciteMode ? "on" : "off"}
              </button>
            </div>

            {/* Dark mode */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, color: localDarkMode ? "#d1d5db" : "#374151", margin: 0 }}>Dark mode</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Switch page to dark background</p>
              </div>
              <button
                onClick={toggleLocalDarkMode}
                style={{
                  padding: "5px 14px", borderRadius: 999,
                  background: localDarkMode ? "#22c55e" : "#f3f4f6",
                  color: localDarkMode ? "#ffffff" : "#6b7280",
                  border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
                  transition: "all 0.15s", flexShrink: 0,
                }}
              >
                {localDarkMode ? "on" : "off"}
              </button>
            </div>

            {/* Theme picker */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 8px" }}>Theme</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(Object.keys(MUSHAF_THEMES) as Array<keyof typeof MUSHAF_THEMES>)
                  .filter((key) => localDarkMode ? key.endsWith("_dark") : !key.endsWith("_dark"))
                  .map((key) => (
                    <button
                      key={key}
                      onClick={() => setMushafTheme(key)}
                      title={MUSHAF_THEMES[key].name}
                      style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: MUSHAF_THEMES[key].banner,
                        border: mushafTheme === key ? "2px solid #d4af37" : "2px solid transparent",
                        outline: mushafTheme === key ? "1px solid #d4af37" : "none",
                        outlineOffset: "1px",
                        cursor: "pointer", padding: 0,
                      }}
                    />
                  ))}
              </div>
            </div>

            {/* Pause & Save */}
            <button
              onClick={() => {
                stopAudio();
                setPauseToAyah(currentAyahNum);
                setShowPauseModal(true);
                setShowSettingsPanel(false);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 20px", borderRadius: 12, width: "100%",
                background: "#fffbeb", border: "1px solid #fcd34d",
                color: "#92400e", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Flag size={14} />
              Pause &amp; Save
            </button>

            {/* View in Full Mushaf */}
            <button
              onClick={() => {
                leaveDestinationRef.current = `/child/${childId}/mushaf-reader?page=${activePage ?? 1}`;
                setShowSettingsPanel(false);
                setShowLeaveModal(true);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 20px", borderRadius: 12, width: "100%", marginTop: 8,
                background: localDarkMode ? "#1a2a3a" : "#f0f9ff",
                border: `1px solid ${localDarkMode ? "#334455" : "#bae6fd"}`,
                color: localDarkMode ? "#7dd3fc" : "#0369a1", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📖 View in Full Mushaf
            </button>

            {error && (
              <p style={{ color: "#ef4444", fontSize: 12, textAlign: "center", marginTop: 8 }}>
                ⚠ Audio unavailable
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuranMemorizePage() {
  const { childId } = useParams<{ childId: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { settings } = useSettings();

  const [phase, setPhase] = useState<"pick" | "setup" | "play" | "check">("pick");
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(10);
  const [repeatCount, setRepeatCount] = useState(settings.defaultRepeatCount);
  const [autoAdvance, setAutoAdvance] = useState(settings.autoAdvance);
  const [cumulativeReview, setCumulativeReview] = useState(settings.cumulativeReview);
  const [reviewRepeatCount, setReviewRepeatCount] = useState(settings.defaultReviewRepeatCount);
  const [startAyah, setStartAyah] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkRating, setCheckRating] = useState<"needs_work" | "good" | "excellent" | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [triggerReciteMode, setTriggerReciteMode] = useState(false);
  const [reciteSource, setReciteSource] = useState(false);
  const [reciteScore, setReciteScore] = useState(0);
  const [celebration, setCelebration] = useState<{ message: string; subMessage?: string } | null>(null);

  // String state for the setup-phase From/To inputs — allows free typing before blur commit
  const [fromInput, setFromInput] = useState(String(fromAyah));
  const [toInput, setToInput] = useState(String(toAyah));
  useEffect(() => setFromInput(String(fromAyah)), [fromAyah]);
  useEffect(() => setToInput(String(toAyah)), [toAyah]);

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

            {/* Surah navigation */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => {
                  const prev = chapters.find((c) => c.id === selectedChapter.id - 1);
                  if (prev) {
                    setSelectedChapter(prev);
                    setFromAyah(1);
                    setToAyah(prev.verses_count);
                    navigate(`/child/${childId}/quran-memorize?surah=${prev.id}`);
                  }
                }}
                disabled={selectedChapter.id === 1}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30 hover:bg-white/25 transition-colors flex-shrink-0"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                value={selectedChapter.id}
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  const ch = chapters.find((c) => c.id === id);
                  if (ch) {
                    setSelectedChapter(ch);
                    setFromAyah(1);
                    setToAyah(ch.verses_count);
                    navigate(`/child/${childId}/quran-memorize?surah=${ch.id}`);
                  }
                }}
                className="flex-1 bg-white/15 text-white text-sm rounded-full px-3 py-1.5 border border-white/30 outline-none cursor-pointer"
              >
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id} className="text-black bg-white">
                    {ch.id}. {ch.name_simple} — {ch.name_arabic}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const next = chapters.find((c) => c.id === selectedChapter.id + 1);
                  if (next) {
                    setSelectedChapter(next);
                    setFromAyah(1);
                    setToAyah(next.verses_count);
                    navigate(`/child/${childId}/quran-memorize?surah=${next.id}`);
                  }
                }}
                disabled={selectedChapter.id === 114}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30 hover:bg-white/25 transition-colors flex-shrink-0"
              >
                <ChevronRight size={16} />
              </button>
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
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  onBlur={() => {
                    const v = Math.max(1, Math.min(maxAyah, parseInt(fromInput) || 1));
                    setFromAyah(v);
                    if (v > toAyah) setToAyah(v);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
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
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(toInput);
                    const v = Math.max(fromAyah, Math.min(maxAyah, isNaN(parsed) ? fromAyah : parsed));
                    setToAyah(v);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
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
                  Keep playing until the full session is complete
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
      show={celebration !== null && settings.confetti}
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
              <span dir="rtl" style={{ unicodeBidi: "embed" }}>{selectedChapter.name_simple}</span> · Ayahs {fromAyah}–{toAyah}
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
                  <span className="font-medium text-foreground arabic-text" dir="rtl" style={{ unicodeBidi: "embed" }}>
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
                  <span className="font-medium text-foreground arabic-text" dir="rtl" style={{ unicodeBidi: "embed" }}>
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
                    <span dir="rtl" style={{ unicodeBidi: "embed" }}>{selectedChapter.name_simple}</span> ayahs {fromAyah}–{toAyah} marked as memorized.
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
