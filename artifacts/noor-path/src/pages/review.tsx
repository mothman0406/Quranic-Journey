import { useState, useRef } from "react";
import { CelebrationOverlay } from "@/components/celebration-overlay";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReviews, completeReview, getSurah, getChildDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { RECITERS, type Reciter, buildAudioUrl, buildWordAudioUrl } from "@/components/verse-player";
import { ChevronLeft, CheckCircle, RefreshCw, AlertCircle, Eye, EyeOff, Volume2 } from "lucide-react";
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

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

// ─── MushafReviewSheet ────────────────────────────────────────────────────────
// Self-test mushaf view: verses are hidden until revealed.
// Tapping a verse number plays the full verse audio.
// Tapping a word plays that word's audio.

function MushafReviewSheet({
  childId,
  surahId,
  surahNumber,
  surahName,
  onClose,
  onRated,
}: {
  childId: string;
  surahId: number;
  surahNumber: number;
  surahName: string;
  onClose: () => void;
  onRated: (quality: number) => void;
}) {
  const [reciter, setReciter] = useState<Reciter>(
    () => RECITERS.find((r) => r.id === "husary")!
  );
  const [revealedVerses, setRevealedVerses] = useState<Set<number>>(new Set());
  const [allRevealed, setAllRevealed] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: surah, isLoading } = useQuery({
    queryKey: ["surah", surahId],
    queryFn: () => getSurah(surahId),
  });

  function playAudio(url: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    } else {
      const a = new Audio(url);
      audioRef.current = a;
      a.play().catch(() => {});
    }
  }

  function playVerse(verseNumber: number) {
    playAudio(buildAudioUrl(reciter, surahNumber, verseNumber));
  }

  function playWord(verseNumber: number, wordIndex: number) {
    // wordIndex is 1-based position within the verse
    playAudio(buildWordAudioUrl(surahNumber, verseNumber, wordIndex));
  }

  function toggleReveal(verseNumber: number) {
    setRevealedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(verseNumber)) { next.delete(verseNumber); } else { next.add(verseNumber); }
      return next;
    });
  }

  function revealAll() {
    const all = new Set((surah?.verses ?? []).map((v) => v.number));
    setRevealedVerses(all);
    setAllRevealed(true);
  }

  const verses = surah?.verses ?? [];
  const revealedCount = revealedVerses.size;

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

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-3">
        {/* Reciter + reveal all row */}
        <Card className="border-border">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <select
              value={reciter.id}
              onChange={(e) => setReciter(RECITERS.find((r) => r.id === e.target.value)!)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background flex-1"
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={revealAll}>
              <Eye size={12} className="mr-1" />
              {allRevealed ? "All Shown" : "Reveal All"}
            </Button>
          </CardContent>
        </Card>

        {/* Hint */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
          Tap a verse number to hear it. Tap any word to hear that word. Tap "Reveal" to show a verse.
        </div>

        {/* Verses */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {verses.map((verse) => {
              const revealed = revealedVerses.has(verse.number) || allRevealed;
              const words = verse.arabic.split(/\s+/).filter(Boolean);
              return (
                <Card key={verse.number} className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      {/* Verse number — tap to play full verse */}
                      <button
                        onClick={() => playVerse(verse.number)}
                        className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 transition-colors rounded-full px-2.5 py-1"
                      >
                        <Volume2 size={11} className="text-primary" />
                        <span className="text-xs font-bold text-primary">{verse.number}</span>
                      </button>
                      <button
                        onClick={() => toggleReveal(verse.number)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {revealed ? (
                          <><EyeOff size={12} /> Hide</>
                        ) : (
                          <><Eye size={12} /> Reveal</>
                        )}
                      </button>
                    </div>

                    {revealed ? (
                      <div className="flex flex-wrap gap-1 justify-end" dir="rtl">
                        {words.map((word, wi) => (
                          <button
                            key={wi}
                            onClick={() => playWord(verse.number, wi + 1)}
                            className="arabic-text text-xl text-foreground hover:text-primary hover:bg-primary/5 px-1 rounded transition-colors"
                          >
                            {word}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-xs text-muted-foreground italic">
                          Recite from memory, then tap Reveal
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Rate yourself */}
        {revealedCount > 0 && (
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
        )}
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}

// ─── Main Review page ─────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { childId } = useParams<{ childId: string }>();
  const [mushafItem, setMushafItem] = useState<{
    surahId: number;
    surahNumber: number;
    surahName: string;
    reviewItemId: number;
  } | null>(null);
  const [flashcardIndex, setFlashcardIndex] = useState<number | null>(null);
  const [flashcardRating, setFlashcardRating] = useState<number | null>(null);
  const [flashcardShowVerses, setFlashcardShowVerses] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [showReviewCelebration, setShowReviewCelebration] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [completedSurahIds, setCompletedSurahIds] = useState<Set<number>>(new Set());
  const sessionTotalRef = useRef<number>(0);
  const qc = useQueryClient();

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

  // Capture session total once when data first arrives
  if (data && sessionTotalRef.current === 0 && dueToday.length > 0) {
    sessionTotalRef.current = dueToday.length;
  }

  // Fetch current flashcard surah if in flashcard mode
  const flashcardItem = flashcardIndex !== null ? dueToday[flashcardIndex] : null;
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
      setCompletedSurahIds((prev) => new Set([...prev, variables.surahId]));
      qc.invalidateQueries({ queryKey: ["reviews", childId] });
      const newCount = completedCount + 1;
      setCompletedCount(newCount);
      fetch(`/api/children/${childId}/daily-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewCompletedCount: newCount }),
      }).then(() => qc.invalidateQueries({ queryKey: ["dashboard", childId] })).catch(() => {});
      // Advance or finish
      if (flashcardIndex !== null) {
        setFlashcardRating(null);
        setFlashcardShowVerses(false);
        if (flashcardIndex >= dueToday.length - 1) {
          setSessionDone(true);
          setShowReviewCelebration(true);
          setFlashcardIndex(null);
        } else {
          setFlashcardIndex((i) => (i ?? 0) + 1);
        }
      } else if (mushafItem) {
        setMushafItem(null);
        if (dueToday.length <= 1) {
          setSessionDone(true);
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
                  {flashcardIndex + 1} of {dueToday.length} · {dueToday.length - flashcardIndex - 1} remaining
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

  // ── Done / none ──
  if (sessionDone || dueToday.length === 0) {
    return (
      <>
        <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">{sessionDone ? "🏆" : "✅"}</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {sessionDone ? "Review Complete!" : "All Caught Up!"}
            </h2>
            <p className="text-muted-foreground mb-2">
              {sessionDone
                ? `Great job! You reviewed ${dueToday.length} surah${dueToday.length > 1 ? "s" : ""} today.`
                : "No surahs due for review today. Keep memorizing!"}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Consistent review is the key to strong memorization.
            </p>
            <Link href={`/child/${childId}`}>
              <Button className="w-full rounded-full">Back to Dashboard</Button>
            </Link>
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

  // ── Default: surah card grid ──
  return (
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
                {(() => {
                  const persistedDone = todayProgress?.reviewCompletedCount ?? 0;
                  const sessionDoneCount = completedCount > 0 ? completedCount : persistedDone;
                  const sessionTotal = completedCount > 0
                    ? sessionTotalRef.current
                    : (persistedDone + dueToday.length);
                  return sessionDoneCount > 0 || persistedDone > 0
                    ? `${sessionDoneCount}/${sessionTotal} surahs done`
                    : `${dueToday.length} surah${dueToday.length !== 1 ? "s" : ""} due today`;
                })()}
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
          const pendingItems = dueToday.filter(item => !completedSurahIds.has(item.surahId));
          const doneItems = dueToday.filter(item => completedSurahIds.has(item.surahId));
          const orderedItems = [...pendingItems, ...doneItems];
          return orderedItems.map((item) => {
            const isDone = completedSurahIds.has(item.surahId);
            const idx = dueToday.indexOf(item);
            if (isDone) {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200"
                >
                  <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-sm font-medium text-emerald-800 flex-1">{item.surahName}</p>
                  <span className="text-xs text-emerald-600 font-medium">Reviewed ✓</span>
                </div>
              );
            }
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
          });
        })()}

        {/* Upcoming */}
        {(data?.upcoming ?? []).length > 0 && (
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
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
