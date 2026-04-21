import { useEffect, useState, useRef } from "react";
import { CelebrationOverlay } from "@/components/celebration-overlay";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReviews, completeReview, getSurah, getChildDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { RECITERS, type Reciter, buildAudioUrl } from "@/components/verse-player";
import { ChevronLeft, CheckCircle, RefreshCw, AlertCircle, Eye, EyeOff, Languages, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

const QUALITY_LABELS = [
  "Forgot completely",
  "Serious errors",
  "Correct with difficulty",
  "Correct with hesitation",
  "Good",
  "Perfect",
];
const QUALITY_COLORS = [
  "bg-red-100 text-red-700",
  "bg-red-100 text-red-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-emerald-200 text-emerald-800",
];

// ─── MushafReviewSheet ────────────────────────────────────────────────────────
// Continuous surah review surface with one sequential player for the whole chunk.

function MushafReviewSheet({
  childId,
  surahId,
  surahNumber,
  surahName,
  sessionReciter,
  onSessionReciterChange,
  playbackRate,
  onPlaybackRateChange,
  onClose,
  onRated,
}: {
  childId: string;
  surahId: number;
  surahNumber: number;
  surahName: string;
  sessionReciter: Reciter;
  onSessionReciterChange: (reciter: Reciter) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  onClose: () => void;
  onRated: (quality: number) => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [blurDuringRecitation, setBlurDuringRecitation] = useState(false);
  const [activeVerseIndex, setActiveVerseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTokenRef = useRef(0);
  const loadedVerseIndexRef = useRef<number | null>(null);
  const playbackRateRef = useRef(playbackRate);
  const sessionReciterRef = useRef(sessionReciter);

  const { data: surah, isLoading } = useQuery({
    queryKey: ["surah", surahId],
    queryFn: () => getSurah(surahId),
  });

  const verses = surah?.verses ?? [];
  const activeVerse = verses[activeVerseIndex] ?? null;

  function clearAudio() {
    playbackTokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = "";
    }
    audioRef.current = null;
    loadedVerseIndexRef.current = null;
    setIsPlaying(false);
    setIsLoadingAudio(false);
  }

  async function playFromIndex(index: number) {
    const verse = verses[index];
    if (!verse) return;

    clearAudio();
    const token = playbackTokenRef.current;
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = buildAudioUrl(sessionReciterRef.current, surahNumber, verse.number);
    audio.playbackRate = playbackRateRef.current;
    audioRef.current = audio;
    loadedVerseIndexRef.current = index;
    setActiveVerseIndex(index);
    setIsLoadingAudio(true);

    audio.onended = () => {
      if (playbackTokenRef.current !== token) return;
      if (index < verses.length - 1) {
        void playFromIndex(index + 1);
      } else {
        setIsPlaying(false);
        setIsLoadingAudio(false);
      }
    };

    audio.onerror = () => {
      if (playbackTokenRef.current !== token) return;
      setIsPlaying(false);
      setIsLoadingAudio(false);
    };

    try {
      await audio.play();
      if (playbackTokenRef.current !== token) {
        audio.pause();
        return;
      }
      setIsPlaying(true);
      setIsLoadingAudio(false);
    } catch {
      if (playbackTokenRef.current !== token) return;
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  }

  async function handlePlayPause() {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (
      audioRef.current &&
      loadedVerseIndexRef.current === activeVerseIndex &&
      (
        !Number.isFinite(audioRef.current.duration) ||
        audioRef.current.currentTime < Math.max(0, audioRef.current.duration - 0.05)
      )
    ) {
      try {
        audioRef.current.playbackRate = playbackRateRef.current;
        setIsLoadingAudio(true);
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      } finally {
        setIsLoadingAudio(false);
      }
      return;
    }

    await playFromIndex(activeVerseIndex);
  }

  function handleJumpToIndex(index: number) {
    if (index < 0 || index >= verses.length) return;
    void playFromIndex(index);
  }

  useEffect(() => {
    return () => {
      clearAudio();
    };
  }, []);

  useEffect(() => {
    clearAudio();
    setActiveVerseIndex(0);
    setRating(null);
    setShowTranslation(false);
    setBlurDuringRecitation(false);
  }, [surahId]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    sessionReciterRef.current = sessionReciter;
    clearAudio();
  }, [sessionReciter.id]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-emerald-200 text-sm mb-4"
          >
            <ChevronLeft size={16} /> Back to Review
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Self-Test</h1>
              <p className="text-emerald-200 text-sm mt-1">
                {surahName} · Recite from memory, then reveal to check
              </p>
            </div>
            {surah && (
              <p className="arabic-text text-3xl text-amber-300">{surah.nameArabic}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Audio controls */}
        <Card className="border-border">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Review Audio</p>
                <p className="text-[11px] text-muted-foreground">
                  Play the surah continuously and follow the highlighted ayah
                </p>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {activeVerse ? `Ayah ${activeVerse.number} of ${verses.length}` : "Ready"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Reciter</span>
                <select
                  value={sessionReciter.id}
                  onChange={(e) =>
                    onSessionReciterChange(RECITERS.find((r) => r.id === e.target.value)!)
                  }
                  className="w-full text-xs border border-border rounded-lg px-2 py-2 bg-background"
                >
                  {RECITERS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Speed</span>
                <select
                  value={String(playbackRate)}
                  onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
                  className="w-full text-xs border border-border rounded-lg px-2 py-2 bg-background"
                >
                  <option value="1">1.0x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="1.75">1.75x</option>
                  <option value="2">2.0x</option>
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={activeVerseIndex <= 0 || verses.length === 0}
                onClick={() => handleJumpToIndex(activeVerseIndex - 1)}
              >
                <SkipBack size={14} className="mr-1" />
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={verses.length === 0 || isLoadingAudio}
                onClick={() => void handlePlayPause()}
              >
                {isPlaying ? (
                  <>
                    <Pause size={14} className="mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play size={14} className="mr-1" />
                    {isLoadingAudio ? "Loading..." : "Play Surah"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={activeVerseIndex >= verses.length - 1 || verses.length === 0}
                onClick={() => handleJumpToIndex(activeVerseIndex + 1)}
              >
                Next
                <SkipForward size={14} className="ml-1" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={showTranslation ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setShowTranslation((prev) => !prev)}
              >
                <Languages size={14} className="mr-1" />
                {showTranslation ? "Hide Translation" : "Show Translation"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={blurDuringRecitation ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setBlurDuringRecitation((prev) => !prev)}
              >
                {blurDuringRecitation ? (
                  <EyeOff size={14} className="mr-1" />
                ) : (
                  <Eye size={14} className="mr-1" />
                )}
                {blurDuringRecitation ? "Blur On" : "Blur Off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Continuous surah review sheet */}
        {isLoading ? (
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Continuous Review</p>
                  <p className="text-xs text-muted-foreground">
                    Tap any ayah to start playback from there
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-800 border-0">
                  {surah?.verses?.length ?? 0} ayahs
                </Badge>
              </div>

              <div
                className="space-y-3 arabic-text"
                dir="rtl"
                lang="ar"
                style={{
                  fontFamily: '"Scheherazade New", "Amiri Quran", serif',
                  fontSize: "clamp(24px, 3vw, 34px)",
                  lineHeight: 2.1,
                }}
              >
                {verses.map((verse, index) => {
                  const isActive = index === activeVerseIndex;
                  const isBlurred =
                    blurDuringRecitation && (!isPlaying || !isActive);
                  return (
                    <div
                      key={verse.number}
                      onClick={() => handleJumpToIndex(index)}
                      className={cn(
                        "rounded-2xl px-4 py-3 transition-colors cursor-pointer",
                        isActive
                          ? "bg-amber-100/80 ring-1 ring-amber-300 shadow-sm"
                          : "hover:bg-amber-50/70"
                      )}
                    >
                      <div className="flex flex-row-reverse items-start gap-3">
                        <span className="mt-1 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-amber-300 bg-white text-xs font-semibold text-amber-800">
                          {verse.number}
                        </span>
                        <div className="flex-1 text-right">
                          <p
                            className={cn("text-foreground transition-all duration-150", isActive && "text-amber-950")}
                            style={
                              isBlurred
                                ? {
                                    filter: "blur(6px)",
                                    userSelect: "none",
                                    opacity: 0.6,
                                  }
                                : undefined
                            }
                          >
                            {verse.arabic}
                          </p>
                          {showTranslation && (
                            <p
                              className="mt-2 text-left text-sm leading-relaxed text-muted-foreground not-italic transition-all duration-150"
                              style={isBlurred ? { filter: "blur(4px)", opacity: 0.55 } : undefined}
                            >
                              "{verse.translation}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rate yourself */}
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Rate your recitation</p>
            <div className="space-y-2 mb-4">
              {[0, 1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  onClick={() => setRating(q)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border ${
                    rating === q
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      rating === q ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q}
                  </div>
                  <span className={`text-xs ${QUALITY_COLORS[q]} px-2 py-0.5 rounded-full`}>
                    {QUALITY_LABELS[q]}
                  </span>
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={rating === null}
              onClick={() => rating !== null && onRated(rating)}
            >
              <CheckCircle size={14} className="mr-1" /> Submit Review
            </Button>
          </CardContent>
        </Card>
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}

// ─── Main Review page ─────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { childId } = useParams<{ childId: string }>();

  const getTodayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const SESSION_KEY = `child-${childId}-review-session`;

  const loadSession = () => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed.date !== getTodayLocal()) return null;
      return parsed;
    } catch { return null; }
  };
  const storedSession = loadSession();

  const [mushafItem, setMushafItem] = useState<{
    surahId: number;
    surahNumber: number;
    surahName: string;
    reviewItemId: number;
  } | null>(null);
  const [flashcardIndex, setFlashcardIndex] = useState<number | null>(null);
  const [flashcardRating, setFlashcardRating] = useState<number | null>(null);
  const [flashcardShowVerses, setFlashcardShowVerses] = useState(false);
  const [sessionDone, setSessionDone] = useState<boolean>(storedSession?.sessionDone ?? false);
  const [showReviewCelebration, setShowReviewCelebration] = useState(false);
  const [completedCount, setCompletedCount] = useState<number>(storedSession?.completedItemsData?.length ?? 0);
  const [completedSurahIds, setCompletedSurahIds] = useState<Set<number>>(
    new Set(storedSession?.completedItemsData?.map((i: any) => i.surahId) ?? [])
  );
  const [sessionReciter, setSessionReciter] = useState<Reciter>(
    () => RECITERS.find((r) => r.id === "husary")!
  );
  const [sessionPlaybackRate, setSessionPlaybackRate] = useState(1);
  const [completedItemsData, setCompletedItemsData] = useState<Array<{surahId: number; surahName?: string | null; surahNumber: number}>>(
    storedSession?.completedItemsData ?? []
  );
  const sessionTotalRef = useRef<number>(storedSession?.sessionTotal ?? 0);
  const sessionSurahsRef = useRef<typeof dueToday | null>(storedSession?.sessionSurahs ?? null);
  const dueTodayRef = useRef<{surahId: number; surahName?: string | null; surahNumber: number}[]>([]);
  const qc = useQueryClient();

  const saveSession = (updates: {
    sessionDone?: boolean;
    completedItemsData?: Array<{surahId: number; surahName?: string | null; surahNumber: number}>;
    sessionSurahs?: typeof dueToday;
    sessionTotal?: number;
  }) => {
    try {
      const current = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch { return {}; } })();
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        ...current,
        date: getTodayLocal(),
        ...updates,
      }));
    } catch {}
  };

  const syncReviewDailyProgress = (body: {
    reviewStatus?: "not_started" | "in_progress" | "completed";
    reviewCompletedCount?: number;
    reviewTargetCount?: number;
  }) => {
    fetch(`/api/children/${childId}/daily-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(() => qc.invalidateQueries({ queryKey: ["dashboard", childId] })).catch(() => {});
  };

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", childId],
    queryFn: () => listReviews(parseInt(childId)),
  });

  const { data: dashData } = useQuery({
    queryKey: ["dashboard", childId],
    queryFn: () => getChildDashboard(parseInt(childId)),
    staleTime: 30_000,
  });
  const todayProgress = (dashData as any)?.todayProgress;

  const dueToday = data?.dueToday ?? [];
  dueTodayRef.current = dueToday;

  // Freeze session list on first load — never changes during the session regardless of refetches
  if (data && sessionSurahsRef.current === null && dueToday.length > 0) {
    sessionSurahsRef.current = dueToday;
    sessionTotalRef.current = dueToday.length;
    saveSession({ sessionSurahs: dueToday, sessionTotal: dueToday.length });
  }
  const sessionSurahs = sessionSurahsRef.current ?? dueToday;

  useEffect(() => {
    if (!data) return;
    const sessionTotal = sessionTotalRef.current;
    if (sessionTotal <= 0) return;
    const reviewStatus =
      sessionDone || completedCount >= sessionTotal
        ? "completed"
        : completedCount > 0
        ? "in_progress"
        : "not_started";
    syncReviewDailyProgress({
      reviewStatus,
      reviewCompletedCount: completedCount,
      reviewTargetCount: sessionTotal,
    });
  }, [data, completedCount, sessionDone]);

  // Fetch current flashcard surah if in flashcard mode
  const flashcardItem = flashcardIndex !== null ? sessionSurahs[flashcardIndex] : null;
  const { data: flashcardSurahData } = useQuery({
    queryKey: ["surah", flashcardItem?.surahId],
    queryFn: () => getSurah(flashcardItem!.surahId),
    enabled: !!flashcardItem,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ surahId, quality }: { surahId: number; quality: number }) =>
      completeReview(parseInt(childId), {
        surahId,
        qualityRating: quality,
        durationMinutes: 5,
      }),
    onSuccess: (_, variables) => {
      const completedItem = dueTodayRef.current.find(i => i.surahId === variables.surahId);
      if (completedItem) {
        const newItemsData = completedItemsData.some(i => i.surahId === completedItem.surahId)
          ? completedItemsData
          : [...completedItemsData, { surahId: completedItem.surahId, surahName: completedItem.surahName, surahNumber: completedItem.surahNumber }];
        setCompletedItemsData(newItemsData);
        saveSession({ completedItemsData: newItemsData });
      }
      setCompletedSurahIds((prev) => new Set([...prev, variables.surahId]));
      qc.invalidateQueries({ queryKey: ["reviews", childId] });
      const newCount = completedCount + 1;
      setCompletedCount(newCount);
      const sessionTotal = sessionTotalRef.current;
      // Advance or finish — use sessionTotal (stable) not dueToday.length (shrinks on refetch)
      if (flashcardIndex !== null) {
        setFlashcardRating(null);
        setFlashcardShowVerses(false);
        if (newCount >= sessionTotal) {
          setSessionDone(true);
          saveSession({ sessionDone: true });
          setShowReviewCelebration(true);
          setFlashcardIndex(null);
        } else {
          setFlashcardIndex((i) => (i ?? 0) + 1);
        }
      } else if (mushafItem) {
        setMushafItem(null);
        if (newCount >= sessionTotal) {
          setSessionDone(true);
          saveSession({ sessionDone: true });
          setShowReviewCelebration(true);
        }
      }
    },
  });

  // ── Mushaf self-test view ──
  if (mushafItem) {
    return (
      <MushafReviewSheet
        childId={childId}
        surahId={mushafItem.surahId}
        surahNumber={mushafItem.surahNumber}
        surahName={mushafItem.surahName}
        sessionReciter={sessionReciter}
        onSessionReciterChange={setSessionReciter}
        playbackRate={sessionPlaybackRate}
        onPlaybackRateChange={setSessionPlaybackRate}
        onClose={() => setMushafItem(null)}
        onRated={(quality) =>
          reviewMutation.mutate({ surahId: mushafItem.surahId, quality })
        }
      />
    );
  }

  // ── Flashcard view (single surah) ──
  if (flashcardIndex !== null && flashcardItem) {
    const verses = flashcardSurahData?.verses ?? [];
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg text-white px-4 pt-8 pb-12">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => { setFlashcardIndex(null); setFlashcardRating(null); setFlashcardShowVerses(false); }}
              className="flex items-center gap-1 text-emerald-200 text-sm mb-4"
            >
              <ChevronLeft size={16} /> Back to Review List
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Flashcard Review</h1>
                <p className="text-emerald-200 text-sm mt-1">
                  {flashcardIndex + 1} of {sessionTotalRef.current} · {sessionTotalRef.current - flashcardIndex - 1} remaining
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
                <RefreshCw size={24} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          {flashcardItem.isOverdue && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-orange-600" />
                <p className="text-xs text-orange-700">
                  This surah was due on {flashcardItem.dueDate} — let's catch up!
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="verse-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-lg text-foreground">{flashcardItem.surahName}</p>
                  <p className="text-xs text-muted-foreground">
                    Surah {flashcardItem.surahNumber} · Due {flashcardItem.dueDate}
                  </p>
                </div>
                <p className="arabic-text text-3xl text-primary">
                  {flashcardSurahData?.nameArabic}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 mb-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Recite this surah from memory, then rate yourself below
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full mb-3"
                onClick={() => setFlashcardShowVerses(!flashcardShowVerses)}
              >
                {flashcardShowVerses ? "Hide Verses" : "Show Verses (if needed)"}
              </Button>
              {flashcardShowVerses &&
                verses.map((verse) => (
                  <div key={verse.number} className="mb-3 pb-3 border-b border-border last:border-0">
                    <p className="arabic-text text-xl text-foreground text-right mb-1" dir="rtl">
                      {verse.arabic}
                    </p>
                    <p className="text-xs text-primary italic">{verse.transliteration}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      "{verse.translation}"
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                How was your recitation?
              </p>
              <div className="space-y-2 mb-4">
                {[0, 1, 2, 3, 4, 5].map((q) => (
                  <button
                    key={q}
                    onClick={() => setFlashcardRating(q)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border ${
                      flashcardRating === q
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        flashcardRating === q
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {q}
                    </div>
                    <span className={`text-xs ${QUALITY_COLORS[q]} px-2 py-0.5 rounded-full`}>
                      {QUALITY_LABELS[q]}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={flashcardRating === null || reviewMutation.isPending}
                onClick={() =>
                  flashcardRating !== null &&
                  reviewMutation.mutate({ surahId: flashcardItem.surahId, quality: flashcardRating })
                }
              >
                <CheckCircle size={14} className="mr-1" />
                {reviewMutation.isPending ? "Saving..." : "Submit Review"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <ChildNav childId={childId} />
      </div>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Genuinely no reviews today (not just all completed this session) ──
  if (!sessionDone && data !== undefined && sessionSurahs.length === 0 && completedItemsData.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">All Caught Up!</h2>
          <p className="text-muted-foreground mb-2">No surahs due for review today. Keep memorizing!</p>
          <p className="text-xs text-muted-foreground mb-6">Consistent review is the key to strong memorization.</p>
          <Link href={`/child/${childId}`}>
            <Button className="w-full rounded-full">Back to Dashboard</Button>
          </Link>
        </div>
        <ChildNav childId={childId} />
      </div>
    );
  }

  // ── Default: surah card grid (also shown when sessionDone — completed rows stay visible) ──
  return (
    <>
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
              <ChevronLeft size={16} /> Dashboard
            </button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Review Session</h1>
              <p className="text-emerald-200 text-sm mt-1">
                {completedCount > 0 || sessionDone
                  ? `${completedCount}/${sessionTotalRef.current} surahs done`
                  : `${sessionSurahs.length} surah${sessionSurahs.length !== 1 ? "s" : ""} due today`
                }
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
              <RefreshCw size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-3">
        {/* Due today cards */}
        {(() => {
          // Use frozen session snapshot — immune to refetch changes
          const pendingItems = sessionSurahs.filter(item => !completedSurahIds.has(item.surahId));

          return (
            <>
              {sessionDone && (
                <Card className="border-emerald-300 bg-emerald-50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl mb-1">🏆</p>
                    <p className="font-bold text-emerald-800">All done for today!</p>
                    <p className="text-xs text-emerald-700 mt-1">Great job! Come back tomorrow for your next review.</p>
                  </CardContent>
                </Card>
              )}
              {!sessionDone && pendingItems.map((item) => {
                const idx = sessionSurahs.indexOf(item);
                return (
                  <Card
                    key={item.id}
                    className={cn("border-border", item.isOverdue && "border-orange-200")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground">{item.surahName}</p>
                            {item.isOverdue && (
                              <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Surah {item.surahNumber} · Due {item.dueDate}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {item.surahNumber}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          onClick={() =>
                            setMushafItem({
                              surahId: item.surahId,
                              surahNumber: item.surahNumber,
                              surahName: item.surahName ?? "",
                              reviewItemId: item.id,
                            })
                          }
                        >
                          Mushaf View
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setFlashcardIndex(idx)}
                        >
                          Flashcard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {completedItemsData.map((item) => (
                <div
                  key={`done-${item.surahId}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200"
                >
                  <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-sm font-medium text-emerald-800 flex-1">{item.surahName}</p>
                  <span className="text-xs text-emerald-600 font-medium">Reviewed ✓</span>
                </div>
              ))}
            </>
          );
        })()}

        {/* Upcoming */}
        {!sessionDone && (data?.upcoming ?? []).length > 0 && (
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-3">Upcoming Reviews</p>
              <div className="space-y-2">
                {(data?.upcoming ?? []).slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">{item.surahName}</span>
                    <Badge variant="secondary">{item.dueDate}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {sessionDone && (
          <div className="pb-2 space-y-2">
            <Button
              className="w-full rounded-full"
              variant="outline"
              onClick={() => {
                localStorage.removeItem(SESSION_KEY);
                setSessionDone(false);
                setCompletedCount(0);
                setCompletedSurahIds(new Set());
                setCompletedItemsData([]);
                sessionTotalRef.current = 0;
                sessionSurahsRef.current = null;
                qc.invalidateQueries({ queryKey: ["reviews", childId] });
                qc.invalidateQueries({ queryKey: ["dashboard", childId] });
              }}
            >
              Next Day's Review →
            </Button>
            <Link href={`/child/${childId}`}>
              <Button className="w-full rounded-full" variant="ghost">Back to Dashboard</Button>
            </Link>
          </div>
        )}
      </div>

      <ChildNav childId={childId} />
    </div>
    <CelebrationOverlay
      show={showReviewCelebration}
      onDone={() => setShowReviewCelebration(false)}
      message="Review Complete!"
      subMessage="Excellent revision!"
    />
    </>
  );
}
