import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { Audio } from "expo-av";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import { ayahAudioUrl, wbwAudioUrl } from "@/src/lib/audio";
import { stripTashkeel, wordMatches, stripAlPrefix, tokenize, SKIP_CHARS } from "@/src/lib/recite";
import {
  fetchDashboard,
  fetchMemorizationProgress,
  fetchSurahs,
  fetchTimingsForReciter,
  submitDailyProgress,
  submitMemorization,
  type Segment,
  type ChapterTimings,
  type DashboardResponse,
  type MemorizationProgress,
  type MemorizationStatus,
  type NewMemorization,
  type SurahSummary,
  type TodayProgress,
  type WorkStatus,
} from "@/src/lib/memorization";
import {
  fetchSurahVerses,
  fetchVersesByPage,
  fetchAllChapters,
  type ApiWord,
  type ApiPageVerse,
  type ApiChapter,
} from "@/src/lib/quran";
import {
  THEMES,
  DEFAULT_THEME_KEY,
  THEME_DISPLAY_NAMES,
  getJuzForPage,
  type ThemeKey,
  type MushafTheme,
} from "@/src/lib/mushaf-theme";
import { MUSHAF_SURAHS, clampMushafPage } from "@/src/lib/mushaf";
import { findReciter, RECITERS } from "@/src/lib/reciters";
import {
  clearMemorizationSessionBookmark,
  DEFAULT_SESSION_SETTINGS,
  loadMemorizationSessionBookmark,
  loadDefaultSessionSettings,
  loadProfileSettings,
  saveMemorizationSessionBookmark,
  saveProfileSettings,
  type MemorizationSessionBookmark,
} from "@/src/lib/settings";
import { extractTajweedColor } from "@/src/lib/tajweed";
import { CelebrationOverlay } from "@/src/components/celebration-overlay";

const PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5] as const;
type InternalPhase = "single" | "cumulative";
type DiscoveryFilter = "all" | "current" | "in_progress" | "not_started" | "memorized" | "needs_review";
type AyahTone = "white" | "red" | "orange" | "green";
type ReviewStrengthTone = "red" | "orange" | "green";

type DiscoveryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      dashboard: DashboardResponse;
      progress: MemorizationProgress[];
      surahs: SurahSummary[];
    };

type SessionTarget = {
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  currentAyah?: number;
  pageStart?: number | null;
  pageEnd?: number | null;
  isReviewOnly?: boolean;
  startInRecitationCheck?: boolean;
};

type AyahSheetTarget = {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number | null;
  textUthmani: string;
};

type TappedWordTarget = {
  key: string;
  arabic: string;
  translation: string;
  surahNumber: number;
  ayahNumber: number;
  position: number;
};

const DISCOVERY_FILTERS: Array<{ key: DiscoveryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "current", label: "Current" },
  { key: "in_progress", label: "Learning" },
  { key: "not_started", label: "New" },
  { key: "memorized", label: "Memorized" },
  { key: "needs_review", label: "Review" },
];

const DISCOVERY_CHUNK_AYAHS = 5;

const REVIEW_TONE_META: Record<
  ReviewStrengthTone,
  { label: string; color: string; bg: string; border: string }
> = {
  red: {
    label: "Review red",
    color: "#dc2626",
    bg: "#fff1f2",
    border: "#fecdd3",
  },
  orange: {
    label: "Review orange",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  green: {
    label: "Review green",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
};

type QualityRatingValue = 2 | 4 | 5;
type RecitationCheckSource = "teacher" | "noorpath";
type CompletionCelebration = {
  message: string;
  subMessage?: string;
};

const QUALITY_OPTIONS: Array<{
  value: QualityRatingValue;
  label: string;
  detail: string;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    value: 2,
    label: "Needs Work",
    detail: "Mark this range red for more practice.",
    color: "#be123c",
    bg: "#fff1f2",
    border: "#fecdd3",
  },
  {
    value: 4,
    label: "Good",
    detail: "Mark this range yellow while it settles.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  {
    value: 5,
    label: "Excellent",
    detail: "Mark this range green and strong.",
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
];

function formatAyahRange(start: number | undefined | null, end: number | undefined | null) {
  if (start == null || end == null) return "Ayahs";
  return start === end ? `Ayah ${start}` : `Ayahs ${start}-${end}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatPageRange(start: number | undefined | null, end: number | undefined | null) {
  if (start == null || end == null) return null;
  return start === end ? `Page ${start}` : `Pages ${start}-${end}`;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clampStrength(value: number | undefined | null) {
  return Math.max(1, Math.min(5, Math.round(value ?? 1)));
}

function getRecitationScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Keep Practicing";
}

function getStatusCopy(status: MemorizationStatus) {
  switch (status) {
    case "memorized":
      return { label: "Memorized", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" };
    case "in_progress":
      return { label: "Learning", color: "#b45309", bg: "#fffbeb", border: "#fde68a" };
    case "needs_review":
      return { label: "Needs review", color: "#be123c", bg: "#fff1f2", border: "#fecdd3" };
    case "not_started":
    default:
      return { label: "New", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" };
  }
}

function getAyahTone(
  ayah: number,
  memorizedSet: Set<number>,
  ayahStrengths: Record<string, number> | undefined,
  fallbackStrength: number | undefined,
): AyahTone {
  if (!memorizedSet.has(ayah)) return "white";

  const strength = ayahStrengths?.[String(ayah)] ?? clampStrength(fallbackStrength);
  if (strength <= 1) return "red";
  if (strength <= 3) return "orange";
  return "green";
}

function getReviewStrengthTone(progress: MemorizationProgress): ReviewStrengthTone | null {
  const memorizedAyahs = progress.memorizedAyahs ?? [];
  if (memorizedAyahs.length === 0) return null;

  const memorizedSet = new Set(memorizedAyahs);
  const hasRed = memorizedAyahs.some(
    (ayah) => getAyahTone(ayah, memorizedSet, progress.ayahStrengths, progress.strength) === "red",
  );
  if (hasRed) return "red";

  const isFullyMemorized = memorizedAyahs.length >= progress.totalVerses;
  if (!isFullyMemorized) return "orange";

  const hasOrange = memorizedAyahs.some(
    (ayah) => getAyahTone(ayah, memorizedSet, progress.ayahStrengths, progress.strength) === "orange",
  );
  if (hasOrange) return "orange";

  return "green";
}

function getStrengthLabel(strength: number | undefined | null) {
  const value = clampStrength(strength);
  if (value >= 5) return "Very strong";
  if (value === 4) return "Solid";
  if (value === 3) return "Learning";
  if (value === 2) return "Shaky";
  return "Starting";
}

function firstUnmemorizedAyah(progress: MemorizationProgress) {
  const memorized = new Set(progress.memorizedAyahs ?? []);
  for (let ayah = 1; ayah <= progress.totalVerses; ayah += 1) {
    if (!memorized.has(ayah)) return ayah;
  }
  return Math.min(progress.totalVerses, Math.max(1, progress.versesMemorized + 1));
}

function buildProgressTarget(progress: MemorizationProgress): SessionTarget {
  const start = progress.status === "memorized" ? 1 : firstUnmemorizedAyah(progress);
  const end = Math.min(progress.totalVerses, start + DISCOVERY_CHUNK_AYAHS - 1);
  const fallbackPages = estimatePageRange(progress.surahNumber, start, end);
  return {
    surahNumber: progress.surahNumber,
    ayahStart: start,
    ayahEnd: end,
    pageStart: fallbackPages.pageStart,
    pageEnd: fallbackPages.pageEnd,
  };
}

function estimatePageRange(surahNumber: number, ayahStart: number, ayahEnd: number) {
  const surah = MUSHAF_SURAHS.find((item) => item.number === surahNumber);
  if (!surah) return { pageStart: null, pageEnd: null };
  const pageSpan = Math.max(1, surah.endPage - surah.startPage + 1);
  const estimate = (ayah: number) => {
    const fraction = Math.max(0, Math.min(1, (ayah - 1) / Math.max(1, surah.verseCount)));
    return surah.startPage + Math.floor(fraction * pageSpan);
  };
  return {
    pageStart: Math.max(surah.startPage, estimate(ayahStart) - 1),
    pageEnd: Math.min(surah.endPage, estimate(ayahEnd) + 1),
  };
}

function buildAyahRange(start: number, end: number) {
  const safeStart = Math.max(1, Math.min(start, end));
  const safeEnd = Math.max(safeStart, Math.max(start, end));
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => safeStart + index);
}

function mergeMemorizedAyahs(existingAyahs: number[] | undefined, sessionAyahs: number[], totalVerses: number) {
  return Array.from(
    new Set([...(existingAyahs ?? []), ...sessionAyahs])
  )
    .filter((ayah) => Number.isInteger(ayah) && ayah >= 1 && ayah <= totalVerses)
    .sort((a, b) => a - b);
}

function hasFullSurahMemorized(memorizedAyahs: number[], totalVerses: number) {
  if (totalVerses <= 0) return false;
  const memorized = new Set(memorizedAyahs);
  for (let ayah = 1; ayah <= totalVerses; ayah += 1) {
    if (!memorized.has(ayah)) return false;
  }
  return true;
}

function buildWorkTarget(work: NewMemorization): SessionTarget {
  const surahNumber = work.currentWorkSurahNumber ?? work.surahNumber;
  const ayahStart = work.currentWorkAyahStart ?? work.ayahStart;
  const ayahEnd = work.currentWorkAyahEnd ?? work.ayahEnd;
  return {
    surahNumber,
    ayahStart,
    ayahEnd,
    pageStart: work.pageStart,
    pageEnd: work.pageEnd,
    isReviewOnly: work.isReviewOnly,
  };
}

function buildFullWorkTarget(work: NewMemorization): SessionTarget {
  return {
    surahNumber: work.surahNumber,
    ayahStart: work.ayahStart,
    ayahEnd: work.ayahEnd,
    pageStart: work.pageStart,
    pageEnd: work.pageEnd,
    isReviewOnly: work.isReviewOnly,
  };
}

function buildBookmarkTarget(bookmark: MemorizationSessionBookmark): SessionTarget {
  const pages =
    typeof bookmark.pageStart === "number" && typeof bookmark.pageEnd === "number"
      ? { pageStart: bookmark.pageStart, pageEnd: bookmark.pageEnd }
      : estimatePageRange(bookmark.surahNumber, bookmark.fromAyah, bookmark.toAyah);
  return {
    surahNumber: bookmark.surahNumber,
    ayahStart: bookmark.fromAyah,
    ayahEnd: bookmark.toAyah,
    currentAyah: bookmark.currentAyah,
    pageStart: pages.pageStart,
    pageEnd: pages.pageEnd,
    isReviewOnly: bookmark.isReviewOnly,
  };
}

function getBookmarkSurahName(
  surahNumber: number,
  chaptersMap: Map<number, ApiChapter>,
  fallback?: string,
) {
  return (
    fallback ??
    chaptersMap.get(surahNumber)?.name_simple ??
    MUSHAF_SURAHS.find((surah) => surah.number === surahNumber)?.name ??
    `Surah ${surahNumber}`
  );
}

function scoreProgress(progress: MemorizationProgress[]) {
  const memorized = progress.filter((item) => item.status === "memorized").length;
  const learning = progress.filter((item) => item.status === "in_progress").length;
  const strengthItems = progress.filter(
    (item) =>
      item.status === "memorized" ||
      item.status === "in_progress" ||
      (item.memorizedAyahs?.length ?? 0) > 0 ||
      item.versesMemorized > 0,
  );
  const average =
    strengthItems.length > 0
      ? Math.round(
          strengthItems.reduce((sum, item) => sum + clampStrength(item.strength), 0) /
            strengthItems.length,
        )
      : null;
  return { memorized, learning, average };
}

export default function MemorizationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    childId: string;
    name: string;
    surahNumber?: string;
    ayahStart?: string;
    ayahEnd?: string;
    pageStart?: string;
    pageEnd?: string;
    session?: string;
    recite?: string;
    viewMode?: "ayah" | "page";
  }>();
  const childId = params.childId;
  const routeViewMode =
    params.viewMode === "page" || params.viewMode === "ayah" ? params.viewMode : null;
  const initialSessionRequested =
    params.session === "1" ||
    (params.surahNumber !== undefined &&
      params.ayahStart !== undefined &&
      params.ayahEnd !== undefined);

  const [surahNumber, setSurahNumber] = useState<number | null>(
    params.surahNumber ? Number(params.surahNumber) : null,
  );
  const [ayahStart, setAyahStart] = useState<number | null>(
    params.ayahStart ? Number(params.ayahStart) : null,
  );
  const [ayahEnd, setAyahEnd] = useState<number | null>(
    params.ayahEnd ? Number(params.ayahEnd) : null,
  );
  const [currentVerse, setCurrentVerse] = useState<number>(
    params.ayahStart ? Number(params.ayahStart) : 1,
  );
  const [pageStart, setPageStart] = useState<number | null>(
    params.pageStart ? Number(params.pageStart) : null,
  );
  const [pageEnd, setPageEnd] = useState<number | null>(
    params.pageEnd ? Number(params.pageEnd) : null,
  );
  const [sessionRequested, setSessionRequested] = useState(initialSessionRequested);
  const [sessionLoadId, setSessionLoadId] = useState(0);
  const [sessionReviewOnly, setSessionReviewOnly] = useState(false);
  const [startInRecitationCheck, setStartInRecitationCheck] = useState(false);
  const [startInReciteMode, setStartInReciteMode] = useState(params.recite === "1");
  const [pendingSessionTarget, setPendingSessionTarget] = useState<SessionTarget | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>({ status: "loading" });
  const [discoveryRefreshing, setDiscoveryRefreshing] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilter>("all");
  const [sessionBookmark, setSessionBookmark] = useState<MemorizationSessionBookmark | null>(null);
  const [displayWordsMap, setDisplayWordsMap] = useState<Map<number, ApiWord[]>>(new Map());
  const [chapterTimings, setChapterTimings] = useState<ChapterTimings | null>(null);
  const [pageWordsMap, setPageWordsMap] = useState<Map<number, ApiPageVerse[]>>(new Map());
  const [versePageMap, setVersePageMap] = useState<Map<number, number>>(new Map());
  const [displayedMushafPage, setDisplayedMushafPage] = useState<number | null>(null);
  const [chaptersMap, setChaptersMap] = useState<Map<number, ApiChapter>>(new Map());

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRepeatDisplay, setCurrentRepeatDisplay] = useState(1);
  const [highlightedWord, setHighlightedWord] = useState(-1);
  const [highlightedPage, setHighlightedPage] = useState<{
    verseKey: string;
    position: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  const [pauseCompletedAyahEnd, setPauseCompletedAyahEnd] = useState<number | null>(null);
  const [readyToReciteSheetOpen, setReadyToReciteSheetOpen] = useState(false);
  const [completionSheetOpen, setCompletionSheetOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityRatingValue | null>(null);
  const [ratingAyahEnd, setRatingAyahEnd] = useState<number | null>(null);
  const [recitationCheckSource, setRecitationCheckSource] =
    useState<RecitationCheckSource>("teacher");
  const [recitationScore, setRecitationScore] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CompletionCelebration | null>(null);

  // Session-level settings — initialized from parent defaults each session.
  const [repeatCount, setRepeatCount] = useState<number>(DEFAULT_SESSION_SETTINGS.repeatCount);
  const [autoAdvanceDelayMs, setAutoAdvanceDelayMs] = useState<number>(DEFAULT_SESSION_SETTINGS.autoAdvanceDelayMs);
  const [autoplayThroughRange, setAutoplayThroughRange] = useState<boolean>(DEFAULT_SESSION_SETTINGS.autoplayThroughRange);
  const [blindMode, setBlindMode] = useState<boolean>(DEFAULT_SESSION_SETTINGS.blindMode);
  const [blurMode, setBlurMode] = useState<boolean>(DEFAULT_SESSION_SETTINGS.blurMode);
  const [viewMode, setViewMode] = useState<"ayah" | "page">(routeViewMode ?? "ayah");
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [reciterId, setReciterId] = useState("husary");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revealedVerses, setRevealedVerses] = useState<Set<string>>(new Set());
  const [tajweedEnabled, setTajweedEnabled] = useState<boolean>(false);
  const [translationPopup, setTranslationPopup] = useState<{
    arabic: string;
    translation: string;
  } | null>(null);
  const [tappedWord, setTappedWord] = useState<TappedWordTarget | null>(null);
  const [wordAudioLoadingKey, setWordAudioLoadingKey] = useState<string | null>(null);
  const [tappedAyah, setTappedAyah] = useState<AyahSheetTarget | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const playbackRateRef = useRef(playbackRate);
  const [internalPhase, setInternalPhase] = useState<InternalPhase>("single");
  const [cumAyahIdx, setCumAyahIdx] = useState<number>(0);
  const [cumPass, setCumPass] = useState<number>(1);
  const [cumUpTo, setCumUpTo] = useState<number>(0);
  const [cumulativeReview, setCumulativeReview] = useState<boolean>(
    DEFAULT_SESSION_SETTINGS.cumulativeReview,
  );
  const [reviewRepeatCount, setReviewRepeatCount] = useState<number>(
    DEFAULT_SESSION_SETTINGS.reviewRepeatCount,
  );
  const [confettiEnabled, setConfettiEnabled] = useState<boolean>(
    DEFAULT_SESSION_SETTINGS.confetti,
  );

  // Recite mode
  const [reciteMode, setReciteMode] = useState(false);
  const [reciteListening, setReciteListening] = useState(false);
  const [reciteError, setReciteError] = useState<string | null>(null);
  const [reciteExpectedIdx, setReciteExpectedIdx] = useState(0);
  const [reciteAttempts, setReciteAttempts] = useState(0);
  const [revealedReciteWords, setRevealedReciteWords] = useState<Set<string>>(new Set());

  // Derived from reciterId state
  const reciter = findReciter(reciterId);
  const playingVerseNumber =
    internalPhase === "cumulative" && ayahStart !== null
      ? ayahStart + cumAyahIdx
      : currentVerse;

  // Themed styles factory — recomputed only when themeKey changes
  const themedStyles = useMemo(() => makeThemedStyles(THEMES[themeKey]), [themeKey]);

  // Audio + RAF refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const wordAudioSoundRef = useRef<Audio.Sound | null>(null);
  const rafIdRef = useRef<number>(0);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const segsRef = useRef<Segment[]>([]);
  const autoPlayRef = useRef(false);
  const isLoadingRef = useRef(false);
  const completionSheetOpenRef = useRef(false);
  const suppressPlaybackForNavigationRef = useRef(false);

  // Refs readable inside async callbacks and RAF ticks (avoid stale closures)
  const viewModeRef = useRef<"ayah" | "page">(viewMode);
  const currentVerseRef = useRef<number>(currentVerse);
  const playingVerseNumberRef = useRef<number>(playingVerseNumber);
  const ayahStartRef = useRef<number | null>(ayahStart);
  const ayahEndRef = useRef<number | null>(ayahEnd);
  const isPlayingRef = useRef(false);
  const pendingSeekPositionRef = useRef<number | null>(null);
  const reciterRef = useRef(reciter);
  const readyToReciteSheetOpenRef = useRef(false);
  const restoreReadyPromptAfterLeaveRef = useRef(false);
  const internalPhaseRef = useRef<InternalPhase>("single");
  const cumAyahIdxRef = useRef(0);
  const cumPassRef = useRef(1);
  const cumUpToRef = useRef(0);
  const cumulativeReviewRef = useRef(cumulativeReview);
  const reviewRepeatCountRef = useRef(reviewRepeatCount);

  // Refs for practice settings (audio callbacks close over stale state otherwise)
  const repeatCountRef = useRef(repeatCount);
  const autoAdvanceDelayRef = useRef(autoAdvanceDelayMs);
  const autoplayThroughRangeRef = useRef(autoplayThroughRange);
  const currentRepeatRef = useRef(1);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Layout refs for auto-scroll
  const scrollViewRef = useRef<ScrollView>(null);
  const lineLayoutMap = useRef<Map<string, number>>(new Map());
  const pageCardLayoutMap = useRef<Map<number, number>>(new Map());
  const autoScrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recite refs (callbacks read these; state isn't visible inside listeners)
  const reciteModeRef = useRef(false);
  const reciteExpectedIdxRef = useRef(0);
  const reciteAttemptsRef = useRef(0);
  const revealedReciteWordsRef = useRef<Set<string>>(new Set());
  const displayWordsMapRef = useRef<Map<number, ApiWord[]>>(new Map());
  const surahNumberRef = useRef<number | null>(null);
  const matchedWordCountRef = useRef(0);
  const lastMatchedWordRef = useRef("");
  const lastMatchTimeRef = useRef(0);

  // Keep callback-visible refs in sync with state
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { currentVerseRef.current = currentVerse; }, [currentVerse]);
  useEffect(() => { playingVerseNumberRef.current = playingVerseNumber; }, [playingVerseNumber]);
  useEffect(() => { reciteModeRef.current = reciteMode; }, [reciteMode]);
  useEffect(() => { reciteExpectedIdxRef.current = reciteExpectedIdx; }, [reciteExpectedIdx]);
  useEffect(() => { reciteAttemptsRef.current = reciteAttempts; }, [reciteAttempts]);
  useEffect(() => { revealedReciteWordsRef.current = revealedReciteWords; }, [revealedReciteWords]);
  useEffect(() => { displayWordsMapRef.current = displayWordsMap; }, [displayWordsMap]);
  useEffect(() => { surahNumberRef.current = surahNumber; }, [surahNumber]);
  useEffect(() => { reciterRef.current = reciter; }, [reciter]);
  useEffect(() => { internalPhaseRef.current = internalPhase; }, [internalPhase]);
  useEffect(() => { cumAyahIdxRef.current = cumAyahIdx; }, [cumAyahIdx]);
  useEffect(() => { cumPassRef.current = cumPass; }, [cumPass]);
  useEffect(() => { cumUpToRef.current = cumUpTo; }, [cumUpTo]);
  useEffect(() => { cumulativeReviewRef.current = cumulativeReview; }, [cumulativeReview]);
  useEffect(() => { reviewRepeatCountRef.current = reviewRepeatCount; }, [reviewRepeatCount]);

  // Clear reveals on context switches so old peeks don't bleed through
  useEffect(() => { setRevealedVerses(new Set()); }, [viewMode]);
  useEffect(() => { setRevealedVerses(new Set()); }, [blindMode]);
  useEffect(() => { setTappedWord(null); }, [viewMode]);
  useEffect(() => { setTappedWord(null); }, [playingVerseNumber]);
  useEffect(() => {
    if (blindMode || reciteMode) setTappedWord(null);
  }, [blindMode, reciteMode]);
  useEffect(() => {
    if (ayahStart !== null) setCumUpTo(ayahStart);
  }, [ayahStart]);
  useEffect(() => { ayahStartRef.current = ayahStart; }, [ayahStart]);
  useEffect(() => { ayahEndRef.current = ayahEnd; }, [ayahEnd]);
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
  useEffect(() => { autoAdvanceDelayRef.current = autoAdvanceDelayMs; }, [autoAdvanceDelayMs]);
  useEffect(() => { autoplayThroughRangeRef.current = autoplayThroughRange; }, [autoplayThroughRange]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => { readyToReciteSheetOpenRef.current = readyToReciteSheetOpen; }, [readyToReciteSheetOpen]);
  useEffect(() => { completionSheetOpenRef.current = completionSheetOpen; }, [completionSheetOpen]);

  // Apply playback rate changes to the currently-playing sound
  useEffect(() => {
    if (soundRef.current && isPlayingRef.current) {
      soundRef.current.setRateAsync(playbackRate, true).catch(() => {
        // best-effort
      });
    }
  }, [playbackRate]);

  // Hydrate profile settings from AsyncStorage.
  useEffect(() => {
    let cancelled = false;
    setSettingsLoaded(false);
    (async () => {
      const p = await loadProfileSettings(childId);
      if (cancelled) return;
      setThemeKey(p.themeKey);
      setReciterId(p.reciterId);
      setViewMode(routeViewMode ?? p.viewMode);
      setSettingsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, routeViewMode]);

  // Hydrate parent-chosen session defaults. These only set the starting state;
  // changes made inside a memorization session remain temporary.
  const applyDefaultSessionSettings = useCallback(async () => {
    const defaults = await loadDefaultSessionSettings(childId);
    setRepeatCount(defaults.repeatCount);
    setAutoAdvanceDelayMs(defaults.autoAdvanceDelayMs);
    setAutoplayThroughRange(defaults.autoplayThroughRange);
    setBlindMode(defaults.blindMode);
    setBlurMode(defaults.blurMode);
    setCumulativeReview(defaults.cumulativeReview);
    setReviewRepeatCount(defaults.reviewRepeatCount);
    setConfettiEnabled(defaults.confetti);
  }, [childId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const defaults = await loadDefaultSessionSettings(childId);
      if (cancelled) return;
      setRepeatCount(defaults.repeatCount);
      setAutoAdvanceDelayMs(defaults.autoAdvanceDelayMs);
      setAutoplayThroughRange(defaults.autoplayThroughRange);
      setBlindMode(defaults.blindMode);
      setBlurMode(defaults.blurMode);
      setCumulativeReview(defaults.cumulativeReview);
      setReviewRepeatCount(defaults.reviewRepeatCount);
      setConfettiEnabled(defaults.confetti);
    })();
    return () => {
      cancelled = true;
    };
  }, [childId]);

  useEffect(() => {
    if (!confettiEnabled) setCelebration(null);
  }, [confettiEnabled]);

  // Configure iOS audio session so playback works through the speaker even
  // when the silent switch is on (AirPods always worked via Bluetooth).
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {
      // setAudioModeAsync can fail on simulator; non-fatal in production
    });
  }, []);

  // Persist profile settings on change, skip during initial hydration.
  useEffect(() => {
    if (!settingsLoaded) return;
    void saveProfileSettings(childId, { themeKey, reciterId, viewMode });
  }, [childId, settingsLoaded, themeKey, reciterId, viewMode]);

  // Stop audio when reciter changes so next Play tap recreates sound with new URL
  useEffect(() => {
    if (settingsLoaded) {
      void stopAudioCompletely();
    }
  }, [reciterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load chapter metadata once for surah name lookups
  useEffect(() => {
    fetchAllChapters()
      .then((chapters) => {
        const map = new Map<number, ApiChapter>();
        for (const ch of chapters) map.set(ch.id, ch);
        setChaptersMap(map);
      })
      .catch(() => {});
  }, []);

  const loadDiscovery = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (sessionRequested) return;
      if (mode === "refresh") {
        setDiscoveryRefreshing(true);
      } else {
        setDiscoveryState({ status: "loading" });
      }
      try {
        const [dashboard, progress, surahs] = await Promise.all([
          fetchDashboard(childId),
          fetchMemorizationProgress(childId),
          fetchSurahs(),
        ]);
        setDiscoveryState({ status: "ready", dashboard, progress, surahs });
      } catch (e) {
        setDiscoveryState({
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load memorization.",
        });
      } finally {
        setDiscoveryRefreshing(false);
      }
    },
    [childId, sessionRequested],
  );

  const loadSessionBookmark = useCallback(async () => {
    const bookmark = await loadMemorizationSessionBookmark(childId);
    setSessionBookmark(bookmark);
  }, [childId]);

  useFocusEffect(
    useCallback(() => {
      if (!sessionRequested) {
        void loadDiscovery();
        void loadSessionBookmark();
      }
    }, [loadDiscovery, loadSessionBookmark, sessionRequested]),
  );

  usePreventRemove(sessionRequested && !loading && !error && !submitting, () => {
    setSaveError(null);
    setLeaveSheetOpen(true);
  });

  useFocusEffect(
    useCallback(() => {
      suppressPlaybackForNavigationRef.current = false;
    }, []),
  );

  async function prepareSession(target: SessionTarget) {
    Keyboard.dismiss();
    await applyDefaultSessionSettings();
    setPendingSessionTarget(target);
  }

  function openParentDefaults() {
    if (!childId) return;
    router.push({
      pathname: "/child/[childId]/targets",
      params: { childId, name: params.name ?? "" },
    });
  }

  function startConfiguredSession(target: SessionTarget) {
    setPendingSessionTarget(null);
    beginSession(target);
  }

  function startBookmarkedSession(bookmark: MemorizationSessionBookmark) {
    setRepeatCount(bookmark.repeatCount);
    setAutoplayThroughRange(bookmark.autoAdvance);
    setCumulativeReview(bookmark.cumulativeReview);
    setReviewRepeatCount(bookmark.reviewRepeatCount);
    startConfiguredSession(buildBookmarkTarget(bookmark));
  }

  function beginSession(target: SessionTarget) {
    const nextStart = Math.max(1, target.ayahStart);
    const nextEnd = Math.max(nextStart, target.ayahEnd);
    const nextCurrent = clampNumber(target.currentAyah ?? nextStart, nextStart, nextEnd);
    setSessionRequested(true);
    setSessionLoadId((value) => value + 1);
    setLoading(true);
    setError(null);
    setDisplayWordsMap(new Map());
    setChapterTimings(null);
    setPageWordsMap(new Map());
    setVersePageMap(new Map());
    setDisplayedMushafPage(null);
    lineLayoutMap.current.clear();
    pageCardLayoutMap.current.clear();
    clearMushafAutoScrollRetry();
    setHighlightedWord(-1);
    setHighlightedPage(null);
    setInternalPhase("single");
    internalPhaseRef.current = "single";
    setSessionReviewOnly(Boolean(target.isReviewOnly));
    setStartInRecitationCheck(Boolean(target.isReviewOnly && target.startInRecitationCheck));
    setLeaveSheetOpen(false);
    setPauseSheetOpen(false);
    setPauseCompletedAyahEnd(null);
    setTappedAyah(null);
    updateReadyToReciteSheet(false);
    setCompletionSheetOpen(false);
    setSelectedQuality(null);
    setRatingAyahEnd(null);
    setRecitationCheckSource("teacher");
    setRecitationScore(null);
    setStartInReciteMode(false);
    setSaveError(null);
    setCelebration(null);
    setCumAyahIdx(0);
    cumAyahIdxRef.current = 0;
    setCumPass(1);
    cumPassRef.current = 1;
    setCumUpTo(nextStart);
    cumUpToRef.current = nextStart;
    setCurrentRepeat(1);
    setSurahNumber(target.surahNumber);
    setAyahStart(nextStart);
    setAyahEnd(nextEnd);
    setCurrentVerse(nextCurrent);
    currentVerseRef.current = nextCurrent;
    setPageStart(target.pageStart ?? null);
    setPageEnd(target.pageEnd ?? null);
  }

  useEffect(() => {
    if (!sessionRequested) return;
    if (error) return;
    if (surahNumber === null || ayahStart === null || ayahEnd === null) return;

    const currentAyah = clampNumber(currentVerse, ayahStart, ayahEnd);
    const bookmark: MemorizationSessionBookmark = {
      surahNumber,
      surahName: getBookmarkSurahName(surahNumber, chaptersMap),
      fromAyah: ayahStart,
      toAyah: ayahEnd,
      currentAyah,
      repeatCount,
      autoAdvance: autoplayThroughRange,
      cumulativeReview,
      reviewRepeatCount,
      isReviewOnly: sessionReviewOnly,
      pageStart,
      pageEnd,
      savedAt: Date.now(),
    };

    setSessionBookmark(bookmark);
    void saveMemorizationSessionBookmark(childId, bookmark);
  }, [
    childId,
    sessionRequested,
    error,
    surahNumber,
    ayahStart,
    ayahEnd,
    currentVerse,
    repeatCount,
    autoplayThroughRange,
    cumulativeReview,
    reviewRepeatCount,
    sessionReviewOnly,
    pageStart,
    pageEnd,
    chaptersMap,
  ]);

  useEffect(() => {
    if (!startInRecitationCheck) return;
    if (!sessionRequested || loading || error) return;
    if (!sessionReviewOnly || ayahStart === null || ayahEnd === null) {
      setStartInRecitationCheck(false);
      return;
    }

    setStartInRecitationCheck(false);
    openRecitationCheck({
      completedToAyah: ayahEnd,
      source: "teacher",
      score: null,
    });
  }, [
    startInRecitationCheck,
    sessionRequested,
    loading,
    error,
    sessionReviewOnly,
    ayahStart,
    ayahEnd,
  ]);

  useEffect(() => {
    if (!startInReciteMode) return;
    if (!sessionRequested || loading || error) return;
    if (ayahStart === null) {
      setStartInReciteMode(false);
      return;
    }

    setStartInReciteMode(false);
    void enterReciteMode(currentVerseRef.current || ayahStart);
  }, [
    startInReciteMode,
    sessionRequested,
    loading,
    error,
    ayahStart,
  ]);

  // Step 1: if no params, fetch dashboard to get today's memorization target
  useEffect(() => {
    if (!sessionRequested) return;
    if (surahNumber !== null && ayahStart !== null && ayahEnd !== null) {
      setCurrentVerse((value) => clampNumber(value, ayahStart, ayahEnd));
      return;
    }
    (async () => {
      try {
        const dash = await fetchDashboard(childId);
        const nm = dash.todaysPlan.newMemorization;
        if (!nm) {
          setError("No memorization assigned for today.");
          setLoading(false);
          return;
        }
        const sn = nm.currentWorkSurahNumber;
        const as = nm.currentWorkAyahStart;
        const ae = nm.currentWorkAyahEnd;
        setSurahNumber(sn);
        setAyahStart(as);
        setAyahEnd(ae);
        setSessionReviewOnly(Boolean(nm.isReviewOnly));
        setCurrentVerse(as);
        setPageStart(nm.pageStart);
        setPageEnd(nm.pageEnd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load today's plan.");
        setLoading(false);
      }
    })();
  }, [sessionRequested]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: once surahNumber + chapters are known, fetch verses + timings in parallel.
  // Gated on chaptersMap.size > 0 so chapter metadata (name_arabic etc.) is available.
  useEffect(() => {
    if (!sessionRequested) return;
    if (surahNumber === null) return;
    if (chaptersMap.size === 0) return;
    const currentReciter = findReciter(reciterId);
    let cancelled = false;
    (async () => {
      try {
        const [verses, timings] = await Promise.all([
          fetchSurahVerses(surahNumber),
          fetchTimingsForReciter(currentReciter, surahNumber),
        ]);
        if (cancelled) return;
        const map = new Map<number, ApiWord[]>();
        const nextVersePageMap = new Map<number, number>();
        for (const verse of verses) {
          if (typeof verse.page_number === "number") {
            nextVersePageMap.set(verse.verse_number, verse.page_number);
          }
          map.set(
            verse.verse_number,
            verse.words.filter((w) => w.char_type_name === "word"),
          );
        }
        if (ayahStart !== null && ayahEnd !== null) {
          const pages = Array.from(nextVersePageMap.entries())
            .filter(([verseNumber]) => verseNumber >= ayahStart && verseNumber <= ayahEnd)
            .map(([, pageNumber]) => pageNumber);
          if (pages.length > 0) {
            setPageStart(Math.min(...pages));
            setPageEnd(Math.max(...pages));
          }
        }
        setDisplayWordsMap(map);
        setVersePageMap(nextVersePageMap);
        setChapterTimings(timings);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load verses.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionRequested, sessionLoadId, surahNumber, reciterId, chaptersMap, ayahStart, ayahEnd]);

  // Fetch Mushaf page data when switching to Full Mushaf mode
  useEffect(() => {
    if (viewMode !== "page" || pageStart === null || pageEnd === null) return;
    const pagesToFetch: number[] = [];
    for (let p = pageStart; p <= pageEnd; p++) {
      if (!pageWordsMap.has(p)) pagesToFetch.push(p);
    }
    if (pagesToFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(pagesToFetch.map((p) => fetchVersesByPage(p)));
        if (cancelled) return;
        setPageWordsMap((prev) => {
          const next = new Map(prev);
          pagesToFetch.forEach((p, i) => next.set(p, results[i]!));
          return next;
        });
      } catch {
        // fail silently; page card shows loading indicator
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, pageStart, pageEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep segsRef up-to-date for the RAF tick
  useEffect(() => {
    if (surahNumber === null || chapterTimings === null) return;
    if (chapterTimings.kind === "chapter") {
      segsRef.current = chapterTimings.map.get(`${surahNumber}:${playingVerseNumber}`) ?? [];
      return;
    }
    // On-demand: fetch this verse's timings (cached + dedup'd inside fetchQuranComV4VerseTiming)
    let cancelled = false;
    segsRef.current = [];
    chapterTimings.fetch(playingVerseNumber).then((segs) => {
      if (!cancelled && playingVerseNumberRef.current === playingVerseNumber) {
        segsRef.current = segs;
      }
    });
    return () => { cancelled = true; };
  }, [chapterTimings, surahNumber, playingVerseNumber]);

  function clearMushafAutoScrollRetry() {
    if (autoScrollRetryRef.current) {
      clearTimeout(autoScrollRetryRef.current);
      autoScrollRetryRef.current = null;
    }
  }

  function resolveMushafScrollTarget(verseNumber: number) {
    if (pageStart === null || pageEnd === null || surahNumber === null) return null;

    for (let pageNum = pageStart; pageNum <= pageEnd; pageNum += 1) {
      const verses = pageWordsMap.get(pageNum);
      if (!verses) continue;

      for (const verse of verses) {
        const ci = verse.verse_key.indexOf(":");
        const vSurah = Number(verse.verse_key.slice(0, ci));
        const vVerse = Number(verse.verse_key.slice(ci + 1));
        if (vSurah !== surahNumber || vVerse !== verseNumber) continue;

        const firstWord =
          verse.words.find((word) => word.char_type_name === "word") ?? verse.words[0];
        return {
          pageNum,
          lineNumber: firstWord?.line_number,
        };
      }
    }

    const mappedPage = versePageMap.get(verseNumber);
    if (
      mappedPage !== undefined &&
      mappedPage >= pageStart &&
      mappedPage <= pageEnd
    ) {
      return { pageNum: clampMushafPage(mappedPage), lineNumber: undefined };
    }

    return null;
  }

  function scrollMushafVerseIntoView(verseNumber: number, attempt = 0) {
    if (viewMode !== "page" || pageStart === null || pageEnd === null || surahNumber === null) return;

    const target = resolveMushafScrollTarget(verseNumber);
    if (target !== null) {
      setDisplayedMushafPage(target.pageNum);
    }
    const pageCardY =
      target !== null ? pageCardLayoutMap.current.get(target.pageNum) : undefined;
    const lineY =
      target?.lineNumber !== undefined
        ? lineLayoutMap.current.get(`page:${target.pageNum}:line:${target.lineNumber}`)
        : undefined;

    if (target !== null && pageCardY !== undefined) {
      // pageCardY is the page card's Y in scroll content; lineY is within pageBody.
      const targetY = lineY !== undefined ? pageCardY + 40 + lineY : pageCardY;
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 80), animated: true });
      return;
    }

    if (attempt < 5) {
      clearMushafAutoScrollRetry();
      autoScrollRetryRef.current = setTimeout(() => {
        autoScrollRetryRef.current = null;
        scrollMushafVerseIntoView(verseNumber, attempt + 1);
      }, 90);
    }
  }

  function scrollMushafPageIntoView(pageNum: number, attempt = 0) {
    if (viewMode !== "page" || pageStart === null || pageEnd === null) return;
    const targetPage = clampMushafPage(pageNum);
    const pageCardY = pageCardLayoutMap.current.get(targetPage);

    setDisplayedMushafPage(targetPage);

    if (pageCardY !== undefined) {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, pageCardY - 12), animated: true });
      return;
    }

    if (attempt < 5) {
      clearMushafAutoScrollRetry();
      autoScrollRetryRef.current = setTimeout(() => {
        autoScrollRetryRef.current = null;
        scrollMushafPageIntoView(targetPage, attempt + 1);
      }, 90);
    }
  }

  // Keep the active ayah visible in page mode. In recite mode this acts as the
  // page auto-flip when speech recognition advances across a mushaf boundary.
  useEffect(() => {
    clearMushafAutoScrollRetry();
    scrollMushafVerseIntoView(playingVerseNumber);
    return clearMushafAutoScrollRetry;
  }, [playingVerseNumber, viewMode, pageStart, pageEnd, pageWordsMap, versePageMap, surahNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearMushafAutoScrollRetry();
      void stopAudioCompletely();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup + optional auto-play on verse change
  useEffect(() => {
    setCurrentRepeat(1);
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    cancelAnimationFrame(rafIdRef.current);

    // In recite mode, the highlight tracks the next word to say. On verse change,
    // reset to word 0. Otherwise (audio playback), clear highlight entirely.
    const resetReciteIdx = reciteModeRef.current
      ? (getNextReciteWordIndex(
          displayWordsMapRef.current.get(currentVerseRef.current) ?? [],
          0,
        ) ?? 0)
      : 0;
    if (reciteModeRef.current) {
      setHighlightedWord(resetReciteIdx);
      if (surahNumberRef.current !== null) {
        const resetWord =
          displayWordsMapRef.current.get(currentVerseRef.current)?.[resetReciteIdx];
        setHighlightedPage({
          verseKey: `${surahNumberRef.current}:${currentVerseRef.current}`,
          position: resetWord?.position ?? resetReciteIdx + 1,
        });
      }
    } else {
      setHighlightedWord(-1);
      setHighlightedPage(null);
    }

    reciteExpectedIdxRef.current = resetReciteIdx;
    setReciteExpectedIdx(resetReciteIdx);
    matchedWordCountRef.current = 0;
    lastMatchedWordRef.current = "";
    positionRef.current = 0;
    durationRef.current = 0;

    let cancelled = false;
    const doChange = async () => {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (cancelled) return;
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        await playVerse(playingVerseNumberRef.current);
        // Seek to tapped word position after new verse starts
        if (pendingSeekPositionRef.current !== null) {
          const pos = pendingSeekPositionRef.current;
          pendingSeekPositionRef.current = null;
          await seekToWordPosition(pos);
        }
      }
    };
    doChange();
    return () => { cancelled = true; };
  }, [playingVerseNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAF highlight loop ───────────────────────────────────────────────────────

  function startRAF() {
    const sn = surahNumber; // captured at call time; stable during playback
    function tick() {
      const dur = durationRef.current;
      const pos = positionRef.current;
      if (dur > 0) {
        const frac = pos / dur;
        const segs = segsRef.current;
        let found = -1;

        if (segs.length > 0) {
          // True word-level timing (Husary via QDC, or any reciter with v4 segments)
          for (const [wordIdx, start, end] of segs) {
            if (frac >= start && frac < end) {
              found = wordIdx - 1; // 0-based display index
              break;
            }
          }
          if (found === -1 && frac > 0) {
            const last = segs[segs.length - 1];
            if (last && frac >= last[1]) found = last[0] - 1;
          }
        } else {
          // Fallback: no segment data. Spread highlight evenly across verse duration,
          // but shift forward by LEAD_MS so the highlight anticipates the audio rather
          // than chasing it. Husary's QDC segments produce a similar anticipatory feel
          // because segment 1 starts at frac=0 and extends through the leading silence.
          // Without this shift, the highlight runs ~300ms behind audio because everyayah
          // files have leading silence before recitation begins.
          const LEAD_MS = 500;
          const wordCount = displayWordsMapRef.current.get(playingVerseNumberRef.current)?.length ?? 0;
          if (wordCount > 0) {
            const shiftedPos = pos + LEAD_MS;
            const shiftedFrac = Math.min(shiftedPos / dur, 1);
            found = Math.min(Math.floor(shiftedFrac * wordCount), wordCount - 1);
          }
        }

        setHighlightedWord(found);
        // Page-mode highlight: 1-based position matches ApiWord.position
        if (sn !== null) {
          if (found === -1) {
            setHighlightedPage(null);
          } else {
            setHighlightedPage({
              verseKey: `${sn}:${playingVerseNumberRef.current}`,
              position: found + 1,
            });
          }
        }
      }
      rafIdRef.current = requestAnimationFrame(tick);
    }
    rafIdRef.current = requestAnimationFrame(tick);
  }

  // ── Audio helpers ────────────────────────────────────────────────────────────

  async function stopAudioCompletely() {
    cancelAnimationFrame(rafIdRef.current);
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // ignore — already unloaded or in bad state
      }
      soundRef.current = null;
    }
    if (wordAudioSoundRef.current) {
      try {
        await wordAudioSoundRef.current.unloadAsync();
      } catch {
        // ignore — word audio is best-effort
      }
      wordAudioSoundRef.current = null;
    }
    setWordAudioLoadingKey(null);
    isPlayingRef.current = false;
    setIsPlaying(false);
    setHighlightedWord(-1);
    setHighlightedPage(null);
    positionRef.current = 0;
    durationRef.current = 0;
    isLoadingRef.current = false;
  }

  function handleSessionComplete() {
    isPlayingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(rafIdRef.current);
    setHighlightedWord(-1);
    setHighlightedPage(null);
    autoPlayRef.current = false;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    void stopAudioCompletely();
    if (!completionSheetOpenRef.current && !readyToReciteSheetOpenRef.current) {
      setPauseSheetOpen(false);
      setLeaveSheetOpen(false);
      setSelectedQuality(null);
      setRatingAyahEnd(null);
      setRecitationCheckSource("teacher");
      setRecitationScore(null);
      setSaveError(null);
      updateReadyToReciteSheet(true);
    }
  }

  function updateReadyToReciteSheet(open: boolean) {
    readyToReciteSheetOpenRef.current = open;
    setReadyToReciteSheetOpen(open);
  }

  function setCurrentRepeat(nextRepeat: number) {
    currentRepeatRef.current = nextRepeat;
    setCurrentRepeatDisplay(nextRepeat);
  }

  function handleAllRepeatsDone() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    const fromA = ayahStartRef.current;
    const toA = ayahEndRef.current;
    if (fromA === null || toA === null) return;

    const delay = autoAdvanceDelayRef.current;
    const scheduleNext = (fn: () => void) => {
      if (delay > 0) {
        advanceTimeoutRef.current = setTimeout(() => {
          advanceTimeoutRef.current = null;
          fn();
        }, delay);
      } else {
        fn();
      }
    };

    if (internalPhaseRef.current === "single") {
      const cur = currentVerseRef.current;
      if (cumulativeReviewRef.current && cur > fromA) {
        setCurrentRepeat(1);
        autoPlayRef.current = true;
        setCumUpTo(cur);
        cumUpToRef.current = cur;
        setCumAyahIdx(0);
        cumAyahIdxRef.current = 0;
        setCumPass(1);
        cumPassRef.current = 1;
        setInternalPhase("cumulative");
        internalPhaseRef.current = "cumulative";
        return;
      }

      if (cur < toA) {
        const shouldAutoAdvance = cumulativeReviewRef.current || autoplayThroughRangeRef.current;
        setCurrentRepeat(1);
        if (shouldAutoAdvance) {
          scheduleNext(() => {
            autoPlayRef.current = true;
            setCurrentVerse((v) => v + 1);
          });
        }
        return;
      }

      handleSessionComplete();
      return;
    }

    const rangeLen = cumUpToRef.current - fromA + 1;
    const nextIdx = cumAyahIdxRef.current + 1;
    if (nextIdx < rangeLen) {
      setCurrentRepeat(1);
      autoPlayRef.current = true;
      setCumAyahIdx(nextIdx);
      cumAyahIdxRef.current = nextIdx;
      return;
    }

    const nextPass = cumPassRef.current + 1;
    if (nextPass <= reviewRepeatCountRef.current) {
      setCurrentRepeat(1);
      autoPlayRef.current = true;
      setCumAyahIdx(0);
      cumAyahIdxRef.current = 0;
      setCumPass(nextPass);
      cumPassRef.current = nextPass;
      return;
    }

    setInternalPhase("single");
    internalPhaseRef.current = "single";
    if (currentVerseRef.current < toA) {
      setCurrentRepeat(1);
      scheduleNext(() => {
        autoPlayRef.current = true;
        setCurrentVerse((v) => v + 1);
      });
    } else {
      handleSessionComplete();
    }
  }

  async function playVerse(verseNum: number) {
    if (reciteModeRef.current) return;
    if (!surahNumber) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const url = ayahAudioUrl(reciter, surahNumber, verseNum);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          positionRef.current = status.positionMillis;
          if (status.durationMillis) durationRef.current = status.durationMillis;
          if (status.didJustFinish) {
            // During cumulative phase each verse plays once (no per-verse repeats).
            const effectiveRepeatCount =
              internalPhaseRef.current === "cumulative" ? 1 : repeatCountRef.current;
            if (currentRepeatRef.current < effectiveRepeatCount) {
              setCurrentRepeat(currentRepeatRef.current + 1);
              soundRef.current
                ?.setPositionAsync(0)
                .then(() => soundRef.current?.playAsync())
                .catch(() => {});
              return;
            }
            // All repeats done for this verse
            setCurrentRepeat(1);
            cancelAnimationFrame(rafIdRef.current);
            isPlayingRef.current = false;
            setIsPlaying(false);
            setHighlightedWord(-1);
            setHighlightedPage(null);

            // Unload the just-finished sound so the next playVerse creates a fresh instance.
            void (async () => {
              if (soundRef.current) {
                try {
                  await soundRef.current.unloadAsync();
                } catch {
                  // already gone
                }
                soundRef.current = null;
              }
              handleAllRepeatsDone();
            })();
          }
        },
      );
      soundRef.current = sound;
      if (suppressPlaybackForNavigationRef.current) {
        try {
          await sound.unloadAsync();
        } catch {
          // ignore — this is only guarding a late audio load during navigation
        }
        soundRef.current = null;
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }
      // Ensure max volume — different everyayah recordings have very different
      // mastered loudness levels (Afasy is significantly quieter than Husary).
      try {
        await sound.setVolumeAsync(1.0);
      } catch {
        // best-effort; sound may already be playing
      }
      try {
        await sound.setRateAsync(playbackRateRef.current, true);
        // shouldCorrectPitch=true keeps recitation pitch natural
      } catch {
        // best-effort; some sound states may reject setRateAsync
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
      startRAF();
    } finally {
      isLoadingRef.current = false;
    }
  }

  async function seekToWordPosition(position: number) {
    const seg = segsRef.current.find((s) => s[0] === position);
    if (!seg) return;
    const dur = durationRef.current;
    if (soundRef.current && dur > 0) {
      await soundRef.current.setPositionAsync(Math.floor(seg[1] * dur));
      if (!isPlayingRef.current) {
        await soundRef.current.playAsync();
        isPlayingRef.current = true;
        setIsPlaying(true);
        startRAF();
      }
    }
  }

  async function handlePlayPause() {
    if (reciteMode) {
      Alert.alert("Recite mode is on", "Turn off Recite mode to play audio.");
      return;
    }
    // Block re-entry while audio is loading. Without this, rapid taps during
    // the createAsync window all fall through to playVerse or to the resume
    // branch and spawn concurrent playback.
    if (isLoadingRef.current) return;

    if (isPlayingRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      await soundRef.current?.pauseAsync();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else if (soundRef.current) {
      // Resume an existing-but-paused sound. Check ref first to avoid race.
      if (isPlayingRef.current) return; // double-check after await boundary
      isPlayingRef.current = true;
      setIsPlaying(true);
      await soundRef.current.playAsync();
      startRAF();
    } else {
      setCurrentRepeat(1);
      await playVerse(playingVerseNumberRef.current);
    }
  }

  async function handleWordTap(displayIdx: number) {
    const seg = segsRef.current.find((s) => s[0] - 1 === displayIdx);
    if (!seg) return;
    const dur = durationRef.current;
    if (soundRef.current && dur > 0) {
      await soundRef.current.setPositionAsync(Math.floor(seg[1] * dur));
      if (!isPlayingRef.current) {
        await soundRef.current.playAsync();
        isPlayingRef.current = true;
        setIsPlaying(true);
        startRAF();
      }
    }
  }

  async function handlePageWordTap(verseKey: string, position: number) {
    const ci = verseKey.indexOf(":");
    const vSurah = Number(verseKey.slice(0, ci));
    const vVerse = Number(verseKey.slice(ci + 1));
    if (vSurah !== surahNumber) return;

    if (vVerse !== currentVerse) {
      // Switch to the tapped verse, then seek to the tapped word after load
      pendingSeekPositionRef.current = position;
      autoPlayRef.current = true;
      setCurrentVerse(vVerse);
      return;
    }

    await seekToWordPosition(position);
  }

  async function replayPlaybackVerseFromStart(verseNum: number) {
    if (isLoadingRef.current) return;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    cancelAnimationFrame(rafIdRef.current);
    setHighlightedWord(-1);
    setHighlightedPage(null);
    positionRef.current = 0;

    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
        isPlayingRef.current = true;
        setIsPlaying(true);
        startRAF();
        return;
      } catch {
        try {
          await soundRef.current.unloadAsync();
        } catch {
          // ignore broken sound instance; playVerse will create a fresh one
        }
        soundRef.current = null;
      }
    }

    await playVerse(verseNum);
  }

  function advanceAfterCumulativeSkip() {
    setInternalPhase("single");
    internalPhaseRef.current = "single";
    if (
      ayahEndRef.current !== null &&
      currentVerseRef.current < ayahEndRef.current
    ) {
      autoPlayRef.current = true;
      setCurrentVerse((v) => v + 1);
    } else {
      handleSessionComplete();
    }
  }

  async function handleSkipRepeat() {
    if (reciteModeRef.current || submitting || isLoadingRef.current) return;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    if (internalPhaseRef.current === "cumulative") {
      const fromA = ayahStartRef.current;
      if (fromA === null) return;
      const nextPass = cumPassRef.current + 1;
      await stopAudioCompletely();
      setCurrentRepeat(1);

      if (nextPass <= reviewRepeatCountRef.current) {
        const wasAtFirstCumulativeAyah = cumAyahIdxRef.current === 0;
        setCumAyahIdx(0);
        cumAyahIdxRef.current = 0;
        setCumPass(nextPass);
        cumPassRef.current = nextPass;

        if (wasAtFirstCumulativeAyah) {
          autoPlayRef.current = false;
          await playVerse(fromA);
        } else {
          autoPlayRef.current = true;
        }
        return;
      }

      advanceAfterCumulativeSkip();
      return;
    }

    const totalRepeats = repeatCountRef.current;
    if (totalRepeats <= 1) return;

    if (currentRepeatRef.current < totalRepeats) {
      setCurrentRepeat(currentRepeatRef.current + 1);
      await replayPlaybackVerseFromStart(playingVerseNumberRef.current);
      return;
    }

    await stopAudioCompletely();
    setCurrentRepeat(1);
    handleAllRepeatsDone();
  }

  async function handleSkipAyah() {
    if (reciteModeRef.current || submitting || isLoadingRef.current) return;
    if (ayahEndRef.current === null) return;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    await stopAudioCompletely();
    setCurrentRepeat(1);

    if (internalPhaseRef.current === "cumulative") {
      advanceAfterCumulativeSkip();
      return;
    }

    if (currentVerseRef.current < ayahEndRef.current) {
      autoPlayRef.current = true;
      setCurrentVerse((v) => v + 1);
      return;
    }

    handleSessionComplete();
  }

  function handlePrev() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (internalPhaseRef.current === "cumulative") {
      setInternalPhase("single");
      internalPhaseRef.current = "single";
      void stopAudioCompletely();
      return;
    }
    if (ayahStart === null || currentVerse <= ayahStart) return;
    autoPlayRef.current = true;
    setCurrentVerse((v) => v - 1);
  }

  function handleNext() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    if (internalPhaseRef.current === "cumulative") {
      void stopAudioCompletely();
      setInternalPhase("single");
      internalPhaseRef.current = "single";
      if (
        ayahEndRef.current !== null &&
        currentVerseRef.current < ayahEndRef.current
      ) {
        autoPlayRef.current = true;
        setCurrentVerse((v) => v + 1);
      } else {
        handleSessionComplete();
      }
      return;
    }

    if (
      cumulativeReviewRef.current &&
      ayahStartRef.current !== null &&
      currentVerseRef.current > ayahStartRef.current
    ) {
      const cur = currentVerseRef.current;
      setCurrentRepeat(1);
      autoPlayRef.current = true;
      setCumUpTo(cur);
      cumUpToRef.current = cur;
      setCumAyahIdx(0);
      cumAyahIdxRef.current = 0;
      setCumPass(1);
      cumPassRef.current = 1;
      setInternalPhase("cumulative");
      internalPhaseRef.current = "cumulative";
      void stopAudioCompletely();
      return;
    }

    if (ayahEnd === null || currentVerse >= ayahEnd) {
      handleSessionComplete();
      return;
    }
    autoPlayRef.current = true;
    setCurrentVerse((v) => v + 1);
  }

  async function refreshDiscoverySnapshot() {
    const [dashboard, progress, surahs] = await Promise.all([
      fetchDashboard(childId),
      fetchMemorizationProgress(childId),
      fetchSurahs(),
    ]);
    setDiscoveryState({ status: "ready", dashboard, progress, surahs });
  }

  async function submitTodayMemorizationProgress(
    dashboard: DashboardResponse,
    progressBeforeSave: MemorizationProgress[],
    savedStatus: "memorized" | "in_progress",
    completedThroughAyah: number,
  ) {
    if (!surahNumber || ayahStart === null || ayahEnd === null) return;

    const todayWork = dashboard.todaysPlan.newMemorization;
    if (!todayWork) return;

    const todayProgress = dashboard.todayProgress;
    const targetSurah = todayProgress?.memTargetSurah ?? todayWork.surahNumber;
    const targetAyahStart = todayProgress?.memTargetAyahStart ?? todayWork.ayahStart;
    const targetAyahEnd = todayProgress?.memTargetAyahEnd ?? todayWork.ayahEnd;
    const targetEndSurah = todayWork.endSurahNumber ?? targetSurah;
    const currentWorkSurah = todayWork.currentWorkSurahNumber ?? todayWork.surahNumber;
    const currentWorkAyahStart = todayWork.currentWorkAyahStart ?? todayWork.ayahStart;
    const currentWorkAyahEnd = todayWork.currentWorkAyahEnd ?? todayWork.ayahEnd;

    if (targetAyahStart == null || targetAyahEnd == null) return;
    const savedAyahEnd = Math.max(ayahStart, Math.min(completedThroughAyah, ayahEnd));
    const overlapsTodayTarget =
      surahNumber === targetSurah && ayahStart <= targetAyahEnd && savedAyahEnd >= targetAyahStart;
    const overlapsCurrentWork =
      surahNumber === currentWorkSurah &&
      ayahStart <= currentWorkAyahEnd &&
      savedAyahEnd >= currentWorkAyahStart;
    if (!overlapsTodayTarget && !overlapsCurrentWork) return;

    const completedAyahEnd = Math.max(todayProgress?.memCompletedAyahEnd ?? 0, savedAyahEnd);
    const isMultiSurahTarget = targetEndSurah !== targetSurah;
    const completesMultiSurahTarget = (() => {
      if (!isMultiSurahTarget) return false;

      const start = Math.min(targetSurah, targetEndSurah);
      const end = Math.max(targetSurah, targetEndSurah);
      for (let n = start; n <= end; n += 1) {
        if (n === surahNumber) {
          if (savedStatus !== "memorized") return false;
          continue;
        }

        const progress = progressBeforeSave.find((item) => item.surahNumber === n);
        if (progress?.status !== "memorized") return false;
      }

      return true;
    })();
    const completesTodayTarget =
      todayWork.isReviewOnly ||
      (isMultiSurahTarget
        ? completesMultiSurahTarget
        : targetEndSurah === surahNumber && savedAyahEnd >= targetAyahEnd);

    await submitDailyProgress(childId, {
      memStatus: completesTodayTarget ? "completed" : "in_progress",
      memCompletedAyahEnd: completedAyahEnd,
      memTargetSurah: targetSurah,
      memTargetAyahStart: targetAyahStart,
      memTargetAyahEnd: targetAyahEnd,
      memTargetEndSurah: targetEndSurah,
    });
  }

  function clampCompletedAyahEnd(value: number) {
    if (ayahStart === null || ayahEnd === null) return value;
    return Math.max(ayahStart, Math.min(value, ayahEnd));
  }

  function openRecitationCheck({
    completedToAyah,
    source,
    score = null,
  }: {
    completedToAyah: number;
    source: RecitationCheckSource;
    score?: number | null;
  }) {
    if (ayahStart === null || ayahEnd === null) return;
    const completedEnd = sessionReviewOnly
      ? ayahEnd
      : clampCompletedAyahEnd(completedToAyah);

    setPauseCompletedAyahEnd(completedEnd);
    setRatingAyahEnd(completedEnd);
    setSelectedQuality(null);
    setSaveError(null);
    setRecitationCheckSource(source);
    setRecitationScore(score);
    setCelebration(null);
    setPauseSheetOpen(false);
    setLeaveSheetOpen(false);
    updateReadyToReciteSheet(false);
    completionSheetOpenRef.current = true;
    setCompletionSheetOpen(true);

    if (source === "noorpath" || reciteModeRef.current) {
      reciteModeRef.current = false;
      setReciteMode(false);
      setReciteListening(false);
      setReciteError(null);
      setReciteExpectedIdx(0);
      resetReciteAssistState();
      matchedWordCountRef.current = 0;
      lastMatchedWordRef.current = "";
      ExpoSpeechRecognitionModule.stop();
    }
  }

  async function handlePauseAndSave() {
    if (!surahNumber || ayahStart === null || ayahEnd === null) return;
    setInternalPhase("single");
    internalPhaseRef.current = "single";
    updateReadyToReciteSheet(false);
    void stopAudioCompletely();
    setSaveError(null);
    setSelectedQuality(null);
    setRatingAyahEnd(null);
    const defaultCompletedEnd = sessionReviewOnly ? ayahEnd : clampCompletedAyahEnd(currentVerseRef.current);
    setPauseCompletedAyahEnd(defaultCompletedEnd);
    setPauseSheetOpen(true);
  }

  function handleRequestSessionLeave() {
    if (!sessionRequested || loading || error) {
      router.back();
      return;
    }
    if (submitting) return;
    setSaveError(null);
    restoreReadyPromptAfterLeaveRef.current = readyToReciteSheetOpenRef.current;
    updateReadyToReciteSheet(false);
    setLeaveSheetOpen(true);
  }

  function closeLeaveSheet(restoreReadyPrompt: boolean) {
    setLeaveSheetOpen(false);
    if (restoreReadyPrompt && restoreReadyPromptAfterLeaveRef.current) {
      restoreReadyPromptAfterLeaveRef.current = false;
      updateReadyToReciteSheet(true);
      return;
    }
    restoreReadyPromptAfterLeaveRef.current = false;
  }

  function handleSaveAndLeave() {
    if (submitting) return;
    closeLeaveSheet(false);
    void handlePauseAndSave();
  }

  async function pausePlaybackForMushafNavigation() {
    suppressPlaybackForNavigationRef.current = true;
    autoPlayRef.current = false;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    cancelAnimationFrame(rafIdRef.current);
    if (soundRef.current && isPlayingRef.current) {
      try {
        await soundRef.current.pauseAsync();
      } catch {
        // best-effort pause before opening the reader
      }
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
  }

  async function handleViewInFullMushaf(target?: AyahSheetTarget) {
    const targetSurah = target?.surahNumber ?? surahNumber;
    if (targetSurah === null) return;
    const targetAyah = target?.ayahNumber ?? playingVerseNumberRef.current;
    const targetPage =
      target?.pageNumber ??
      versePageMap.get(targetAyah) ??
      activeMushafPage ??
      1;
    await pausePlaybackForMushafNavigation();
    setSettingsOpen(false);
    setTranslationPopup(null);
    setTappedAyah(null);
    router.push({
      pathname: "/child/[childId]/mushaf",
      params: {
        childId,
        name: params.name ?? "",
        page: String(targetPage),
        fromMemorization: "1",
        surahNumber: String(targetSurah),
        ayahNumber: String(targetAyah),
      },
    });
  }

  function openAyahSheet(target: AyahSheetTarget) {
    if (reciteModeRef.current) return;
    if (blindMode && !revealedVerses.has(target.verseKey)) return;
    setSettingsOpen(false);
    setTranslationPopup(null);
    setTappedAyah(target);
  }

  async function handlePracticeFromAyah(target: AyahSheetTarget) {
    const fromA = ayahStartRef.current;
    const toA = ayahEndRef.current;
    if (fromA === null || toA === null) return;
    const nextVerse = clampNumber(target.ayahNumber, fromA, toA);
    setTappedAyah(null);
    setTranslationPopup(null);
    await stopAudioCompletely();
    setInternalPhase("single");
    internalPhaseRef.current = "single";
    setCumAyahIdx(0);
    cumAyahIdxRef.current = 0;
    setCumPass(1);
    cumPassRef.current = 1;
    setCumUpTo(nextVerse);
    cumUpToRef.current = nextVerse;
    setCurrentRepeat(1);
    autoPlayRef.current = false;
    pendingSeekPositionRef.current = null;
    setCurrentVerse(nextVerse);
    currentVerseRef.current = nextVerse;
  }

  async function handleLeaveWithoutSaving() {
    if (submitting) return;
    closeLeaveSheet(false);
    setSessionBookmark(null);
    await clearMemorizationSessionBookmark(childId);
    setPauseSheetOpen(false);
    setPauseCompletedAyahEnd(null);
    updateReadyToReciteSheet(false);
    setCompletionSheetOpen(false);
    setSelectedQuality(null);
    setRatingAyahEnd(null);
    setRecitationCheckSource("teacher");
    setRecitationScore(null);
    setSaveError(null);
    setCelebration(null);
    setStartInRecitationCheck(false);
    setStartInReciteMode(false);
    setSettingsOpen(false);
    setTranslationPopup(null);
    setTappedAyah(null);
    setInternalPhase("single");
    internalPhaseRef.current = "single";
    setCumAyahIdx(0);
    cumAyahIdxRef.current = 0;
    setCumPass(1);
    cumPassRef.current = 1;
    setCumUpTo(0);
    cumUpToRef.current = 0;
    setCurrentRepeat(1);
    autoPlayRef.current = false;
    pendingSeekPositionRef.current = null;
    matchedWordCountRef.current = 0;
    lastMatchedWordRef.current = "";
    reciteModeRef.current = false;
    setReciteMode(false);
    setReciteListening(false);
    setReciteError(null);
    setReciteExpectedIdx(0);
    resetReciteAssistState();
    ExpoSpeechRecognitionModule.stop();
    await stopAudioCompletely();
    setSessionReviewOnly(false);
    setSurahNumber(null);
    setAyahStart(null);
    setAyahEnd(null);
    setCurrentVerse(1);
    setPageStart(null);
    setPageEnd(null);
    setDisplayWordsMap(new Map());
    setChapterTimings(null);
    setPageWordsMap(new Map());
    setVersePageMap(new Map());
    setDisplayedMushafPage(null);
    lineLayoutMap.current.clear();
    pageCardLayoutMap.current.clear();
    clearMushafAutoScrollRetry();
    setRevealedVerses(new Set());
    setError(null);
    setLoading(false);
    setSessionRequested(false);
  }

  function openRecitationCheckFromPause() {
    if (ayahStart === null || ayahEnd === null) return;
    const completedEnd = sessionReviewOnly
      ? ayahEnd
      : clampCompletedAyahEnd(pauseCompletedAyahEnd ?? currentVerseRef.current);
    openRecitationCheck({
      completedToAyah: completedEnd,
      source: "teacher",
      score: null,
    });
  }

  function handleReciteToTeacher() {
    if (ayahStart === null || ayahEnd === null) return;
    openRecitationCheck({
      completedToAyah: ayahEnd,
      source: "teacher",
      score: null,
    });
  }

  async function enterReciteMode(startVerse: number) {
    if (ayahStart === null || ayahEnd === null || surahNumberRef.current === null) return;
    const boundedStart = Math.max(ayahStart, Math.min(startVerse, ayahEnd));
    const initialWords = displayWordsMapRef.current.get(boundedStart) ?? [];
    const initialExpectedIdx = getNextReciteWordIndex(initialWords, 0) ?? 0;

    setTappedAyah(null);
    await stopAudioCompletely();
    setInternalPhase("single");
    internalPhaseRef.current = "single";
    autoPlayRef.current = false;
    pendingSeekPositionRef.current = null;
    setCurrentRepeat(1);
    setCurrentVerse(boundedStart);
    currentVerseRef.current = boundedStart;
    matchedWordCountRef.current = 0;
    lastMatchedWordRef.current = "";
    resetReciteAssistState();
    setReciteError(null);
    setReciteListening(false);
    setReciteCursor(boundedStart, initialExpectedIdx);
    setReciteMode(true);
  }

  async function handleReciteToNoorPath() {
    if (ayahStart === null) return;
    updateReadyToReciteSheet(false);
    setSaveError(null);
    setSelectedQuality(null);
    setRatingAyahEnd(null);
    setRecitationCheckSource("noorpath");
    setRecitationScore(null);
    await enterReciteMode(ayahStart);
  }

  function buildCompletionCelebration({
    completedThroughAyah,
    totalVerses,
    status,
    hadFullSurahBeforeSave,
  }: {
    completedThroughAyah: number;
    totalVerses: number;
    status: "memorized" | "in_progress";
    hadFullSurahBeforeSave: boolean;
  }): CompletionCelebration | null {
    if (ayahStart === null || ayahEnd === null || surahNumber === null) return null;

    const surahName =
      chaptersMap.get(surahNumber)?.name_simple ??
      MUSHAF_SURAHS.find((surah) => surah.number === surahNumber)?.name ??
      `Surah ${surahNumber}`;
    const savedRange = formatAyahRange(ayahStart, completedThroughAyah);

    if (sessionReviewOnly) {
      const wholeSurahReview = ayahStart === 1 && completedThroughAyah >= totalVerses;
      return {
        message: wholeSurahReview ? "Whole Surah Complete!" : "Cumulative Recitation Complete!",
        subMessage: wholeSurahReview
          ? `${surahName} is ready to move into the separate review cycle.`
          : `${surahName} ${savedRange} has been checked and saved.`,
      };
    }

    const completedFullSurah =
      status === "memorized" && completedThroughAyah >= totalVerses && !hadFullSurahBeforeSave;
    if (completedFullSurah) {
      return {
        message: "Surah Complete!",
        subMessage: `${surahName} is fully memorized. Beautiful work.`,
      };
    }

    if (completedThroughAyah >= ayahEnd) {
      return {
        message: "Session Complete!",
        subMessage: `${surahName} ${savedRange} has been saved for review.`,
      };
    }

    return null;
  }

  async function handleSaveCompletion(qualityRating: QualityRatingValue) {
    if (!surahNumber || ayahStart === null || ayahEnd === null) return;
    const completedThroughAyah = clampCompletedAyahEnd(ratingAyahEnd ?? ayahEnd);
    const sessionAyahs = buildAyahRange(ayahStart, completedThroughAyah);
    setSubmitting(true);
    setSaveError(null);
    try {
      const [dashboardBeforeSave, latestProgress] = await Promise.all([
        fetchDashboard(childId),
        fetchMemorizationProgress(childId),
      ]);
      const existingProgress = latestProgress.find((item) => item.surahNumber === surahNumber);
      const totalVerses =
        existingProgress?.totalVerses ??
        chaptersMap.get(surahNumber)?.verses_count ??
        displayWordsMap.size;
      const hadFullSurahBeforeSave = hasFullSurahMemorized(
        existingProgress?.memorizedAyahs ?? [],
        totalVerses,
      );
      const memorizedAyahs = mergeMemorizedAyahs(
        existingProgress?.memorizedAyahs,
        sessionAyahs,
        totalVerses,
      );
      const status = hasFullSurahMemorized(memorizedAyahs, totalVerses)
        ? "memorized"
        : "in_progress";

      await submitMemorization(childId, {
        surahId: surahNumber,
        memorizedAyahs,
        ratedAyahs: sessionAyahs,
        qualityRating,
        status,
      });

      await submitTodayMemorizationProgress(
        dashboardBeforeSave,
        latestProgress,
        status,
        completedThroughAyah,
      );
      const nextCelebration = buildCompletionCelebration({
        completedThroughAyah,
        totalVerses,
        status,
        hadFullSurahBeforeSave,
      });

      try {
        await refreshDiscoverySnapshot();
      } catch (refreshError) {
        setDiscoveryState({
          status: "error",
          message:
            refreshError instanceof Error
              ? refreshError.message
              : "Saved, but the memorization list could not refresh.",
        });
      }

      setCompletionSheetOpen(false);
      setSelectedQuality(null);
      setRatingAyahEnd(null);
      setRecitationCheckSource("teacher");
      setRecitationScore(null);
      setStartInRecitationCheck(false);
      setSessionBookmark(null);
      await clearMemorizationSessionBookmark(childId);
      setSessionRequested(false);
      setLoading(false);
      if (nextCelebration && confettiEnabled) {
        setCelebration(nextCelebration);
      } else if (!nextCelebration) {
        Alert.alert("Progress saved.", "The rating was saved for the selected ayah range.");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save.";
      setSaveError(message);
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Recite mode ──────────────────────────────────────────────────────────────

  function makeReciteWordKey(verseNumber: number, expectedIdx: number) {
    return `${verseNumber}:${expectedIdx}`;
  }

  function isSkippedReciteWord(word?: ApiWord) {
    const text = word?.text_uthmani ?? "";
    if (!text || SKIP_CHARS.test(text)) return true;

    const expectedNorm = stripTashkeel(text);
    if (!expectedNorm) return true;

    const expectedTry = stripAlPrefix(expectedNorm);
    const expectedFinal = expectedTry.length >= 2 ? expectedTry : expectedNorm;
    return expectedFinal.length <= 2 && /^[هاا]+$/.test(expectedFinal);
  }

  function getNextReciteWordIndex(verseWords: ApiWord[], startIdx: number) {
    for (let idx = Math.max(0, startIdx); idx < verseWords.length; idx++) {
      if (!isSkippedReciteWord(verseWords[idx])) return idx;
    }
    return null;
  }

  function setReciteCursor(verseNumber: number, expectedIdx: number) {
    reciteExpectedIdxRef.current = expectedIdx;
    setReciteExpectedIdx(expectedIdx);
    setHighlightedWord(expectedIdx);

    if (surahNumberRef.current !== null) {
      const word = displayWordsMapRef.current.get(verseNumber)?.[expectedIdx];
      setHighlightedPage({
        verseKey: `${surahNumberRef.current}:${verseNumber}`,
        position: word?.position ?? expectedIdx + 1,
      });
    }
  }

  function setReciteAttemptCount(nextAttempts: number) {
    reciteAttemptsRef.current = nextAttempts;
    setReciteAttempts(nextAttempts);
  }

  function addReciteAttempts(delta: number) {
    const nextAttempts = reciteAttemptsRef.current + delta;
    setReciteAttemptCount(nextAttempts);
    return nextAttempts;
  }

  function revealReciteWord(verseNumber: number, expectedIdx: number) {
    const key = makeReciteWordKey(verseNumber, expectedIdx);
    const next = new Set(revealedReciteWordsRef.current);
    next.add(key);
    revealedReciteWordsRef.current = next;
    setRevealedReciteWords(next);
    return key;
  }

  function resetReciteAssistState() {
    setReciteAttemptCount(0);
    const empty = new Set<string>();
    revealedReciteWordsRef.current = empty;
    setRevealedReciteWords(empty);
  }

  function calculateReciteScore(attempts = reciteAttemptsRef.current) {
    const hintsUsed = revealedReciteWordsRef.current.size;
    const failedAttempts = Math.max(0, attempts - hintsUsed * 3);
    const penalty = hintsUsed * 15 + failedAttempts * 3;
    return Math.max(0, 100 - penalty);
  }

  function advancePastCurrentReciteVerse(scoreAttempts = reciteAttemptsRef.current) {
    const nextVerse = currentVerseRef.current + 1;
    if (ayahEndRef.current !== null && currentVerseRef.current < ayahEndRef.current) {
      const nextWords = displayWordsMapRef.current.get(nextVerse) ?? [];
      const nextExpectedIdx = getNextReciteWordIndex(nextWords, 0) ?? 0;
      currentVerseRef.current = nextVerse;
      setCurrentVerse(nextVerse);
      setReciteCursor(nextVerse, nextExpectedIdx);
      return;
    }

    setReciteListening(false);
    ExpoSpeechRecognitionModule.stop();
    openRecitationCheck({
      completedToAyah: ayahEndRef.current ?? currentVerseRef.current,
      source: "noorpath",
      score: calculateReciteScore(scoreAttempts),
    });
  }

  function handleShowReciteWord() {
    if (!reciteModeRef.current) return;
    const verseNumber = currentVerseRef.current;
    const verseWords = displayWordsMapRef.current.get(verseNumber) ?? [];
    const currentExpectedIdx = getNextReciteWordIndex(
      verseWords,
      reciteExpectedIdxRef.current,
    );
    if (currentExpectedIdx === null) return;

    setReciteCursor(verseNumber, currentExpectedIdx);
    revealReciteWord(verseNumber, currentExpectedIdx);
    addReciteAttempts(3);
  }

  function handleSkipReciteWord() {
    if (!reciteModeRef.current) return;
    const verseNumber = currentVerseRef.current;
    const verseWords = displayWordsMapRef.current.get(verseNumber) ?? [];
    const currentExpectedIdx = getNextReciteWordIndex(
      verseWords,
      reciteExpectedIdxRef.current,
    );

    if (currentExpectedIdx === null) {
      advancePastCurrentReciteVerse();
      return;
    }

    revealReciteWord(verseNumber, currentExpectedIdx);
    const nextAttempts = addReciteAttempts(5);
    matchedWordCountRef.current = 0;
    lastMatchedWordRef.current = "";

    const nextExpectedIdx = getNextReciteWordIndex(verseWords, currentExpectedIdx + 1);
    if (nextExpectedIdx !== null) {
      setReciteCursor(verseNumber, nextExpectedIdx);
      return;
    }

    advancePastCurrentReciteVerse(nextAttempts);
  }

  async function startRecognition() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setReciteError("Microphone or speech recognition permission denied.");
      setReciteMode(false);
      Alert.alert(
        "Permission needed",
        "NoorPath needs microphone and speech recognition access. Enable them in Settings.",
      );
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "ar-SA",
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: false,
      maxAlternatives: 1,
    });
    setReciteListening(true);
    setReciteError(null);
  }

  useSpeechRecognitionEvent("result", (event) => {
    if (!reciteModeRef.current) return;

    // Debounce: ignore rapid-fire interim events right after a successful match.
    if (Date.now() - lastMatchTimeRef.current < 300) return;

    const result = event.results?.[0];
    if (!result) return;
    const transcript = result.transcript ?? "";
    if (!transcript) return;
    const isFinal = !!event.isFinal;

    const heardNormFull = stripTashkeel(transcript);
    const heardTokens = tokenize(heardNormFull);

    const verseWords = displayWordsMapRef.current.get(currentVerseRef.current);
    if (!verseWords) return;

    let expectedIdx = reciteExpectedIdxRef.current;
    let advanced = false;
    let searchFrom = matchedWordCountRef.current;

    // Walk forward through expected words, advancing as long as we keep finding
    // matches in the heard tokens. This handles iOS's growing partial transcript
    // — every result event includes everything heard so far in this utterance.
    while (expectedIdx < verseWords.length) {
      const expectedRaw = verseWords[expectedIdx]?.text_uthmani ?? "";
      if (!expectedRaw || SKIP_CHARS.test(expectedRaw)) {
        expectedIdx++;
        continue;
      }

      const expectedNorm = stripTashkeel(expectedRaw);
      if (!expectedNorm) {
        expectedIdx++;
        continue;
      }
      // Try with and without ال prefix
      const expectedTry = stripAlPrefix(expectedNorm);
      const expectedFinal = expectedTry.length >= 2 ? expectedTry : expectedNorm;

      // Skip Uthmani words that strip to ≤2 chars of only ه/ا — ligature artifacts
      // speech recognition will never produce.
      if (expectedFinal.length <= 2 && /^[هاا]+$/.test(expectedFinal)) {
        expectedIdx++;
        continue;
      }

      // Scan the heard transcript from searchFrom onward for any token matching expected
      let foundAt = -1;
      for (let i = searchFrom; i < heardTokens.length; i++) {
        const heardRaw = heardTokens[i];
        if (!heardRaw) continue;
        const heardTry = stripAlPrefix(heardRaw);
        const heardFinal = heardTry.length >= 2 ? heardTry : heardRaw;
        if (wordMatches(heardFinal, expectedFinal, lastMatchedWordRef.current)) {
          foundAt = i;
          break;
        }
      }

      if (foundAt === -1) break; // no more expected matches in this transcript

      advanced = true;
      lastMatchTimeRef.current = Date.now();
      const matchedRaw = heardTokens[foundAt];
      if (!matchedRaw) break;
      const matchedTry = stripAlPrefix(matchedRaw);
      lastMatchedWordRef.current = matchedTry.length >= 2 ? matchedTry : matchedRaw;
      matchedWordCountRef.current = foundAt + 1;
      searchFrom = foundAt + 1;

      expectedIdx++;
    }

    if (advanced) {
      setReciteAttemptCount(0);
      if (expectedIdx >= verseWords.length) {
        advancePastCurrentReciteVerse(0);
      } else {
        setReciteCursor(currentVerseRef.current, expectedIdx);
      }
    } else if (isFinal) {
      addReciteAttempts(1);
    }

    // Final result closes this utterance — reset search position so the
    // next utterance starts fresh from token 0.
    if (isFinal) {
      matchedWordCountRef.current = 0;
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!reciteModeRef.current) return;
    setReciteError(event.error ?? "Recognition error");
    setReciteListening(false);
  });

  useSpeechRecognitionEvent("end", () => {
    if (reciteModeRef.current) {
      startRecognition();
    } else {
      setReciteListening(false);
    }
  });

  useEffect(() => {
    if (reciteMode) {
      startRecognition();
    } else {
      ExpoSpeechRecognitionModule.stop();
      setReciteListening(false);
    }
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [reciteMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleVerseReveal(verseKey: string) {
    setRevealedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(verseKey)) {
        next.delete(verseKey);
      } else {
        next.add(verseKey);
      }
      return next;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getTranslationText(t: ApiWord["translation"]): string {
    if (!t) return "";
    if (typeof t === "string") return t;
    return t.text ?? "";
  }

  function openTappedWordTooltip({
    verseKey,
    word,
    fallbackPosition,
  }: {
    verseKey: string;
    word: ApiWord;
    fallbackPosition: number;
  }) {
    if (blindMode || reciteModeRef.current || surahNumber === null) return;
    const ci = verseKey.indexOf(":");
    const vSurah = Number(verseKey.slice(0, ci));
    const vVerse = Number(verseKey.slice(ci + 1));
    if (vSurah !== surahNumber || !Number.isFinite(vVerse)) return;

    const position = Number.isFinite(word.position) && word.position > 0
      ? word.position
      : fallbackPosition;
    if (!Number.isFinite(position) || position <= 0) return;

    const key = `${verseKey}:${position}`;
    setTappedWord((prev) =>
      prev?.key === key
        ? null
        : {
            key,
            arabic: word.text_uthmani,
            translation: getTranslationText(word.translation),
            surahNumber: vSurah,
            ayahNumber: vVerse,
            position,
          },
    );
  }

  async function playTappedWordAudio(target: TappedWordTarget) {
    setWordAudioLoadingKey(target.key);
    try {
      if (wordAudioSoundRef.current) {
        try {
          await wordAudioSoundRef.current.unloadAsync();
        } catch {
          // ignore stale word audio
        }
        wordAudioSoundRef.current = null;
      }

      let createdSound: Audio.Sound | null = null;
      const result = await Audio.Sound.createAsync(
        { uri: wbwAudioUrl(target.surahNumber, target.ayahNumber, target.position) },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded || !status.didJustFinish) return;
          const finishedSound = createdSound;
          void (async () => {
            if (wordAudioSoundRef.current === finishedSound) {
              wordAudioSoundRef.current = null;
            }
            try {
              await finishedSound?.unloadAsync();
            } catch {
              // ignore — the short word clip may already be gone
            }
          })();
        },
      );
      createdSound = result.sound;
      wordAudioSoundRef.current = result.sound;
      try {
        await result.sound.setVolumeAsync(1.0);
      } catch {
        // best-effort
      }
    } catch {
      Alert.alert("Word audio unavailable", "Try playing this word again in a moment.");
    } finally {
      setWordAudioLoadingKey((key) => (key === target.key ? null : key));
    }
  }

  // ── Full Mushaf page renderer ────────────────────────────────────────────────

  function renderMushafPage(pageNum: number) {
    const verses = pageWordsMap.get(pageNum);

    if (!verses) {
      return (
        <View key={pageNum} style={[themedStyles.pageCard, styles.centered, { minHeight: 200 }]}>
          <ActivityIndicator color={THEMES[themeKey].pageMuted} />
        </View>
      );
    }

    // Group all words (including end markers) by line_number
    const lineMap = new Map<number, Array<{ word: ApiWord; verseKey: string }>>();
    for (const verse of verses) {
      for (const word of verse.words) {
        const ln = word.line_number;
        if (!lineMap.has(ln)) lineMap.set(ln, []);
        lineMap.get(ln)!.push({ word, verseKey: verse.verse_key });
      }
    }

    // Surah banners: injected before the first line of each new surah on the page
    let prevSurah: number | null = null;
    const bannerBeforeLine = new Map<number, number>(); // lineNum → surahNumber
    for (const verse of verses) {
      if (!verse.words.length) continue;
      const ci = verse.verse_key.indexOf(":");
      const vSurah = Number(verse.verse_key.slice(0, ci));
      const vVerse = Number(verse.verse_key.slice(ci + 1));
      const firstWord = verse.words[0];
      if (!firstWord) continue;
      if (prevSurah === null && vVerse === 1) {
        bannerBeforeLine.set(firstWord.line_number, vSurah);
      } else if (prevSurah !== null && vSurah !== prevSurah) {
        bannerBeforeLine.set(firstWord.line_number, vSurah);
      }
      prevSurah = vSurah;
    }

    const uniqueSurahs: number[] = [];
    for (const verse of verses) {
      const ci = verse.verse_key.indexOf(":");
      const vSurah = Number(verse.verse_key.slice(0, ci));
      if (!uniqueSurahs.includes(vSurah)) uniqueSurahs.push(vSurah);
    }
    const surahNamesStr = uniqueSurahs
      .map((s) => chaptersMap.get(s)?.name_arabic ?? "")
      .filter(Boolean)
      .join(" · ");

    const juz = getJuzForPage(pageNum);
    const lineNums = [...lineMap.keys()].sort((a, b) => a - b);

    return (
      <View
        key={pageNum}
        style={themedStyles.pageCard}
        onLayout={(e) => {
          pageCardLayoutMap.current.set(pageNum, e.nativeEvent.layout.y);
        }}
      >
        {/* Header bar: surah names (left) + Juz label (right) */}
        <View style={themedStyles.pageHeader}>
          <Text style={themedStyles.pageHeaderNames} numberOfLines={1}>
            {surahNamesStr}
          </Text>
          <Text style={themedStyles.pageHeaderJuz}>{`JUZ ${juz}`}</Text>
        </View>

        {/* Page body: lines with surah banners injected at surah transitions */}
        <View style={styles.pageBody}>
          {lineNums.map((lineNum) => {
            const lineItems = lineMap.get(lineNum)!;
            const bannerSurahNum = bannerBeforeLine.get(lineNum);
            const bannerName =
              bannerSurahNum !== undefined
                ? (chaptersMap.get(bannerSurahNum)?.name_arabic ?? "")
                : null;

            return (
              <React.Fragment key={lineNum}>
                {bannerSurahNum !== undefined && (
                  <View style={styles.surahBanner}>
                    <View style={themedStyles.surahBannerRule} />
                    <View style={styles.surahBannerLabel}>
                      <Text style={themedStyles.surahBannerText}>{bannerName}</Text>
                    </View>
                    <View style={themedStyles.surahBannerRule} />
                  </View>
                )}
                {/*
                 * One canonical Mushaf line may wrap to 2+ visual lines on phones.
                 * Real per-page typography is a later phase.
                 */}
                <View
                  style={styles.mushafLine}
                  onLayout={(e) => {
                    lineLayoutMap.current.set(
                      `page:${pageNum}:line:${lineNum}`,
                      e.nativeEvent.layout.y,
                    );
                  }}
                >
                  {lineItems.map((item, idx) => {
                    const ci = item.verseKey.indexOf(":");
                    const vSurah = Number(item.verseKey.slice(0, ci));
                    const vVerse = Number(item.verseKey.slice(ci + 1));
                    const inScope =
                      surahNumber !== null &&
                      ayahStart !== null &&
                      ayahEnd !== null &&
                      vSurah === surahNumber &&
                      vVerse >= ayahStart &&
                      vVerse <= ayahEnd;

                    if (item.word.char_type_name === "end") {
                      const markerHiddenByBlind =
                        inScope && blindMode && !revealedVerses.has(item.verseKey);
                      const canOpenAyahSheet = inScope && !reciteMode && !markerHiddenByBlind;
                      const pageVerse = verses.find((verse) => verse.verse_key === item.verseKey);
                      return (
                        <Pressable
                          key={`${item.verseKey}-${item.word.position}-${idx}`}
                          accessibilityRole={canOpenAyahSheet ? "button" : undefined}
                          accessibilityLabel={`Ayah ${vVerse} actions`}
                          disabled={!canOpenAyahSheet}
                          onPress={() => {
                            openAyahSheet({
                              verseKey: item.verseKey,
                              surahNumber: vSurah,
                              ayahNumber: vVerse,
                              pageNumber: pageNum,
                              textUthmani: pageVerse?.text_uthmani ?? "",
                            });
                          }}
                          style={({ pressed }) => [
                            styles.mushafEndMarkerPressable,
                            canOpenAyahSheet && styles.mushafEndMarkerInteractive,
                            pressed && styles.mushafEndMarkerPressed,
                          ]}
                        >
                          <Text
                            style={[
                              themedStyles.mushafEndMarker,
                              !inScope && themedStyles.mushafWordDimmed,
                              markerHiddenByBlind && styles.mushafEndMarkerDisabledText,
                            ]}
                          >
                            {item.word.text_uthmani}
                          </Text>
                        </Pressable>
                      );
                    }

                    const isHighlighted =
                      highlightedPage?.verseKey === item.verseKey &&
                      highlightedPage?.position === item.word.position;
                    const verseHidden = inScope && blindMode && !revealedVerses.has(item.verseKey);
                    const isCurrentlyPlayingVerse =
                      isPlaying && item.verseKey === `${surahNumber}:${playingVerseNumber}`;
                    const canShowWordTooltip =
                      inScope &&
                      !blindMode &&
                      !reciteMode &&
                      item.verseKey === `${surahNumber}:${playingVerseNumber}`;
                    const isBlurred =
                      blurMode && isPlaying && inScope && !isCurrentlyPlayingVerse;
                    const pageWordIndex =
                      Number.isFinite(item.word.position) && item.word.position > 0
                        ? item.word.position - 1
                        : -1;
                    const isSkippedPageWord = isSkippedReciteWord(item.word);
                    const isCurrentReciteVerse =
                      reciteMode && inScope && vVerse === currentVerse;
                    const isFutureReciteVerse =
                      reciteMode && inScope && vVerse > currentVerse;
                    const isPastReciteVerse =
                      reciteMode && inScope && vVerse < currentVerse;
                    const isCurrentReciteWord =
                      isCurrentReciteVerse &&
                      pageWordIndex >= 0 &&
                      currentReciteExpectedIndex !== null &&
                      pageWordIndex === currentReciteExpectedIndex &&
                      !isSkippedPageWord;
                    const reciteWordRevealed =
                      isCurrentReciteWord &&
                      revealedReciteWords.has(makeReciteWordKey(vVerse, pageWordIndex));
                    const isPastReciteWord =
                      isPastReciteVerse ||
                      (isCurrentReciteVerse &&
                        currentReciteExpectedIndex !== null &&
                        pageWordIndex >= 0 &&
                        pageWordIndex < currentReciteExpectedIndex);
                    const hideWordForRecite =
                      reciteMode &&
                      inScope &&
                      pageWordIndex >= 0 &&
                      !isSkippedPageWord &&
                      !isPastReciteWord &&
                      (isFutureReciteVerse ||
                        (isCurrentReciteVerse &&
                          currentReciteExpectedIndex !== null &&
                          pageWordIndex >= currentReciteExpectedIndex &&
                          (!isCurrentReciteWord || !reciteWordRevealed)));
                    const hiddenByBlind = verseHidden && !reciteWordRevealed;
                    const tajweedColor =
                      tajweedEnabled && inScope
                        ? extractTajweedColor(item.word.text_uthmani_tajweed)
                        : null;
                    const wordBlurTextStyle = hideWordForRecite
                      ? isCurrentReciteWord
                        ? styles.wordBlurSoftText
                        : styles.wordBlurStrongText
                      : isBlurred
                        ? styles.wordBlurStrongText
                      : undefined;
                    const wordBlurShadowStyle = wordBlurTextStyle
                      ? { textShadowColor: tajweedColor ?? THEMES[themeKey].pageText }
                      : undefined;
                    return (
                      <Pressable
                        key={`${item.verseKey}-${item.word.position}-${idx}`}
                        style={[
                          styles.mushafWordPressable,
                          isHighlighted && themedStyles.mushafWordHighlighted,
                          isCurrentReciteWord && styles.reciteMushafWordCurrent,
                          hideWordForRecite && !isCurrentReciteWord && styles.reciteMushafWordPending,
                        ]}
                        onPress={
                          inScope
                            ? () => {
                                if (blindMode) {
                                  setTappedWord(null);
                                  toggleVerseReveal(item.verseKey);
                                  return;
                                }
                                void handlePageWordTap(item.verseKey, item.word.position);
                                if (canShowWordTooltip) {
                                  openTappedWordTooltip({
                                    verseKey: item.verseKey,
                                    word: item.word,
                                    fallbackPosition: item.word.position,
                                  });
                                }
                              }
                            : undefined
                        }
                        onLongPress={
                          inScope
                            ? () => {
                                setTappedWord(null);
                                const translation = getTranslationText(item.word.translation);
                                if (translation) {
                                  setTranslationPopup({
                                    arabic: item.word.text_uthmani,
                                    translation,
                                  });
                                }
                              }
                            : undefined
                        }
                        delayLongPress={400}
                      >
                        <Text
                          style={[
                            themedStyles.mushafWord,
                            !inScope && themedStyles.mushafWordDimmed,
                            tajweedColor ? { color: tajweedColor } : undefined,
                            wordBlurTextStyle,
                            wordBlurShadowStyle,
                          ]}
                        >
                          {hiddenByBlind ? "••••" : item.word.text_uthmani}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Footer: centered page number */}
        <View style={themedStyles.pageFooter}>
          <Text style={themedStyles.pageFooterText}>{pageNum}</Text>
        </View>
      </View>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const words = displayWordsMap.get(playingVerseNumber) ?? [];
  const currentReciteExpectedIndex = reciteMode
    ? getNextReciteWordIndex(words, reciteExpectedIdx)
    : null;
  const ayahVerseKey = surahNumber !== null ? `${surahNumber}:${playingVerseNumber}` : "";
  const ayahVerseHidden = blindMode && !revealedVerses.has(ayahVerseKey);
  const verseIndex = ayahStart !== null ? currentVerse - ayahStart + 1 : 1;
  const totalVerses = ayahStart !== null && ayahEnd !== null ? ayahEnd - ayahStart + 1 : 0;
  const singleRepeatPass = Math.min(currentRepeatDisplay, repeatCount);
  const canPrev = ayahStart !== null && currentVerse > ayahStart;
  const canEnterCumulativeFromSingle =
    internalPhase === "single" &&
    cumulativeReview &&
    ayahStart !== null &&
    currentVerse > ayahStart;
  const canNext =
    internalPhase === "cumulative" ||
    canEnterCumulativeFromSingle ||
    (ayahEnd !== null && currentVerse < ayahEnd);
  const canSkipRepeat = !reciteMode && !submitting && (
    internalPhase === "cumulative" || repeatCount > 1
  );
  const canSkipAyah = !reciteMode && !submitting && ayahEnd !== null;
  const activeMushafPage = useMemo(() => {
    if (surahNumber === null) return null;
    const mappedPage = versePageMap.get(playingVerseNumber) ?? versePageMap.get(currentVerse);
    if (mappedPage !== undefined) return clampMushafPage(mappedPage);
    if (pageStart !== null) return clampMushafPage(pageStart);
    const fallbackPage = MUSHAF_SURAHS.find((surah) => surah.number === surahNumber)?.startPage;
    return fallbackPage ? clampMushafPage(fallbackPage) : null;
  }, [surahNumber, versePageMap, playingVerseNumber, currentVerse, pageStart]);
  const sessionMushafPages = useMemo(() => {
    const pages = new Set<number>();
    if (ayahStart !== null && ayahEnd !== null) {
      for (const [verseNumber, pageNumber] of versePageMap) {
        if (verseNumber >= ayahStart && verseNumber <= ayahEnd) {
          pages.add(clampMushafPage(pageNumber));
        }
      }
    }

    if (pages.size === 0 && pageStart !== null && pageEnd !== null) {
      for (let pageNum = pageStart; pageNum <= pageEnd; pageNum += 1) {
        pages.add(clampMushafPage(pageNum));
      }
    }

    return [...pages].sort((a, b) => a - b);
  }, [ayahStart, ayahEnd, versePageMap, pageStart, pageEnd]);
  const displayedRecitePage = displayedMushafPage ?? activeMushafPage;
  const displayedRecitePageIndex =
    displayedRecitePage !== null ? sessionMushafPages.indexOf(displayedRecitePage) : -1;
  const currentReciteWordPage = reciteMode
    ? (versePageMap.get(currentVerse) ?? activeMushafPage)
    : null;
  const recitePageNavigationVisible =
    reciteMode &&
    viewMode === "page" &&
    currentReciteExpectedIndex !== null &&
    sessionMushafPages.length > 1;
  const previousRecitePage =
    recitePageNavigationVisible && displayedRecitePageIndex > 0
      ? (sessionMushafPages[displayedRecitePageIndex - 1] ?? null)
      : null;
  const nextRecitePage =
    recitePageNavigationVisible &&
    displayedRecitePageIndex >= 0 &&
    displayedRecitePageIndex < sessionMushafPages.length - 1
      ? (sessionMushafPages[displayedRecitePageIndex + 1] ?? null)
      : null;
  const showCurrentReciteWordJump =
    recitePageNavigationVisible &&
    currentReciteWordPage !== null &&
    displayedRecitePage !== null &&
    currentReciteWordPage !== displayedRecitePage;
  const currentReciteWordJumpIcon: keyof typeof Ionicons.glyphMap =
    currentReciteWordPage !== null &&
    displayedRecitePage !== null &&
    currentReciteWordPage < displayedRecitePage
      ? "arrow-up-outline"
      : "arrow-down-outline";

  useEffect(() => {
    if (viewMode !== "page" || activeMushafPage === null) return;
    setDisplayedMushafPage((previousPage) =>
      previousPage === activeMushafPage ? previousPage : activeMushafPage,
    );
  }, [activeMushafPage, viewMode, sessionLoadId]);

  const handleSessionScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (viewMode !== "page" || sessionMushafPages.length === 0) return;

      const topEdge = event.nativeEvent.contentOffset.y + 96;
      let visiblePage = sessionMushafPages[0] ?? null;
      for (const pageNum of sessionMushafPages) {
        const pageY = pageCardLayoutMap.current.get(pageNum);
        if (pageY === undefined) continue;
        if (pageY <= topEdge) {
          visiblePage = pageNum;
        } else {
          break;
        }
      }

      if (visiblePage !== null) {
        setDisplayedMushafPage((previousPage) =>
          previousPage === visiblePage ? previousPage : visiblePage,
        );
      }
    },
    [sessionMushafPages, viewMode],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!sessionRequested) {
    if (pendingSessionTarget) {
      return (
        <MemorizationSetup
          childId={childId}
          name={params.name}
          target={pendingSessionTarget}
          surahs={discoveryState.status === "ready" ? discoveryState.surahs : []}
          chaptersMap={chaptersMap}
          repeatCount={repeatCount}
          autoAdvance={autoplayThroughRange}
          cumulativeReview={cumulativeReview}
          reviewRepeatCount={reviewRepeatCount}
          onRepeatCountChange={setRepeatCount}
          onAutoAdvanceChange={setAutoplayThroughRange}
          onCumulativeReviewChange={setCumulativeReview}
          onReviewRepeatCountChange={setReviewRepeatCount}
          onCancel={() => setPendingSessionTarget(null)}
          onOpenSettings={openParentDefaults}
          onStart={startConfiguredSession}
          onJustGetTested={(target) =>
            startConfiguredSession({ ...target, startInRecitationCheck: true })
          }
        />
      );
    }

    return (
      <MemorizationDiscovery
        childId={childId}
        name={params.name}
        state={discoveryState}
        sessionBookmark={sessionBookmark}
        query={discoveryQuery}
        filter={discoveryFilter}
        refreshing={discoveryRefreshing}
        onQueryChange={setDiscoveryQuery}
        onFilterChange={setDiscoveryFilter}
        onRefresh={() => {
          void loadSessionBookmark();
          void loadDiscovery("refresh");
        }}
        onRetry={() => loadDiscovery()}
        onBack={() => router.back()}
        onOpenSettings={openParentDefaults}
        onStart={prepareSession}
        onStartDirect={startConfiguredSession}
        onStartBookmark={startBookmarkedSession}
      />
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#2563eb" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleRequestSessionLeave}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {reciteMode
            ? `Recite Verse ${verseIndex} of ${totalVerses}`
            : internalPhase === "cumulative" && ayahStart !== null
              ? `Pass ${cumPass}/${reviewRepeatCount} · Ayahs ${ayahStart}–${cumUpTo}`
              : repeatCount > 1
                ? `Pass ${singleRepeatPass}/${repeatCount} · Verse ${verseIndex} of ${totalVerses}`
              : `Verse ${verseIndex} of ${totalVerses}`}
        </Text>
        <Pressable
          style={styles.headerButton}
          onPress={() => setSettingsOpen(true)}
        >
          <Text style={styles.headerButtonIcon}>⚙</Text>
        </Pressable>
      </View>

      {/* View mode toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.togglePill, viewMode === "ayah" && styles.togglePillSelected]}
          onPress={() => setViewMode("ayah")}
        >
          <Text
            style={[
              styles.togglePillText,
              viewMode === "ayah" && styles.togglePillTextSelected,
            ]}
          >
            Ayah by Ayah
          </Text>
        </Pressable>
        <Pressable
          style={[styles.togglePill, viewMode === "page" && styles.togglePillSelected]}
          onPress={() => setViewMode("page")}
        >
          <Text
            style={[
              styles.togglePillText,
              viewMode === "page" && styles.togglePillTextSelected,
            ]}
          >
            Full Mushaf
          </Text>
        </Pressable>
      </View>

      {/* Scrollable content — flex: 1 so controls island stays pinned below */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleSessionScroll}
        scrollEventThrottle={120}
      >
        {viewMode === "ayah" ? (
          <View style={styles.verseCard}>
            <View style={styles.wordContainer}>
              {words.map((word, idx) => {
                const tajweedColor = tajweedEnabled ? extractTajweedColor(word.text_uthmani_tajweed) : null;
                const isSkippedWord = isSkippedReciteWord(word);
                const isCurrentReciteWord =
                  reciteMode &&
                  currentReciteExpectedIndex !== null &&
                  currentReciteExpectedIndex === idx &&
                  !isSkippedWord;
                const isPastReciteWord =
                  reciteMode &&
                  currentReciteExpectedIndex !== null &&
                  idx < currentReciteExpectedIndex;
                const reciteWordRevealed =
                  isCurrentReciteWord &&
                  revealedReciteWords.has(makeReciteWordKey(playingVerseNumber, idx));
                const hideWordForRecite =
                  reciteMode &&
                  currentReciteExpectedIndex !== null &&
                  !isSkippedWord &&
                  !isPastReciteWord &&
                  (!isCurrentReciteWord || !reciteWordRevealed);
                const hiddenByBlind = ayahVerseHidden && !reciteWordRevealed;
                const reciteBlurTextStyle = hideWordForRecite
                  ? isCurrentReciteWord
                    ? styles.wordBlurSoftText
                    : styles.wordBlurStrongText
                  : undefined;
                const reciteBlurShadowStyle = reciteBlurTextStyle
                  ? { textShadowColor: tajweedColor ?? "#111111" }
                  : undefined;
                return (
                  <Pressable
                    key={`${playingVerseNumber}-${idx}`}
                    onPress={() => {
                      if (blindMode) {
                        setTappedWord(null);
                        toggleVerseReveal(ayahVerseKey);
                        return;
                      }
                      void handleWordTap(idx);
                      if (!reciteMode && ayahVerseKey) {
                        openTappedWordTooltip({
                          verseKey: ayahVerseKey,
                          word,
                          fallbackPosition: idx + 1,
                        });
                      }
                    }}
                    onLongPress={() => {
                      setTappedWord(null);
                      const translation = getTranslationText(word.translation);
                      if (translation) {
                        setTranslationPopup({ arabic: word.text_uthmani, translation });
                      }
                    }}
                    delayLongPress={400}
                    style={[
                      styles.wordWrapper,
                      highlightedWord === idx && styles.wordHighlighted,
                      isCurrentReciteWord && styles.reciteWordCurrent,
                      hideWordForRecite && !isCurrentReciteWord && styles.reciteWordPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.arabicWord,
                        tajweedColor ? { color: tajweedColor } : undefined,
                        reciteBlurTextStyle,
                        reciteBlurShadowStyle,
                      ]}
                    >
                      {hiddenByBlind ? "••••" : word.text_uthmani}
                    </Text>
                  </Pressable>
                );
              })}
              {surahNumber !== null && ayahVerseKey ? (() => {
                const canOpenCurrentAyahSheet = !reciteMode && !ayahVerseHidden && !submitting;
                return (
                  <Pressable
                    accessibilityRole={canOpenCurrentAyahSheet ? "button" : undefined}
                    accessibilityLabel={`Ayah ${playingVerseNumber} actions`}
                    disabled={!canOpenCurrentAyahSheet}
                    onPress={() => {
                      openAyahSheet({
                        verseKey: ayahVerseKey,
                        surahNumber,
                        ayahNumber: playingVerseNumber,
                        pageNumber: activeMushafPage,
                        textUthmani: words.map((word) => word.text_uthmani).join(" "),
                      });
                    }}
                    style={({ pressed }) => [
                      styles.ayahEndMarkerButton,
                      !canOpenCurrentAyahSheet && styles.ayahEndMarkerButtonDisabled,
                      pressed && styles.ayahEndMarkerButtonPressed,
                    ]}
                  >
                    <Text style={styles.ayahEndMarkerText}>{playingVerseNumber}</Text>
                  </Pressable>
                );
              })() : null}
            </View>
          </View>
        ) : pageStart === null || pageEnd === null ? (
          <View style={[themedStyles.pageCard, styles.centered, { minHeight: 200 }]}>
            <Text style={styles.errorText}>Page data not available.</Text>
          </View>
        ) : (
          <>
            {Array.from({ length: pageEnd - pageStart + 1 }, (_, i) =>
              renderMushafPage(pageStart + i),
            )}
          </>
        )}
      </ScrollView>

      {reciteMode && currentReciteExpectedIndex !== null && (
        <View style={styles.reciteAssistRow}>
          <Pressable
            style={[styles.reciteAssistPill, styles.reciteShowPill]}
            onPress={handleShowReciteWord}
            accessibilityRole="button"
            accessibilityLabel="Show current recite word"
          >
            <Ionicons name="eye-outline" size={15} color="#15803d" />
            <Text style={[styles.reciteAssistPillText, styles.reciteShowPillText]}>
              Show Word
            </Text>
          </Pressable>
          <Pressable
            style={[styles.reciteAssistPill, styles.reciteSkipPill]}
            onPress={handleSkipReciteWord}
            accessibilityRole="button"
            accessibilityLabel="Skip current recite word"
          >
            <Ionicons name="play-skip-forward-outline" size={15} color="#b45309" />
            <Text style={[styles.reciteAssistPillText, styles.reciteSkipPillText]}>
              Skip Word
            </Text>
          </Pressable>
          {previousRecitePage !== null && (
            <Pressable
              style={[styles.reciteAssistPill, styles.recitePagePill]}
              onPress={() => scrollMushafPageIntoView(previousRecitePage)}
              accessibilityRole="button"
              accessibilityLabel={`Go to previous recite page ${previousRecitePage}`}
            >
              <Ionicons name="chevron-up-outline" size={15} color="#475569" />
              <Text style={[styles.reciteAssistPillText, styles.recitePagePillText]}>
                p. {previousRecitePage}
              </Text>
            </Pressable>
          )}
          {nextRecitePage !== null && (
            <Pressable
              style={[styles.reciteAssistPill, styles.recitePagePill]}
              onPress={() => scrollMushafPageIntoView(nextRecitePage)}
              accessibilityRole="button"
              accessibilityLabel={`Go to next recite page ${nextRecitePage}`}
            >
              <Text style={[styles.reciteAssistPillText, styles.recitePagePillText]}>
                p. {nextRecitePage}
              </Text>
              <Ionicons name="chevron-down-outline" size={15} color="#475569" />
            </Pressable>
          )}
          {showCurrentReciteWordJump && (
            <Pressable
              style={[styles.reciteAssistPill, styles.reciteCurrentWordPill]}
              onPress={() => scrollMushafVerseIntoView(currentVerse)}
              accessibilityRole="button"
              accessibilityLabel="Jump to current recite word"
            >
              <Ionicons name={currentReciteWordJumpIcon} size={15} color="#2563eb" />
              <Text style={[styles.reciteAssistPillText, styles.reciteCurrentWordPillText]}>
                Current word
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Fixed controls island — always visible below the scroll area */}
      <View style={styles.controlsIsland}>
        {/* Mode buttons: Blind + Recite placeholder */}
        <View style={styles.modeButtonRow}>
          <Pressable
            style={[styles.modeButton, blindMode && styles.modeButtonActive]}
            onPress={() => setBlindMode(!blindMode)}
          >
            <Text style={[styles.modeButtonText, blindMode && styles.modeButtonTextActive]}>
              {blindMode ? "👁 Blind ON" : "Blind"}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeButton,
              reciteMode && styles.modeButtonActive,
            ]}
            onPress={async () => {
              if (reciteMode) {
                setReciteMode(false);
                resetReciteAssistState();
                return;
              }
              await enterReciteMode(currentVerseRef.current);
            }}
          >
            <Text style={[styles.modeButtonText, reciteMode && styles.modeButtonTextActive]}>
              {reciteMode ? (reciteListening ? "🎤 Listening…" : "🎤 Recite ON") : "🎤 Recite"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.sessionMushafButton, submitting && styles.sessionMushafButtonDisabled]}
          onPress={() => {
            void handleViewInFullMushaf();
          }}
          disabled={submitting}
        >
          <Ionicons name="reader-outline" size={17} color="#0369a1" />
          <Text style={styles.sessionMushafButtonText}>View in Full Mushaf</Text>
          <Text style={styles.sessionMushafButtonMeta}>
            {activeMushafPage ? `p. ${activeMushafPage}` : "Quran"}
          </Text>
        </Pressable>

        {/* Prev / Play / Next */}
        <View style={styles.controls}>
          <Pressable
            style={[styles.navButton, !canPrev && styles.navButtonDisabled]}
            onPress={handlePrev}
            disabled={!canPrev}
          >
            <Text style={styles.navButtonText}>‹ Prev</Text>
          </Pressable>

          <Pressable style={styles.playButton} onPress={handlePlayPause}>
            <Text style={styles.playButtonText}>{isPlaying ? "⏸" : "▶"}</Text>
          </Pressable>

          <Pressable
            style={[styles.navButton, !canNext && styles.navButtonDisabled]}
            onPress={handleNext}
            disabled={!canNext}
          >
            <Text style={styles.navButtonText}>Next ›</Text>
          </Pressable>
        </View>

        <View style={styles.skipControls}>
          <Pressable
            style={[
              styles.skipControlButton,
              !canSkipRepeat && styles.skipControlButtonDisabled,
            ]}
            onPress={handleSkipRepeat}
            disabled={!canSkipRepeat}
            accessibilityRole="button"
            accessibilityLabel="Skip repeat"
          >
            <Ionicons
              name="play-forward-outline"
              size={17}
              color={canSkipRepeat ? "#2563eb" : "#9ca3af"}
            />
            <Text style={[
              styles.skipControlText,
              !canSkipRepeat && styles.skipControlTextDisabled,
            ]}>
              Skip Repeat
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.skipControlButton,
              !canSkipAyah && styles.skipControlButtonDisabled,
            ]}
            onPress={handleSkipAyah}
            disabled={!canSkipAyah}
            accessibilityRole="button"
            accessibilityLabel="Skip ayah"
          >
            <Ionicons
              name="play-skip-forward-outline"
              size={17}
              color={canSkipAyah ? "#2563eb" : "#9ca3af"}
            />
            <Text style={[
              styles.skipControlText,
              !canSkipAyah && styles.skipControlTextDisabled,
            ]}>
              Skip Ayah
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.completeButton, submitting && styles.completeButtonDisabled]}
          onPress={handlePauseAndSave}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.completeButtonText}>
              {sessionReviewOnly ? "Finish Recitation" : "Pause & Save"}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Recite error */}
      {reciteError && (
        <Text style={styles.errorText}>{reciteError}</Text>
      )}

      {/* Leave confirmation sheet */}
      <Modal
        visible={leaveSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!submitting) closeLeaveSheet(true);
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!submitting) closeLeaveSheet(true);
          }}
        />
        <View style={styles.completionSheet}>
          <Text style={styles.sheetTitle}>Leave this session?</Text>
          <Text style={styles.completionSubtitle}>
            {chaptersMap.get(surahNumber ?? 0)?.name_simple ?? "Current surah"} ·{" "}
            {formatAyahRange(ayahStart, ayahEnd)}
          </Text>

          <View style={[styles.pauseSummaryCard, styles.leaveWarningCard]}>
            <Text style={styles.pauseSummaryTitle}>
              {sessionReviewOnly ? "Review-only recitation" : "Save this practice first?"}
            </Text>
            <Text style={styles.pauseSummaryDetail}>
              {sessionReviewOnly
                ? "Save & Leave keeps this review all-or-nothing and opens the recitation rating. Leave without saving returns to Memorize and discards the resume bookmark."
                : "Save & Leave asks how far the child got, then opens the recitation rating. Leave without saving returns to Memorize and discards the resume bookmark."}
            </Text>
          </View>

          <Pressable
            style={[styles.completeButton, submitting && styles.completeButtonDisabled]}
            onPress={handleSaveAndLeave}
            disabled={submitting}
          >
            <Text style={styles.completeButtonText}>Save & Leave</Text>
          </Pressable>
          <Pressable
            style={styles.leaveDestructiveButton}
            onPress={() => {
              void handleLeaveWithoutSaving();
            }}
            disabled={submitting}
          >
            <Text style={styles.leaveDestructiveText}>Leave without saving</Text>
          </Pressable>
          <Pressable
            style={styles.completionCancelButton}
            onPress={() => closeLeaveSheet(true)}
            disabled={submitting}
          >
            <Text style={styles.completionCancelText}>Keep Practicing</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Ready to Recite sheet */}
      <Modal
        visible={readyToReciteSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.backdrop} />
        <View style={styles.completionSheet}>
          <Text style={styles.sheetTitle}>Ready to Recite?</Text>
          <Text style={styles.completionSubtitle}>
            {chaptersMap.get(surahNumber ?? 0)?.name_simple ?? "Current surah"} ·{" "}
            {formatAyahRange(ayahStart, ayahEnd)}
          </Text>

          <View style={styles.pauseSummaryCard}>
            <Text style={styles.pauseSummaryTitle}>Choose the recitation check</Text>
            <Text style={styles.pauseSummaryDetail}>
              The session is complete. Pick whether the child will recite to a teacher now or recite to NoorPath first.
            </Text>
          </View>

          <Pressable
            style={[styles.readyTeacherButton, submitting && styles.completeButtonDisabled]}
            onPress={handleReciteToTeacher}
            disabled={submitting}
          >
            <Text style={styles.readyTeacherButtonText}>Recite to Teacher →</Text>
          </Pressable>
          <Pressable
            style={[styles.readyNoorPathButton, submitting && styles.readyNoorPathButtonDisabled]}
            onPress={() => {
              void handleReciteToNoorPath();
            }}
            disabled={submitting}
          >
            <Text style={styles.readyNoorPathButtonText}>Recite to NoorPath →</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Pause & Save sheet */}
      <Modal
        visible={pauseSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!submitting) setPauseSheetOpen(false);
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!submitting) setPauseSheetOpen(false);
          }}
        />
        <View style={styles.completionSheet}>
          <Text style={styles.sheetTitle}>
            {sessionReviewOnly ? "Finish recitation" : "Pause & Save"}
          </Text>
          <Text style={styles.completionSubtitle}>
            {chaptersMap.get(surahNumber ?? 0)?.name_simple ?? "Current surah"} ·{" "}
            {formatAyahRange(ayahStart, ayahEnd)}
          </Text>

          {sessionReviewOnly ? (
            <View style={styles.pauseSummaryCard}>
              <Text style={styles.pauseSummaryTitle}>Review-only assignment</Text>
              <Text style={styles.pauseSummaryDetail}>
                This recitation check saves the full assigned range together.
              </Text>
            </View>
          ) : (
            <View style={styles.pauseSummaryCard}>
              <Text style={styles.pauseSummaryTitle}>How far did you get?</Text>
              <Text style={styles.pauseSummaryDetail}>
                Pick the last ayah completed. Only ayahs through this point will be rated.
              </Text>
              <View style={styles.pauseStepperRow}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => {
                    const current = pauseCompletedAyahEnd ?? ayahStart ?? 1;
                    setPauseCompletedAyahEnd(clampCompletedAyahEnd(current - 1));
                  }}
                  disabled={submitting || pauseCompletedAyahEnd === ayahStart}
                >
                  <Text style={styles.stepperButtonText}>-</Text>
                </Pressable>
                <View style={styles.pauseAyahValue}>
                  <Text style={styles.pauseAyahKicker}>Completed to</Text>
                  <Text style={styles.pauseAyahNumber}>
                    Ayah {pauseCompletedAyahEnd ?? ayahStart ?? 1}
                  </Text>
                </View>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => {
                    const current = pauseCompletedAyahEnd ?? ayahStart ?? 1;
                    setPauseCompletedAyahEnd(clampCompletedAyahEnd(current + 1));
                  }}
                  disabled={submitting || pauseCompletedAyahEnd === ayahEnd}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
              <View style={styles.pauseQuickRow}>
                <Pressable
                  style={styles.pauseQuickButton}
                  onPress={() => setPauseCompletedAyahEnd(clampCompletedAyahEnd(currentVerseRef.current))}
                  disabled={submitting}
                >
                  <Text style={styles.pauseQuickText}>Current ayah</Text>
                </Pressable>
                <Pressable
                  style={styles.pauseQuickButton}
                  onPress={() => setPauseCompletedAyahEnd(ayahEnd)}
                  disabled={submitting}
                >
                  <Text style={styles.pauseQuickText}>Full range</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable
            style={[styles.completeButton, submitting && styles.completeButtonDisabled]}
            onPress={openRecitationCheckFromPause}
            disabled={submitting}
          >
            <Text style={styles.completeButtonText}>
              Go to Recitation Check
            </Text>
          </Pressable>
          <Pressable
            style={styles.completionCancelButton}
            onPress={() => setPauseSheetOpen(false)}
            disabled={submitting}
          >
            <Text style={styles.completionCancelText}>Keep Practicing</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Recitation Check phase */}
      <Modal
        visible={completionSheetOpen}
        animationType="slide"
        onRequestClose={() => {
          if (!submitting) setCompletionSheetOpen(false);
        }}
      >
        <View style={styles.recitationCheckContainer}>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                if (!submitting) setCompletionSheetOpen(false);
              }}
            >
              <Text style={styles.back}>← Back</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Recitation Check</Text>
            <View style={styles.headerButton} />
          </View>

          <ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={styles.recitationCheckContent}
          >
            <View style={styles.recitationCheckIntroCard}>
              <Text style={styles.recitationCheckKicker}>
                {recitationCheckSource === "noorpath" ? "Recite to NoorPath" : "Recite to Teacher"}
              </Text>
              <Text style={styles.recitationCheckTitle}>
                {chaptersMap.get(surahNumber ?? 0)?.name_simple ?? "Current surah"}
              </Text>
              <Text style={styles.recitationCheckRange}>
                {formatAyahRange(ayahStart, ratingAyahEnd ?? ayahEnd)}
              </Text>
            </View>

            {recitationCheckSource === "noorpath" && recitationScore !== null ? (
              <View style={styles.recitationScoreCard}>
                <Text style={styles.recitationScoreKicker}>Score</Text>
                <Text style={styles.recitationScoreNumber}>{recitationScore}%</Text>
                <Text style={styles.recitationScoreLabel}>
                  {getRecitationScoreLabel(recitationScore)}
                </Text>
                <Text style={styles.recitationScoreDetail}>
                  NoorPath matched the recitation with the current speech checker. The honest rating below still sets review strength.
                </Text>
              </View>
            ) : null}

            <View style={styles.pauseSummaryCard}>
              <Text style={styles.pauseSummaryTitle}>
                {recitationCheckSource === "noorpath"
                  ? "How did the recitation feel?"
                  : "Listen, then rate"}
              </Text>
              <Text style={styles.pauseSummaryDetail}>
                {recitationCheckSource === "noorpath"
                  ? "Use the score as a guide, then choose the rating that best reflects fluency and confidence."
                  : "Ask the child to recite this range from memory, then choose the rating that best reflects fluency and confidence."}
              </Text>
            </View>

            <View style={styles.recitationRatingCard}>
              <Text style={styles.recitationRatingTitle}>
                {recitationCheckSource === "noorpath" ? "How did you do?" : "How did they do?"}
              </Text>
              <View style={styles.ratingOptionList}>
                {QUALITY_OPTIONS.map((option) => {
                  const selected = selectedQuality === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.ratingOption,
                        {
                          backgroundColor: selected ? option.bg : "#ffffff",
                          borderColor: selected ? option.border : "#e5e7eb",
                        },
                      ]}
                      onPress={() => setSelectedQuality(option.value)}
                      disabled={submitting}
                    >
                      <View style={styles.ratingOptionTextBlock}>
                        <Text style={[styles.ratingOptionTitle, { color: selected ? option.color : "#111827" }]}>
                          {option.label}
                        </Text>
                        <Text style={styles.ratingOptionDetail}>{option.detail}</Text>
                      </View>
                      <View
                        style={[
                          styles.ratingRadio,
                          {
                            borderColor: selected ? option.color : "#d1d5db",
                            backgroundColor: selected ? option.color : "#ffffff",
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}

            <Pressable
              style={[
                styles.completeButton,
                (!selectedQuality || submitting) && styles.completeButtonDisabled,
              ]}
              onPress={() => {
                if (!selectedQuality) return;
                void handleSaveCompletion(selectedQuality);
              }}
              disabled={!selectedQuality || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.completeButtonText}>Save Progress</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.completionCancelButton}
              onPress={() => setCompletionSheetOpen(false)}
              disabled={submitting}
            >
              <Text style={styles.completionCancelText}>Keep Practicing</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Ayah action sheet */}
      <Modal
        visible={tappedAyah !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setTappedAyah(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setTappedAyah(null)} />
        {tappedAyah ? (
          <View style={styles.completionSheet}>
            <View style={styles.ayahSheetHeader}>
              <View style={styles.ayahSheetTitleBlock}>
                <Text style={styles.sheetTitle}>Ayah actions</Text>
                <Text style={styles.completionSubtitle}>
                  {chaptersMap.get(tappedAyah.surahNumber)?.name_simple ??
                    `Surah ${tappedAyah.surahNumber}`}{" "}
                  · Ayah {tappedAyah.ayahNumber}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close ayah actions"
                style={styles.ayahSheetCloseButton}
                onPress={() => setTappedAyah(null)}
              >
                <Ionicons name="close" size={18} color="#6b7280" />
              </Pressable>
            </View>

            {tappedAyah.textUthmani ? (
              <View style={styles.ayahSheetArabicCard}>
                <Text style={styles.ayahSheetArabicText} numberOfLines={3}>
                  {tappedAyah.textUthmani}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.ayahPrimaryActionButton, submitting && styles.completeButtonDisabled]}
              onPress={() => {
                const target = tappedAyah;
                if (target) void handlePracticeFromAyah(target);
              }}
              disabled={submitting}
            >
              <Ionicons name="locate-outline" size={17} color="#ffffff" />
              <Text style={styles.ayahPrimaryActionText}>Practice from this ayah</Text>
            </Pressable>

            <Pressable
              style={[styles.ayahSecondaryActionButton, submitting && styles.sessionMushafButtonDisabled]}
              onPress={() => {
                const target = tappedAyah;
                if (target) void handleViewInFullMushaf(target);
              }}
              disabled={submitting}
            >
              <Ionicons name="reader-outline" size={17} color="#0369a1" />
              <Text style={styles.ayahSecondaryActionText}>View in Full Mushaf</Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>

      {/* Settings bottom sheet */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} />
        <View style={styles.settingsSheet}>
          <Text style={styles.sheetTitle}>Settings</Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Repeat count</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setRepeatCount(Math.max(1, repeatCount - 1))}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{repeatCount}</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setRepeatCount(Math.min(10, repeatCount + 1))}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Delay between verses</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setAutoAdvanceDelayMs(Math.max(0, autoAdvanceDelayMs - 500))}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{(autoAdvanceDelayMs / 1000).toFixed(1)}s</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setAutoAdvanceDelayMs(Math.min(5000, autoAdvanceDelayMs + 500))}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Auto-advance through range</Text>
            <Pressable
              onPress={() => setAutoplayThroughRange(!autoplayThroughRange)}
              style={[styles.toggleSwitch, autoplayThroughRange && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, autoplayThroughRange && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Blur other verses while playing</Text>
            <Pressable
              onPress={() => setBlurMode(!blurMode)}
              style={[styles.toggleSwitch, blurMode && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, blurMode && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Tajweed coloring</Text>
            <Pressable
              onPress={() => setTajweedEnabled(!tajweedEnabled)}
              style={[styles.toggleSwitch, tajweedEnabled && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, tajweedEnabled && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Cumulative review</Text>
            <Pressable
              onPress={() => setCumulativeReview(!cumulativeReview)}
              style={[styles.toggleSwitch, cumulativeReview && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, cumulativeReview && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          {cumulativeReview && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Review repeat count</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setReviewRepeatCount(Math.max(1, reviewRepeatCount - 1))}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{reviewRepeatCount}×</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setReviewRepeatCount(Math.min(10, reviewRepeatCount + 1))}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Playback speed</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {PLAYBACK_RATES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setPlaybackRate(r)}
                style={[
                  styles.ratePill,
                  playbackRate === r && styles.ratePillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.ratePillText,
                    playbackRate === r && styles.ratePillTextSelected,
                  ]}
                >
                  {r === 1.0 ? "1x" : `${r}x`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Theme</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => setThemeKey(k)}
                style={[
                  styles.themePill,
                  themeKey === k && styles.themePillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.themePillText,
                    themeKey === k && styles.themePillTextSelected,
                  ]}
                >
                  {THEME_DISPLAY_NAMES[k]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Reciter</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {RECITERS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReciterId(r.id)}
                style={[
                  styles.reciterPill,
                  reciterId === r.id && styles.reciterPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.reciterPillText,
                    reciterId === r.id && styles.reciterPillTextSelected,
                  ]}
                >
                  {r.fullName.split(" ").slice(-1)[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.sheetDoneButton} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>

      <CelebrationOverlay
        show={confettiEnabled && celebration !== null}
        message={celebration?.message ?? ""}
        subMessage={celebration?.subMessage}
        onDone={() => setCelebration(null)}
      />

      <Modal
        visible={tappedWord !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTappedWord(null)}
      >
        <Pressable style={styles.wordTooltipBackdrop} onPress={() => setTappedWord(null)}>
          <Pressable onPress={() => {}} style={styles.wordTooltipCard}>
            <View style={styles.wordTooltipHeader}>
              <View style={styles.wordTooltipTitleBlock}>
                <Text style={styles.wordTooltipArabic}>{tappedWord?.arabic ?? ""}</Text>
                <Text style={styles.wordTooltipMeta}>
                  {tappedWord
                    ? `${tappedWord.surahNumber}:${tappedWord.ayahNumber} · word ${tappedWord.position}`
                    : ""}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play word audio"
                style={[
                  styles.wordTooltipAudioButton,
                  wordAudioLoadingKey === tappedWord?.key && styles.wordTooltipAudioButtonDisabled,
                ]}
                onPress={() => {
                  if (tappedWord) void playTappedWordAudio(tappedWord);
                }}
                disabled={wordAudioLoadingKey === tappedWord?.key}
              >
                {wordAudioLoadingKey === tappedWord?.key ? (
                  <ActivityIndicator size="small" color="#b45309" />
                ) : (
                  <Ionicons name="volume-high-outline" size={17} color="#b45309" />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close word tooltip"
                style={styles.wordTooltipCloseButton}
                onPress={() => setTappedWord(null)}
              >
                <Ionicons name="close" size={16} color="#9ca3af" />
              </Pressable>
            </View>
            <Text style={tappedWord?.translation ? styles.wordTooltipTranslation : styles.wordTooltipEmpty}>
              {tappedWord?.translation || "No translation available"}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={translationPopup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTranslationPopup(null)}
      >
        <Pressable style={styles.translationBackdrop} onPress={() => setTranslationPopup(null)}>
          <Pressable onPress={() => {}} style={styles.translationCard}>
            <Text style={styles.translationArabic}>{translationPopup?.arabic ?? ""}</Text>
            <Text style={styles.translationText}>{translationPopup?.translation ?? ""}</Text>
            <Pressable style={styles.translationCloseButton} onPress={() => setTranslationPopup(null)}>
              <Text style={styles.translationCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

type SetupSurahOption = {
  number: number;
  name: string;
  translation: string;
  arabic: string;
  verseCount: number;
};

function fallbackSetupSurahOption(
  surahNumber: number,
  chaptersMap: Map<number, ApiChapter>,
): SetupSurahOption {
  const mushafSurah = MUSHAF_SURAHS.find((item) => item.number === surahNumber);
  const chapter = chaptersMap.get(surahNumber);
  return {
    number: surahNumber,
    name: chapter?.name_simple ?? mushafSurah?.name ?? `Surah ${surahNumber}`,
    translation: mushafSurah?.translation ?? "",
    arabic: chapter?.name_arabic ?? "",
    verseCount: chapter?.verses_count ?? mushafSurah?.verseCount ?? 1,
  };
}

function MemorizationSetup({
  childId,
  name,
  target,
  surahs,
  chaptersMap,
  repeatCount,
  autoAdvance,
  cumulativeReview,
  reviewRepeatCount,
  onRepeatCountChange,
  onAutoAdvanceChange,
  onCumulativeReviewChange,
  onReviewRepeatCountChange,
  onCancel,
  onOpenSettings,
  onStart,
  onJustGetTested,
}: {
  childId: string | undefined;
  name: string | undefined;
  target: SessionTarget;
  surahs: SurahSummary[];
  chaptersMap: Map<number, ApiChapter>;
  repeatCount: number;
  autoAdvance: boolean;
  cumulativeReview: boolean;
  reviewRepeatCount: number;
  onRepeatCountChange: (value: number) => void;
  onAutoAdvanceChange: (value: boolean) => void;
  onCumulativeReviewChange: (value: boolean) => void;
  onReviewRepeatCountChange: (value: number) => void;
  onCancel: () => void;
  onOpenSettings: () => void;
  onStart: (target: SessionTarget) => void;
  onJustGetTested: (target: SessionTarget) => void;
}) {
  const [surahPickerOpen, setSurahPickerOpen] = useState(false);
  const [selectedSurahNumber, setSelectedSurahNumber] = useState(target.surahNumber);
  const [fromAyah, setFromAyah] = useState(target.ayahStart);
  const [toAyah, setToAyah] = useState(target.ayahEnd);
  const [fromInput, setFromInput] = useState(String(target.ayahStart));
  const [toInput, setToInput] = useState(String(target.ayahEnd));
  const rangeLocked = Boolean(target.isReviewOnly);

  const options = useMemo(() => {
    const source: SetupSurahOption[] =
      surahs.length > 0
        ? surahs.map((surah) => ({
            number: surah.number,
            name: surah.nameTransliteration,
            translation: surah.nameTranslation,
            arabic: surah.nameArabic,
            verseCount: surah.verseCount,
          }))
        : MUSHAF_SURAHS.map((surah) => ({
            number: surah.number,
            name: surah.name,
            translation: surah.translation,
            arabic: chaptersMap.get(surah.number)?.name_arabic ?? "",
            verseCount: surah.verseCount,
          }));

    const byNumber = new Map(source.map((surah) => [surah.number, surah]));
    if (!byNumber.has(target.surahNumber)) {
      byNumber.set(target.surahNumber, fallbackSetupSurahOption(target.surahNumber, chaptersMap));
    }
    return [...byNumber.values()].sort((a, b) => a.number - b.number);
  }, [chaptersMap, surahs, target.surahNumber]);

  const selectedSurah =
    options.find((surah) => surah.number === selectedSurahNumber) ??
    fallbackSetupSurahOption(selectedSurahNumber, chaptersMap);
  const maxAyah = Math.max(1, selectedSurah.verseCount);
  const selectedIndex = options.findIndex((surah) => surah.number === selectedSurahNumber);
  const previousSurah = selectedIndex > 0 ? options[selectedIndex - 1] : null;
  const nextSurah =
    selectedIndex >= 0 && selectedIndex < options.length - 1 ? options[selectedIndex + 1] : null;

  useEffect(() => {
    const option =
      options.find((surah) => surah.number === target.surahNumber) ??
      fallbackSetupSurahOption(target.surahNumber, chaptersMap);
    const nextFrom = clampNumber(target.ayahStart, 1, Math.max(1, option.verseCount));
    const nextTo = clampNumber(
      Math.max(target.ayahEnd, nextFrom),
      nextFrom,
      Math.max(1, option.verseCount),
    );

    setSelectedSurahNumber(target.surahNumber);
    setFromAyah(nextFrom);
    setToAyah(nextTo);
    setFromInput(String(nextFrom));
    setToInput(String(nextTo));
  }, [chaptersMap, options, target]);

  useEffect(() => {
    const boundedFrom = clampNumber(fromAyah, 1, maxAyah);
    const boundedTo = clampNumber(Math.max(toAyah, boundedFrom), boundedFrom, maxAyah);
    if (boundedFrom !== fromAyah) setFromAyah(boundedFrom);
    if (boundedTo !== toAyah) setToAyah(boundedTo);
  }, [fromAyah, maxAyah, toAyah]);

  useEffect(() => {
    setFromInput(String(fromAyah));
  }, [fromAyah]);

  useEffect(() => {
    setToInput(String(toAyah));
  }, [toAyah]);

  function commitFromInput() {
    const parsed = Number.parseInt(fromInput, 10);
    const nextFrom = clampNumber(Number.isNaN(parsed) ? fromAyah : parsed, 1, maxAyah);
    setFromAyah(nextFrom);
    if (nextFrom > toAyah) setToAyah(nextFrom);
  }

  function commitToInput() {
    const parsed = Number.parseInt(toInput, 10);
    const nextTo = clampNumber(Number.isNaN(parsed) ? toAyah : parsed, fromAyah, maxAyah);
    setToAyah(nextTo);
  }

  function selectSurah(surah: SetupSurahOption) {
    if (rangeLocked) return;
    setSelectedSurahNumber(surah.number);
    setFromAyah(1);
    setToAyah(Math.max(1, surah.verseCount));
    setFromInput("1");
    setToInput(String(Math.max(1, surah.verseCount)));
    setSurahPickerOpen(false);
  }

  function buildConfiguredTarget(): SessionTarget {
    const pages = estimatePageRange(selectedSurahNumber, fromAyah, toAyah);
    return {
      surahNumber: selectedSurahNumber,
      ayahStart: fromAyah,
      ayahEnd: toAyah,
      pageStart: pages.pageStart,
      pageEnd: pages.pageEnd,
      isReviewOnly: target.isReviewOnly,
    };
  }

  const totalAyahs = toAyah - fromAyah + 1;
  const pageRange = formatPageRange(
    buildConfiguredTarget().pageStart,
    buildConfiguredTarget().pageEnd,
  );
  const startLabel =
    fromAyah === toAyah ? `Start - Ayah ${fromAyah}` : `Start - Ayah ${fromAyah} to ${toAyah}`;

  return (
    <View style={styles.setupContainer}>
      <View style={styles.discoveryHeader}>
        <Pressable onPress={onCancel} style={styles.discoveryBackButton}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.discoveryHeaderText}>
          <Text style={styles.discoveryTitle}>Session Setup</Text>
          <Text style={styles.discoverySubtitle}>{name ? `${name}'s practice` : "Practice setup"}</Text>
        </View>
        <Pressable onPress={onOpenSettings} style={styles.discoveryHeaderAction}>
          <Text style={styles.discoveryHeaderActionText}>Defaults</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.setupScroll}
        contentContainerStyle={styles.setupContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.setupHero}>
          <View style={styles.setupHeroText}>
            <Text style={styles.setupKicker}>Surah {selectedSurah.number}</Text>
            <Text style={styles.setupTitle}>{selectedSurah.name}</Text>
            <Text style={styles.setupDetail}>
              {selectedSurah.translation} · {maxAyah} ayahs{pageRange ? ` · ${pageRange}` : ""}
            </Text>
          </View>
          {selectedSurah.arabic ? (
            <Text style={styles.setupArabic}>{selectedSurah.arabic}</Text>
          ) : null}
        </View>

        <View style={styles.setupNavRow}>
          <Pressable
            style={[styles.setupNavButton, (!previousSurah || rangeLocked) && styles.setupNavButtonDisabled]}
            onPress={() => {
              if (previousSurah) selectSurah(previousSurah);
            }}
            disabled={!previousSurah || rangeLocked}
          >
            <Text style={styles.setupNavButtonText}>‹</Text>
          </Pressable>
          <Pressable
            style={[styles.setupSelectButton, rangeLocked && styles.setupSelectButtonLocked]}
            onPress={() => {
              if (!rangeLocked) setSurahPickerOpen(true);
            }}
            disabled={rangeLocked}
          >
            <Text style={styles.setupSelectTitle} numberOfLines={1}>
              {selectedSurah.number}. {selectedSurah.name}
            </Text>
            <Text style={styles.setupSelectMeta} numberOfLines={1}>
              {rangeLocked ? "Review assignment locked" : "Change surah"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.setupNavButton, (!nextSurah || rangeLocked) && styles.setupNavButtonDisabled]}
            onPress={() => {
              if (nextSurah) selectSurah(nextSurah);
            }}
            disabled={!nextSurah || rangeLocked}
          >
            <Text style={styles.setupNavButtonText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.setupCard}>
          <View>
            <Text style={styles.setupCardTitle}>Ayah Range</Text>
            <Text style={styles.setupCardDetail}>
              {rangeLocked
                ? "Review-only work saves the assigned range together."
                : `${totalAyahs} ayah${totalAyahs === 1 ? "" : "s"} selected.`}
            </Text>
          </View>
          <View style={styles.setupRangeRow}>
            <View style={styles.setupInputBlock}>
              <Text style={styles.setupInputLabel}>From</Text>
              <View style={styles.setupStepperRow}>
                <Pressable
                  style={styles.setupMiniStepButton}
                  onPress={() => setFromAyah((value) => clampNumber(value - 1, 1, maxAyah))}
                  disabled={rangeLocked || fromAyah <= 1}
                >
                  <Text style={styles.stepperButtonText}>-</Text>
                </Pressable>
                <TextInput
                  value={fromInput}
                  onChangeText={setFromInput}
                  onEndEditing={commitFromInput}
                  onSubmitEditing={commitFromInput}
                  editable={!rangeLocked}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  style={[styles.setupInput, rangeLocked && styles.setupInputDisabled]}
                />
                <Pressable
                  style={styles.setupMiniStepButton}
                  onPress={() => {
                    const nextFrom = clampNumber(fromAyah + 1, 1, maxAyah);
                    setFromAyah(nextFrom);
                    if (nextFrom > toAyah) setToAyah(nextFrom);
                  }}
                  disabled={rangeLocked || fromAyah >= maxAyah}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.setupInputBlock}>
              <Text style={styles.setupInputLabel}>To</Text>
              <View style={styles.setupStepperRow}>
                <Pressable
                  style={styles.setupMiniStepButton}
                  onPress={() => setToAyah((value) => clampNumber(value - 1, fromAyah, maxAyah))}
                  disabled={rangeLocked || toAyah <= fromAyah}
                >
                  <Text style={styles.stepperButtonText}>-</Text>
                </Pressable>
                <TextInput
                  value={toInput}
                  onChangeText={setToInput}
                  onEndEditing={commitToInput}
                  onSubmitEditing={commitToInput}
                  editable={!rangeLocked}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  style={[styles.setupInput, rangeLocked && styles.setupInputDisabled]}
                />
                <Pressable
                  style={styles.setupMiniStepButton}
                  onPress={() => setToAyah((value) => clampNumber(value + 1, fromAyah, maxAyah))}
                  disabled={rangeLocked || toAyah >= maxAyah}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.setupCard}>
          <View style={styles.settingRow}>
            <View style={styles.setupSettingText}>
              <Text style={styles.setupCardTitle}>Repeat Each Ayah</Text>
              <Text style={styles.setupCardDetail}>Listening pass count</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => onRepeatCountChange(clampNumber(repeatCount - 1, 1, 10))}
              >
                <Text style={styles.stepperButtonText}>-</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{repeatCount}×</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => onRepeatCountChange(clampNumber(repeatCount + 1, 1, 10))}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.setupCard}>
          <View style={styles.settingRow}>
            <View style={styles.setupSettingText}>
              <Text style={styles.setupCardTitle}>Auto-Advance</Text>
              <Text style={styles.setupCardDetail}>Continue through the selected range</Text>
            </View>
            <Pressable
              onPress={() => onAutoAdvanceChange(!autoAdvance)}
              style={[styles.toggleSwitch, autoAdvance && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, autoAdvance && styles.toggleKnobOn]} />
            </Pressable>
          </View>
        </View>

        <View style={styles.setupCard}>
          <View style={styles.settingRow}>
            <View style={styles.setupSettingText}>
              <Text style={styles.setupCardTitle}>Cumulative Review</Text>
              <Text style={styles.setupCardDetail}>Replay from the start after each new ayah</Text>
            </View>
            <Pressable
              onPress={() => onCumulativeReviewChange(!cumulativeReview)}
              style={[styles.toggleSwitch, cumulativeReview && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, cumulativeReview && styles.toggleKnobOn]} />
            </Pressable>
          </View>
          {cumulativeReview ? (
            <View style={[styles.settingRow, styles.setupNestedSettingRow]}>
              <View style={styles.setupSettingText}>
                <Text style={styles.setupNestedTitle}>Review repeat count</Text>
                <Text style={styles.setupCardDetail}>Cumulative loop count</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() =>
                    onReviewRepeatCountChange(clampNumber(reviewRepeatCount - 1, 1, 10))
                  }
                >
                  <Text style={styles.stepperButtonText}>-</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{reviewRepeatCount}×</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() =>
                    onReviewRepeatCountChange(clampNumber(reviewRepeatCount + 1, 1, 10))
                  }
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.setupPrimaryButton} onPress={() => onStart(buildConfiguredTarget())}>
          <Text style={styles.setupPrimaryButtonText}>{startLabel}</Text>
        </Pressable>

        {target.isReviewOnly ? (
          <Pressable
            style={styles.setupSecondaryButton}
            onPress={() => onJustGetTested(buildConfiguredTarget())}
          >
            <Text style={styles.setupSecondaryButtonText}>Just Get Tested</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ChildBottomNav active="memorization" childId={childId} name={name ?? ""} />

      <Modal
        visible={surahPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSurahPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSurahPickerOpen(false)} />
        <View style={styles.setupPickerSheet}>
          <Text style={styles.sheetTitle}>Choose Surah</Text>
          <ScrollView style={styles.setupPickerList} contentContainerStyle={styles.setupPickerContent}>
            {options.map((surah) => {
              const selected = surah.number === selectedSurahNumber;
              return (
                <Pressable
                  key={surah.number}
                  style={[styles.setupPickerRow, selected && styles.setupPickerRowSelected]}
                  onPress={() => selectSurah(surah)}
                >
                  <Text style={styles.setupPickerNumber}>{surah.number}</Text>
                  <View style={styles.setupPickerText}>
                    <Text style={styles.setupPickerTitle}>{surah.name}</Text>
                    <Text style={styles.setupPickerDetail}>
                      {surah.translation} · {surah.verseCount} ayahs
                    </Text>
                  </View>
                  {surah.arabic ? <Text style={styles.setupPickerArabic}>{surah.arabic}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MemorizationDiscovery({
  childId,
  name,
  state,
  sessionBookmark,
  query,
  filter,
  refreshing,
  onQueryChange,
  onFilterChange,
  onRefresh,
  onRetry,
  onBack,
  onOpenSettings,
  onStart,
  onStartDirect,
  onStartBookmark,
}: {
  childId: string | undefined;
  name: string | undefined;
  state: DiscoveryState;
  sessionBookmark: MemorizationSessionBookmark | null;
  query: string;
  filter: DiscoveryFilter;
  refreshing: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: DiscoveryFilter) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onBack: () => void;
  onOpenSettings: () => void;
  onStart: (target: SessionTarget) => void;
  onStartDirect: (target: SessionTarget) => void;
  onStartBookmark: (bookmark: MemorizationSessionBookmark) => void;
}) {
  const childName = state.status === "ready" ? state.dashboard.child?.name ?? name : name;

  const content = useMemo(() => {
    if (state.status !== "ready") return null;

    const progressByNumber = new Map(state.progress.map((item) => [item.surahNumber, item]));
    const todayWork = state.dashboard.todaysPlan.newMemorization;
    const upNext = state.dashboard.upNextMemorization;
    const currentSurahNumber = todayWork?.currentWorkSurahNumber ?? todayWork?.surahNumber ?? null;
    const currentNumbers = new Set<number>();
    if (currentSurahNumber !== null) currentNumbers.add(currentSurahNumber);
    for (const item of state.progress) {
      if (item.status === "in_progress") currentNumbers.add(item.surahNumber);
    }

    const normalizedQuery = normalizeSearch(query);
    const rows = state.surahs
      .map((surah) => ({
        surah,
        progress: progressByNumber.get(surah.number) ?? {
          id: 0,
          childId: Number(childId ?? 0),
          surahId: surah.id,
          surahName: surah.nameTransliteration,
          surahNumber: surah.number,
          status: "not_started" as MemorizationStatus,
          versesMemorized: 0,
          memorizedAyahs: [],
          totalVerses: surah.verseCount,
          percentComplete: 0,
          reviewCount: 0,
          strength: 1,
          ayahStrengths: {},
        },
      }))
      .filter(({ surah, progress }) => {
        if (normalizedQuery) {
          const haystack = normalizeSearch(
            `${surah.number} ${surah.nameTransliteration} ${surah.nameTranslation} ${surah.nameArabic}`,
          );
          if (!haystack.includes(normalizedQuery)) return false;
        }
        if (filter === "all") return true;
        if (filter === "current") return currentNumbers.has(surah.number);
        return progress.status === filter;
      });

    const resumeItems = state.progress
      .filter((item) => item.status === "in_progress" && item.percentComplete < 100)
      .filter((item) => item.surahNumber !== currentSurahNumber)
      .slice(0, 3);
    const reviewCheckShortcut = todayWork?.isReviewOnly
      ? { label: "Today's review", work: todayWork }
      : upNext?.isReviewOnly
        ? { label: "Next review", work: upNext }
        : null;

    return {
      progressByNumber,
      todayWork,
      upNext,
      todayStatus: state.dashboard.todayProgress?.memStatus ?? "not_started",
      stats: scoreProgress(state.progress),
      rows,
      resumeItems,
      reviewCheckShortcut,
    };
  }, [childId, filter, query, state]);

  function startProgress(progress: MemorizationProgress) {
    if (content?.todayWork) {
      const workSurah = content.todayWork.currentWorkSurahNumber ?? content.todayWork.surahNumber;
      if (workSurah === progress.surahNumber) {
        onStart(buildWorkTarget(content.todayWork));
        return;
      }
    }
    onStart(buildProgressTarget(progress));
  }

  function startReviewCheck(work: NewMemorization) {
    onStartDirect({
      ...buildFullWorkTarget(work),
      startInRecitationCheck: true,
    });
  }

  return (
    <View style={styles.discoveryContainer}>
      <View style={styles.discoveryHeader}>
        <Pressable onPress={onBack} style={styles.discoveryBackButton}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.discoveryHeaderText}>
          <Text style={styles.discoveryTitle}>Memorization</Text>
          <Text style={styles.discoverySubtitle}>{childName ? `${childName}'s hifz work` : "Hifz work"}</Text>
        </View>
        <Pressable onPress={onOpenSettings} style={styles.discoveryHeaderAction}>
          <Text style={styles.discoveryHeaderActionText}>Defaults</Text>
        </Pressable>
      </View>

      {state.status === "loading" ? (
        <View style={styles.discoveryBodyCenter}>
          <ActivityIndicator color="#2563eb" size="large" />
          <Text style={styles.discoveryMuted}>Loading memorization...</Text>
        </View>
      ) : state.status === "error" ? (
        <View style={styles.discoveryBodyCenter}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable style={styles.discoveryPrimaryButton} onPress={onRetry}>
            <Text style={styles.discoveryPrimaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : content ? (
        <ScrollView
          style={styles.discoveryScroll}
          contentContainerStyle={styles.discoveryContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
          }
        >
          <View style={styles.discoverySummary}>
            <View>
              <Text style={styles.discoveryKicker}>Progress</Text>
              <Text style={styles.discoverySummaryTitle}>
                {content.stats.memorized} memorized · {content.stats.learning} learning
              </Text>
              {content.stats.average !== null ? (
                <Text style={styles.discoverySummaryDetail}>
                  Average strength {content.stats.average}/5
                </Text>
              ) : null}
            </View>
            {content.stats.average !== null ? (
              <StrengthDots strength={content.stats.average} />
            ) : null}
          </View>

          <View style={styles.discoverySectionHeader}>
            <Text style={styles.discoverySectionTitle}>Today</Text>
          </View>
          <MemorizationOverviewCards
            todayWork={content.todayWork}
            upNext={content.upNext}
            todayStatus={content.todayStatus}
            todayProgress={state.dashboard.todayProgress}
            onStart={onStart}
          />
          {content.reviewCheckShortcut ? (
            <JustGetTestedShortcut
              label={content.reviewCheckShortcut.label}
              work={content.reviewCheckShortcut.work}
              onPress={() => startReviewCheck(content.reviewCheckShortcut!.work)}
            />
          ) : null}

          {sessionBookmark ? (
            <SessionBookmarkCard
              bookmark={sessionBookmark}
              onPress={() => onStartBookmark(sessionBookmark)}
            />
          ) : null}

          {content.resumeItems.length > 0 && (
            <>
              <View style={styles.discoverySectionHeader}>
                <Text style={styles.discoverySectionTitle}>Resume</Text>
              </View>
              <View style={styles.discoveryCardList}>
                {content.resumeItems.map((item) => (
                  <ResumeWorkCard key={item.surahNumber} progress={item} onPress={() => startProgress(item)} />
                ))}
              </View>
            </>
          )}

          <View style={styles.discoverySectionHeader}>
            <Text style={styles.discoverySectionTitle}>Surahs</Text>
            <Text style={styles.discoverySectionMeta}>{content.rows.length} shown</Text>
          </View>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search surah name or number"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
            style={styles.discoverySearch}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.discoveryFilterRow}
          >
            {DISCOVERY_FILTERS.map((item) => {
              const selected = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.discoveryFilterPill, selected && styles.discoveryFilterPillSelected]}
                  onPress={() => onFilterChange(item.key)}
                >
                  <Text
                    style={[
                      styles.discoveryFilterText,
                      selected && styles.discoveryFilterTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.discoveryCardList}>
            {content.rows.length === 0 ? (
              <View style={styles.discoveryEmptyCard}>
                <Text style={styles.discoveryEmptyTitle}>No surahs match that search.</Text>
                <Text style={styles.discoveryEmptyDetail}>Try a name, number, or a different filter.</Text>
              </View>
            ) : (
              content.rows.map(({ surah, progress }) => (
                <SurahProgressRow
                  key={surah.number}
                  surah={surah}
                  progress={progress}
                  isCurrent={
                    (content.todayWork?.currentWorkSurahNumber ?? content.todayWork?.surahNumber) ===
                    surah.number
                  }
                  onPress={() => startProgress(progress)}
                />
              ))
            )}
          </View>
        </ScrollView>
      ) : null}

      <ChildBottomNav active="memorization" childId={childId} name={childName ?? ""} />
    </View>
  );
}

type OverviewCardTone = "today" | "todayDone" | "current" | "next" | "empty";

const OVERVIEW_CARD_TONES: Record<
  OverviewCardTone,
  { bg: string; border: string; accent: string; actionBg: string; actionBorder: string }
> = {
  today: {
    bg: "#f8fbff",
    border: "#bfdbfe",
    accent: "#2563eb",
    actionBg: "#dbeafe",
    actionBorder: "#bfdbfe",
  },
  todayDone: {
    bg: "#ecfdf5",
    border: "#a7f3d0",
    accent: "#047857",
    actionBg: "#d1fae5",
    actionBorder: "#a7f3d0",
  },
  current: {
    bg: "#fffbeb",
    border: "#fde68a",
    accent: "#b45309",
    actionBg: "#fef3c7",
    actionBorder: "#fde68a",
  },
  next: {
    bg: "#f9fafb",
    border: "#e5e7eb",
    accent: "#4b5563",
    actionBg: "#f3f4f6",
    actionBorder: "#d1d5db",
  },
  empty: {
    bg: "#f9fafb",
    border: "#e5e7eb",
    accent: "#6b7280",
    actionBg: "#ffffff",
    actionBorder: "#e5e7eb",
  },
};

function getTodayStatusLabel(status: WorkStatus) {
  if (status === "completed") return "Complete";
  if (status === "in_progress") return "In progress";
  return "Ready";
}

function getTodayActionLabel(status: WorkStatus) {
  if (status === "completed") return "Done";
  if (status === "in_progress") return "Continue";
  return "Start";
}

function getCurrentWorkStatus(
  todayWork: NewMemorization | null,
  todayProgress: TodayProgress | undefined,
): WorkStatus {
  if (!todayWork) return "not_started";
  if (todayProgress?.memStatus === "completed") return "completed";

  if (todayProgress?.memStatus === "in_progress") return "in_progress";
  return "not_started";
}

function getWorkRangeDetail(work: NewMemorization, mode: "full" | "current") {
  const ayahStart = mode === "current" ? work.currentWorkAyahStart ?? work.ayahStart : work.ayahStart;
  const ayahEnd = mode === "current" ? work.currentWorkAyahEnd ?? work.ayahEnd : work.ayahEnd;
  const pageRange = formatPageRange(work.pageStart, work.pageEnd);
  return `${work.workLabel ?? "Memorization"} · ${formatAyahRange(ayahStart, ayahEnd)}${
    pageRange ? ` · ${pageRange}` : ""
  }`;
}

function MemorizationOverviewCards({
  todayWork,
  upNext,
  todayStatus,
  todayProgress,
  onStart,
}: {
  todayWork: NewMemorization | null;
  upNext: NewMemorization | null | undefined;
  todayStatus: WorkStatus;
  todayProgress: TodayProgress | undefined;
  onStart: (target: SessionTarget) => void;
}) {
  const todayTone: OverviewCardTone = todayWork
    ? todayStatus === "completed"
      ? "todayDone"
      : "today"
    : "empty";
  const currentTitle = todayWork?.isReviewOnly ? "Recitation Focus" : "Current work";
  const currentStatus = getCurrentWorkStatus(todayWork, todayProgress);
  const currentStatusLabel = todayWork
    ? currentStatus === "completed"
      ? "Complete"
      : todayWork.isReviewOnly
      ? "Review-only"
      : currentStatus === "in_progress"
      ? "In progress"
      : "Active range"
    : "Idle";
  const currentActionLabel = todayWork
    ? currentStatus === "completed"
      ? "Done"
      : todayWork.isReviewOnly
      ? "Recite"
      : currentStatus === "in_progress"
      ? "Continue"
      : "Start"
    : "Browse below";
  const todayDisabled = !todayWork || todayStatus === "completed";
  const currentDisabled = !todayWork || currentStatus === "completed";

  return (
    <View style={styles.overviewGrid}>
      <OverviewWorkCard
        title="Today's work"
        heading={todayWork?.surahName ?? "No assignment"}
        detail={
          todayWork
            ? getWorkRangeDetail(todayWork, "full")
            : "Search below to choose a surah."
        }
        status={todayWork ? getTodayStatusLabel(todayStatus) : "Not scheduled"}
        action={todayWork ? getTodayActionLabel(todayStatus) : "Browse below"}
        tone={todayTone}
        disabled={todayDisabled}
        onPress={() => {
          if (todayWork) onStart(buildFullWorkTarget(todayWork));
        }}
      />
      <OverviewWorkCard
        title={currentTitle}
        heading={todayWork?.currentWorkSurahName ?? todayWork?.surahName ?? "Nothing active"}
        detail={
          todayWork
            ? getWorkRangeDetail(todayWork, "current")
            : "Start from today's work or the list below."
        }
        status={currentStatusLabel}
        action={currentActionLabel}
        tone={todayWork ? (currentStatus === "completed" ? "todayDone" : "current") : "empty"}
        disabled={currentDisabled}
        onPress={() => {
          if (todayWork) onStart(buildWorkTarget(todayWork));
        }}
      />
      <OverviewWorkCard
        title="Next up"
        heading={upNext?.surahName ?? "All done"}
        detail={
          upNext
            ? getWorkRangeDetail(upNext, "full")
            : "No next assignment is queued yet."
        }
        status={upNext?.isReviewOnly ? "Recitation" : upNext ? "Tomorrow" : "Clear"}
        action={upNext ? (upNext.isReviewOnly ? "Recite" : "Start") : "Clear"}
        tone={upNext ? "next" : "empty"}
        disabled={!upNext}
        onPress={() => {
          if (upNext) onStart(buildFullWorkTarget(upNext));
        }}
      />
    </View>
  );
}

function JustGetTestedShortcut({
  label,
  work,
  onPress,
}: {
  label: string;
  work: NewMemorization;
  onPress: () => void;
}) {
  const pageRange = formatPageRange(work.pageStart, work.pageEnd);

  return (
    <View style={styles.reviewShortcutCard}>
      <View style={styles.reviewShortcutText}>
        <Text style={styles.reviewShortcutKicker} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.reviewShortcutTitle} numberOfLines={1}>
          Just Get Tested
        </Text>
        <Text style={styles.reviewShortcutDetail} numberOfLines={2}>
          {work.surahName} · {formatAyahRange(work.ayahStart, work.ayahEnd)}
          {pageRange ? ` · ${pageRange}` : ""}
        </Text>
      </View>
      <Pressable style={styles.reviewShortcutButton} onPress={onPress}>
        <Text style={styles.reviewShortcutButtonText} numberOfLines={1}>
          Start Check
        </Text>
      </Pressable>
    </View>
  );
}

function OverviewWorkCard({
  title,
  heading,
  detail,
  status,
  action,
  tone,
  disabled,
  onPress,
}: {
  title: string;
  heading: string;
  detail: string;
  status: string;
  action: string;
  tone: OverviewCardTone;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = OVERVIEW_CARD_TONES[tone];

  return (
    <Pressable
      style={[
        styles.overviewCard,
        { backgroundColor: colors.bg, borderColor: colors.border },
        disabled ? styles.overviewCardDisabled : null,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.overviewCardKicker, { color: colors.accent }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.overviewCardTitle} numberOfLines={2}>
        {heading}
      </Text>
      <Text style={styles.overviewCardDetail} numberOfLines={3}>
        {detail}
      </Text>
      <Text style={[styles.overviewCardStatus, { color: colors.accent }]} numberOfLines={1}>
        {status}
      </Text>
      <View
        style={[
          styles.overviewActionPill,
          { backgroundColor: colors.actionBg, borderColor: colors.actionBorder },
        ]}
      >
        <Text style={[styles.overviewActionText, { color: colors.accent }]} numberOfLines={1}>
          {action}
        </Text>
      </View>
    </Pressable>
  );
}

function formatBookmarkSavedAt(savedAt: number) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "Saved recently";
  return `Saved ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function SessionBookmarkCard({
  bookmark,
  onPress,
}: {
  bookmark: MemorizationSessionBookmark;
  onPress: () => void;
}) {
  const title = bookmark.surahName ?? `Surah ${bookmark.surahNumber}`;
  return (
    <Pressable style={styles.discoverySavedSessionCard} onPress={onPress}>
      <View style={styles.discoveryResumeText}>
        <Text style={styles.discoverySavedSessionKicker}>Resume where you left off</Text>
        <Text style={styles.discoveryResumeTitle}>{title}</Text>
        <Text style={styles.discoveryResumeDetail}>
          Ayah {bookmark.currentAyah} · Range {bookmark.fromAyah}-{bookmark.toAyah} ·{" "}
          {bookmark.repeatCount}x
        </Text>
        <Text style={styles.discoverySavedSessionMeta}>{formatBookmarkSavedAt(bookmark.savedAt)}</Text>
      </View>
      <Text style={styles.discoveryResumeAction}>Resume</Text>
    </Pressable>
  );
}

function ResumeWorkCard({
  progress,
  onPress,
}: {
  progress: MemorizationProgress;
  onPress: () => void;
}) {
  const nextAyah = firstUnmemorizedAyah(progress);
  return (
    <Pressable style={styles.discoveryResumeCard} onPress={onPress}>
      <View style={styles.discoveryResumeText}>
        <Text style={styles.discoveryResumeTitle}>{progress.surahName}</Text>
        <Text style={styles.discoveryResumeDetail}>
          Resume at Ayah {nextAyah} · {progress.versesMemorized}/{progress.totalVerses} memorized
        </Text>
      </View>
      <Text style={styles.discoveryResumeAction}>Resume</Text>
    </Pressable>
  );
}

function SurahProgressRow({
  surah,
  progress,
  isCurrent,
  onPress,
}: {
  surah: SurahSummary;
  progress: MemorizationProgress;
  isCurrent: boolean;
  onPress: () => void;
}) {
  const [showTajweedNotes, setShowTajweedNotes] = useState(false);
  const status = getStatusCopy(progress.status);
  const percent = Math.max(0, Math.min(100, progress.percentComplete));
  const reviewTone = getReviewStrengthTone(progress);
  const toneMeta = reviewTone ? REVIEW_TONE_META[reviewTone] : null;
  const tajweedNotes = (surah.tajweedNotes ?? []).filter((note) => note.trim().length > 0);
  const actionLabel =
    progress.status === "memorized" ? "Practice" : progress.status === "in_progress" ? "Resume" : "Start";

  return (
    <View
      style={[
        styles.surahRow,
        isCurrent && styles.surahRowCurrent,
        toneMeta && { borderColor: toneMeta.border },
      ]}
    >
      {toneMeta ? <View style={[styles.surahToneRail, { backgroundColor: toneMeta.color }]} /> : null}
      <Pressable style={styles.surahRowPressArea} onPress={onPress}>
        <View style={styles.surahRowTop}>
          <View style={styles.surahNumber}>
            <Text style={styles.surahNumberText}>{surah.number}</Text>
          </View>
          <View style={styles.surahTitleBlock}>
            <View style={styles.surahTitleLine}>
              <Text style={styles.surahTitle}>{surah.nameTransliteration}</Text>
              {isCurrent ? <Text style={styles.currentPill}>Current</Text> : null}
            </View>
            <Text style={styles.surahSubtitle}>
              {surah.nameTranslation} · {surah.verseCount} ayahs · Juz {surah.juzStart}
            </Text>
          </View>
          <Text style={styles.surahArabic}>{surah.nameArabic}</Text>
        </View>

        <View style={styles.surahProgressLine}>
          <View style={styles.surahProgressTrack}>
            <View
              style={[
                styles.surahProgressFill,
                { width: `${percent}%`, backgroundColor: toneMeta?.color ?? "#2563eb" },
              ]}
            />
          </View>
          <Text style={styles.surahProgressText}>{percent}%</Text>
        </View>

        <View style={styles.surahMetaRow}>
          <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
            <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
          </View>
          {toneMeta ? (
            <View style={[styles.reviewTonePill, { backgroundColor: toneMeta.bg, borderColor: toneMeta.border }]}>
              <View style={[styles.reviewToneDot, { backgroundColor: toneMeta.color }]} />
              <Text style={[styles.reviewToneText, { color: toneMeta.color }]}>{toneMeta.label}</Text>
            </View>
          ) : null}
          <Text style={styles.surahMetaText}>
            {progress.versesMemorized}/{progress.totalVerses} ayahs
          </Text>
          <Text style={styles.surahMetaText}>{getStrengthLabel(progress.strength)}</Text>
          <StrengthDots strength={progress.strength} />
        </View>

        <AyahStrengthStrip progress={progress} />

        <View style={styles.surahActionRow}>
          <Text style={styles.surahNextText}>
            {progress.status === "memorized"
              ? "Ready for a practice pass"
              : `Next: ${formatAyahRange(
                  buildProgressTarget(progress).ayahStart,
                  buildProgressTarget(progress).ayahEnd,
                )}`}
          </Text>
          <Text style={styles.surahActionText}>{actionLabel}</Text>
        </View>
      </Pressable>

      {tajweedNotes.length > 0 ? (
        <View style={styles.tajweedAccordion}>
          <Pressable
            style={styles.tajweedToggle}
            onPress={() => setShowTajweedNotes((value) => !value)}
          >
            <View style={styles.tajweedToggleTitle}>
              <Ionicons name="information-circle-outline" size={15} color="#b45309" />
              <Text style={styles.tajweedToggleText}>Tajweed Notes</Text>
            </View>
            <Ionicons
              name={showTajweedNotes ? "chevron-up" : "chevron-down"}
              size={16}
              color="#b45309"
            />
          </Pressable>
          {showTajweedNotes ? (
            <View style={styles.tajweedNotesList}>
              {tajweedNotes.map((note, index) => (
                <View key={`${surah.number}-tajweed-${index}`} style={styles.tajweedNoteRow}>
                  <Text style={styles.tajweedBullet}>•</Text>
                  <Text style={styles.tajweedNoteText}>{note}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function StrengthDots({ strength }: { strength: number | undefined | null }) {
  const value = clampStrength(strength);
  return (
    <View style={styles.strengthDots}>
      {Array.from({ length: 5 }, (_, index) => (
        <View
          key={index}
          style={[
            styles.strengthDot,
            index < value ? styles.strengthDotFilled : styles.strengthDotEmpty,
          ]}
        />
      ))}
    </View>
  );
}

function AyahStrengthStrip({ progress }: { progress: MemorizationProgress }) {
  const total = Math.max(1, progress.totalVerses);
  const count = Math.min(20, total);
  const memorized = new Set(progress.memorizedAyahs ?? []);

  return (
    <View style={styles.ayahStrip}>
      {Array.from({ length: count }, (_, index) => {
        const ayah = Math.min(total, Math.max(1, Math.round(((index + 1) / count) * total)));
        const rawStrength = progress.ayahStrengths?.[String(ayah)];
        const fallback = memorized.has(ayah) || ayah <= progress.versesMemorized ? progress.strength : 0;
        const strength = rawStrength ?? fallback;
        return <View key={`${progress.surahNumber}-${ayah}-${index}`} style={[styles.ayahSegment, getAyahSegmentStyle(strength)]} />;
      })}
    </View>
  );
}

function getAyahSegmentStyle(strength: number) {
  if (strength >= 5) return styles.ayahStrong;
  if (strength >= 4) return styles.ayahSolid;
  if (strength >= 3) return styles.ayahLearning;
  if (strength > 0) return styles.ayahWeak;
  return styles.ayahEmpty;
}

// ── Themed styles factory ────────────────────────────────────────────────────
// Called from useMemo inside the component; defined at module scope so the
// StyleSheet.create call is not recreated on every render.

function makeThemedStyles(theme: MushafTheme) {
  return StyleSheet.create({
    pageCard: {
      width: "100%",
      backgroundColor: theme.page,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.pageBorder,
      overflow: "hidden",
    },
    pageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.pageBorder,
    },
    pageHeaderNames: {
      flex: 1,
      fontFamily: "AmiriQuran",
      fontSize: 13,
      color: theme.pageLabel,
    },
    pageHeaderJuz: {
      fontSize: 11,
      color: theme.pageLabel,
      letterSpacing: 2,
      fontWeight: "600",
      marginLeft: 8,
    },
    pageFooter: {
      borderTopWidth: 1,
      borderTopColor: theme.pageBorder,
      paddingVertical: 6,
      alignItems: "center",
    },
    pageFooterText: {
      fontSize: 11,
      color: theme.pageLabel,
      letterSpacing: 3,
    },
    surahBannerRule: {
      flex: 1,
      height: 1,
      backgroundColor: theme.pageRule,
    },
    surahBannerText: {
      fontFamily: "AmiriQuran",
      fontSize: 18,
      color: theme.pageLabel,
      fontWeight: "600",
    },
    mushafWord: {
      fontFamily: "AmiriQuran",
      fontSize: 20,
      lineHeight: 38,
      color: theme.pageText,
      marginHorizontal: 1,
    },
    mushafEndMarker: {
      fontFamily: "AmiriQuran",
      fontSize: 16,
      lineHeight: 38,
      color: theme.pageText,
      marginHorizontal: 4,
    },
    mushafWordDimmed: {
      color: theme.pageMuted,
    },
    mushafWordHighlighted: {
      backgroundColor: theme.activeHighlight,
      borderRadius: 3,
      paddingHorizontal: 2,
    },
  });
}

// ── Static styles (no theme references) ─────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  discoveryContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  discoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  discoveryBackButton: {
    width: 70,
  },
  discoveryHeaderText: {
    flex: 1,
    alignItems: "center",
  },
  discoveryHeaderSpacer: {
    width: 70,
  },
  discoveryHeaderAction: {
    width: 70,
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  discoveryHeaderActionText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "800",
  },
  discoveryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  discoverySubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  discoveryBodyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  discoveryMuted: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  setupContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  setupScroll: {
    flex: 1,
  },
  setupContent: {
    padding: 16,
    paddingBottom: 112,
    gap: 12,
  },
  setupHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
    padding: 16,
  },
  setupHeroText: {
    flex: 1,
    minWidth: 0,
  },
  setupKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  setupTitle: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    color: "#111827",
  },
  setupDetail: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: "#4b5563",
  },
  setupArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 32,
    lineHeight: 46,
    color: "#1d4ed8",
  },
  setupNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  setupNavButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d4ed8",
  },
  setupNavButtonDisabled: {
    opacity: 0.35,
  },
  setupNavButtonText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#ffffff",
  },
  setupSelectButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  setupSelectButtonLocked: {
    backgroundColor: "#f9fafb",
  },
  setupSelectTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },
  setupSelectMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
    color: "#6b7280",
  },
  setupCard: {
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  setupCardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  setupCardDetail: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "#6b7280",
  },
  setupRangeRow: {
    flexDirection: "row",
    gap: 12,
  },
  setupInputBlock: {
    flex: 1,
    gap: 6,
  },
  setupInputLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#4b5563",
    textTransform: "uppercase",
  },
  setupStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  setupMiniStepButton: {
    width: 34,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  setupInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    paddingHorizontal: 8,
  },
  setupInputDisabled: {
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    color: "#6b7280",
  },
  setupSettingText: {
    flex: 1,
    minWidth: 0,
  },
  setupNestedSettingRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  setupNestedTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  setupPrimaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  setupPrimaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
  },
  setupSecondaryButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  setupSecondaryButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#4f46e5",
  },
  setupPickerSheet: {
    maxHeight: "78%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 34,
    gap: 12,
  },
  setupPickerList: {
    maxHeight: 430,
  },
  setupPickerContent: {
    gap: 8,
    paddingBottom: 4,
  },
  setupPickerRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  setupPickerRowSelected: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  setupPickerNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
    textAlign: "center",
    lineHeight: 34,
    fontSize: 12,
    fontWeight: "900",
    color: "#111827",
  },
  setupPickerText: {
    flex: 1,
    minWidth: 0,
  },
  setupPickerTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },
  setupPickerDetail: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  setupPickerArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    color: "#111827",
  },
  discoveryScroll: {
    flex: 1,
  },
  discoveryContent: {
    padding: 16,
    paddingBottom: 112,
    gap: 14,
  },
  discoverySummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  discoveryKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  discoverySummaryTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  discoverySummaryDetail: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  overviewGrid: {
    flexDirection: "row",
    gap: 8,
  },
  overviewCard: {
    flex: 1,
    minHeight: 154,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.025,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  overviewCardDisabled: {
    opacity: 0.72,
  },
  overviewCardKicker: {
    fontSize: 10,
    fontWeight: "900",
  },
  overviewCardTitle: {
    marginTop: 6,
    minHeight: 34,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#111827",
  },
  overviewCardDetail: {
    marginTop: 4,
    minHeight: 48,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    color: "#4b5563",
  },
  overviewCardStatus: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: "900",
  },
  overviewActionPill: {
    marginTop: "auto",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  overviewActionText: {
    fontSize: 10,
    fontWeight: "900",
  },
  reviewShortcutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    padding: 14,
  },
  reviewShortcutText: {
    flex: 1,
    minWidth: 0,
  },
  reviewShortcutKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#4f46e5",
    textTransform: "uppercase",
  },
  reviewShortcutTitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },
  reviewShortcutDetail: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: "#4b5563",
  },
  reviewShortcutButton: {
    minWidth: 104,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 14,
  },
  reviewShortcutButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
  },
  discoverySectionHeader: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  discoverySectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  discoverySectionMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  discoveryFeaturedCard: {
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 16,
  },
  discoveryFeaturedTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  discoveryFeaturedTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  discoveryFeaturedDetail: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: "#374151",
  },
  discoveryNumberBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  discoveryNumberText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2563eb",
  },
  discoveryPrimaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#2563eb",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  discoveryPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  discoveryEmptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  discoveryEmptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  discoveryEmptyDetail: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#6b7280",
  },
  discoveryCardList: {
    gap: 10,
  },
  discoveryResumeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    padding: 14,
  },
  discoverySavedSessionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fbbf24",
    backgroundColor: "#fffbeb",
    padding: 14,
  },
  discoveryResumeText: {
    flex: 1,
  },
  discoverySavedSessionKicker: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "900",
    color: "#b45309",
  },
  discoveryResumeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  discoveryResumeDetail: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  discoverySavedSessionMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },
  discoveryResumeAction: {
    fontSize: 13,
    fontWeight: "800",
    color: "#b45309",
  },
  discoverySearch: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
  },
  discoveryFilterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  discoveryFilterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  discoveryFilterPillSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  discoveryFilterText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4b5563",
  },
  discoveryFilterTextSelected: {
    color: "#ffffff",
  },
  surahRow: {
    position: "relative",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  surahRowPressArea: {
    gap: 10,
  },
  surahToneRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  surahRowCurrent: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  surahRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  surahNumber: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  surahNumberText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  surahTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  surahTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  surahTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  currentPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "900",
    color: "#2563eb",
  },
  surahSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  surahArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 22,
    color: "#111827",
  },
  surahProgressLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  surahProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  surahProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  surahProgressText: {
    width: 38,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
  },
  surahMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  reviewTonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reviewToneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  reviewToneText: {
    fontSize: 11,
    fontWeight: "900",
  },
  surahMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
  },
  strengthDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  strengthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  strengthDotFilled: {
    backgroundColor: "#0f766e",
  },
  strengthDotEmpty: {
    backgroundColor: "#d1d5db",
  },
  ayahStrip: {
    flexDirection: "row",
    gap: 2,
  },
  ayahSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  ayahStrong: {
    backgroundColor: "#059669",
  },
  ayahSolid: {
    backgroundColor: "#10b981",
  },
  ayahLearning: {
    backgroundColor: "#f59e0b",
  },
  ayahWeak: {
    backgroundColor: "#f97316",
  },
  ayahEmpty: {
    backgroundColor: "#e5e7eb",
  },
  surahActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  surahNextText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  surahActionText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2563eb",
  },
  tajweedAccordion: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    overflow: "hidden",
  },
  tajweedToggle: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tajweedToggleTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  tajweedToggleText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#92400e",
  },
  tajweedNotesList: {
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#fde68a",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tajweedNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  tajweedBullet: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#b45309",
  },
  tajweedNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    color: "#78350f",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  back: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "800",
    width: 60,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  headerButton: {
    width: 60,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerButtonIcon: {
    fontSize: 22,
    color: "#2563eb",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  togglePill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  togglePillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  togglePillText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  togglePillTextSelected: {
    color: "#ffffff",
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
    gap: 18,
    paddingBottom: 16,
  },
  // ── Ayah-by-Ayah card ────────────────────────────────────────────────────────
  verseCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    minHeight: 160,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  wordContainer: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  wordWrapper: {
    position: "relative",
    overflow: "visible",
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginHorizontal: 2,
    marginVertical: 4,
    borderRadius: 4,
  },
  wordHighlighted: {
    backgroundColor: "#dbeafe",
  },
  reciteWordCurrent: {
    backgroundColor: "#ecfdf5",
  },
  reciteWordPending: {},
  wordBlurSoftText: {
    color: "transparent",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  wordBlurStrongText: {
    color: "transparent",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  arabicWord: {
    fontFamily: "AmiriQuran",
    fontSize: 32,
    lineHeight: 60,
    color: "#111111",
  },
  ayahEndMarkerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#b8974a",
    backgroundColor: "#fdf8ee",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    marginVertical: 16,
  },
  ayahEndMarkerButtonDisabled: {
    opacity: 0.45,
  },
  ayahEndMarkerButtonPressed: {
    opacity: 0.7,
  },
  ayahEndMarkerText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: "#8a6020",
  },
  // ── Parchment Mushaf page card (static parts) ────────────────────────────────
  pageBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // ── Surah banner (static parts) ─────────────────────────────────────────────
  surahBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  surahBannerLabel: {
    paddingHorizontal: 12,
  },
  // ── Mushaf line words (static parts) ────────────────────────────────────────
  mushafLine: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  mushafWordPressable: {
    position: "relative",
    overflow: "visible",
    borderRadius: 4,
  },
  reciteMushafWordCurrent: {
    backgroundColor: "#ecfdf5",
  },
  reciteMushafWordPending: {},
  mushafEndMarkerPressable: {
    minWidth: 30,
    minHeight: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  mushafEndMarkerInteractive: {
    borderWidth: 1,
    borderColor: "#d6b465",
    backgroundColor: "rgba(253, 248, 238, 0.62)",
  },
  mushafEndMarkerPressed: {
    opacity: 0.7,
  },
  mushafEndMarkerDisabledText: {
    opacity: 0.45,
  },
  reciteAssistRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  reciteAssistPill: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reciteShowPill: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  reciteSkipPill: {
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
  },
  recitePagePill: {
    minHeight: 36,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
  },
  reciteCurrentWordPill: {
    minHeight: 36,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  reciteAssistPillText: {
    fontSize: 13,
    fontWeight: "900",
  },
  reciteShowPillText: {
    color: "#15803d",
  },
  reciteSkipPillText: {
    color: "#b45309",
  },
  recitePagePillText: {
    color: "#475569",
  },
  reciteCurrentWordPillText: {
    color: "#2563eb",
  },
  // ── Fixed controls island ────────────────────────────────────────────────────
  controlsIsland: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  modeButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  modeButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  sessionMushafButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sessionMushafButtonDisabled: {
    opacity: 0.55,
  },
  sessionMushafButtonText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#0369a1",
  },
  sessionMushafButtonMeta: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0f766e",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  navButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  playButton: {
    backgroundColor: "#2563eb",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 22,
  },
  skipControls: {
    flexDirection: "row",
    gap: 12,
  },
  skipControlButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  skipControlButtonDisabled: {
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    opacity: 0.65,
  },
  skipControlText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  skipControlTextDisabled: {
    color: "#9ca3af",
  },
  completeButton: {
    width: "100%",
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  completeButtonDisabled: {
    backgroundColor: "#555555",
  },
  completeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  readyTeacherButton: {
    width: "100%",
    backgroundColor: "#059669",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  readyTeacherButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  readyNoorPathButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  readyNoorPathButtonDisabled: {
    opacity: 0.55,
  },
  readyNoorPathButtonText: {
    color: "#047857",
    fontSize: 16,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  // ── Settings sheet ───────────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  settingsSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  completionSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 24,
    paddingBottom: 36,
    gap: 14,
  },
  completionSubtitle: {
    marginTop: -4,
    marginBottom: 4,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
  },
  ayahSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  ayahSheetTitleBlock: {
    flex: 1,
  },
  ayahSheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  ayahSheetArabicCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    padding: 14,
  },
  ayahSheetArabicText: {
    fontFamily: "AmiriQuran",
    fontSize: 24,
    lineHeight: 42,
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  ayahPrimaryActionButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#111111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  ayahPrimaryActionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  ayahSecondaryActionButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  ayahSecondaryActionText: {
    color: "#0369a1",
    fontSize: 15,
    fontWeight: "800",
  },
  recitationCheckContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  recitationCheckContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  recitationCheckIntroCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 16,
  },
  recitationCheckKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  recitationCheckTitle: {
    marginTop: 5,
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
  },
  recitationCheckRange: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  recitationScoreCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    padding: 20,
  },
  recitationScoreKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#047857",
    textTransform: "uppercase",
  },
  recitationScoreNumber: {
    marginTop: 6,
    fontSize: 56,
    lineHeight: 62,
    fontWeight: "900",
    color: "#064e3b",
  },
  recitationScoreLabel: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "900",
    color: "#047857",
  },
  recitationScoreDetail: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "#047857",
    textAlign: "center",
  },
  recitationRatingCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  recitationRatingTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  pauseSummaryCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  leaveWarningCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  pauseSummaryTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  pauseSummaryDetail: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: "#6b7280",
  },
  pauseStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pauseAyahValue: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  pauseAyahKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  pauseAyahNumber: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  pauseQuickRow: {
    flexDirection: "row",
    gap: 10,
  },
  pauseQuickButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    alignItems: "center",
  },
  pauseQuickText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563eb",
  },
  ratingOptionList: {
    gap: 10,
  },
  ratingOption: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ratingOptionTextBlock: {
    flex: 1,
  },
  ratingOptionTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  ratingOptionDetail: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "#6b7280",
  },
  ratingRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  saveErrorText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#dc2626",
    textAlign: "center",
  },
  completionCancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  completionCancelText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2563eb",
  },
  leaveDestructiveButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#fecdd3",
    backgroundColor: "#fff1f2",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  leaveDestructiveText: {
    color: "#be123c",
    fontSize: 15,
    fontWeight: "900",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "800",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperButton: {
    width: 40,
    height: 40,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    minWidth: 36,
    textAlign: "center",
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: "#2563eb",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  toggleKnobOn: {
    alignSelf: "flex-end",
  },
  sheetDoneButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  sheetDoneText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  // ── Theme + Reciter picker pills ─────────────────────────────────────────────
  themePill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  themePillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  themePillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  themePillTextSelected: {
    color: "#ffffff",
  },
  reciterPill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reciterPillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  reciterPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  reciterPillTextSelected: {
    color: "#ffffff",
  },
  ratePill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 56,
    alignItems: "center",
  },
  ratePillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  ratePillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  ratePillTextSelected: {
    color: "#ffffff",
  },
  wordTooltipBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 190,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  wordTooltipCard: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 14,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  wordTooltipHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  wordTooltipTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  wordTooltipArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 28,
    lineHeight: 44,
    color: "#78350f",
    textAlign: "right",
    writingDirection: "rtl",
  },
  wordTooltipMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
    color: "#d97706",
  },
  wordTooltipAudioButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  wordTooltipAudioButtonDisabled: {
    opacity: 0.7,
  },
  wordTooltipCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  wordTooltipTranslation: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#374151",
  },
  wordTooltipEmpty: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    fontStyle: "italic",
    color: "#9ca3af",
  },
  translationBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  translationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 16,
    minWidth: 240,
    maxWidth: "90%",
  },
  translationArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 32,
    lineHeight: 56,
    color: "#111111",
    textAlign: "center",
  },
  translationText: {
    fontSize: 16,
    color: "#444444",
    textAlign: "center",
    lineHeight: 22,
  },
  translationCloseButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    marginTop: 4,
  },
  translationCloseText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
