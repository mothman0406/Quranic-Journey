import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSurahs,
  listMemorization,
  updateMemorization,
  getChildDashboard,
  getSurah,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { VersePlayer, RECITERS, type Reciter } from "@/components/verse-player";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  BookOpen,
  Layers,
  ListOrdered,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConsecutiveRange(ayahs: number[]): { start: number; end: number } | null {
  if (ayahs.length === 0) return null;
  const sorted = [...ayahs].sort((a, b) => a - b);
  // Find the longest consecutive run starting from the lowest memorized ayah
  let end = sorted[0];
  for (const n of sorted) {
    if (n === end + 1 || n === end) { end = n; } else { break; }
  }
  return { start: sorted[0], end };
}

function getStatusColor(status: string, percent: number) {
  if (status === "memorized") return "bg-emerald-500";
  if (status === "in_progress" || percent > 0) return "bg-amber-400";
  return "bg-muted";
}

// ─── SurahStudyView (inline ayah-by-ayah mode, replaces lesson.tsx) ──────────

function SurahStudyView({
  surahId,
  childId,
  onBack,
  initialVerseIndex = 0,
}: {
  surahId: number;
  childId: string;
  onBack: () => void;
  initialVerseIndex?: number;
}) {
  const [verseIndex, setVerseIndex] = useState(initialVerseIndex);
  const [showTajweed, setShowTajweed] = useState(false);
  const [rating, setRating] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [sessionReciter, setSessionReciter] = useState<Reciter>(
    () => RECITERS.find((r) => r.id === "husary")!
  );
  const qc = useQueryClient();

  const { data: surah, isLoading } = useQuery({
    queryKey: ["surah", surahId],
    queryFn: () => getSurah(surahId),
  });

  const { data: memData } = useQuery({
    queryKey: ["memorization", childId],
    queryFn: () => listMemorization(parseInt(childId)),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const currentAyahs: number[] = memData?.progress.find(
        (p) => p.surahId === surahId
      )?.memorizedAyahs ?? [];
      // Add all ayahs up through current verse to the memorized set
      const newAyahs = Array.from(
        new Set([...currentAyahs, ...Array.from({ length: verseIndex + 1 }, (_, i) => i + 1)])
      ).sort((a, b) => a - b);
      return updateMemorization(parseInt(childId), {
        surahId: surah!.number,
        memorizedAyahs: newAyahs,
        qualityRating: rating || 3,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memorization", childId] });
      qc.invalidateQueries({ queryKey: ["dashboard", childId] });
      setCompleted(true);
    },
  });

  if (isLoading || !surah) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <ChildNav childId={childId} />
      </div>
    );
  }

  const verses = surah.verses ?? [];
  const currentVerse = verses[verseIndex];

  if (completed) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🌟</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Masha'Allah!</h2>
          <p className="text-muted-foreground mb-2">Great work on today's lesson!</p>
          <p className="text-sm text-muted-foreground mb-6">
            You studied {verseIndex + 1} verse{verseIndex > 0 ? "s" : ""} of{" "}
            {surah.nameTransliteration}
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setCompleted(false); setVerseIndex(0); setRating(0); }}
            >
              Continue
            </Button>
            <Button className="flex-1" onClick={onBack}>
              Back to List
            </Button>
          </div>
        </div>
        <ChildNav childId={childId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-emerald-200 text-sm mb-4"
          >
            <ChevronLeft size={16} /> Back to Memorization
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Ayah by Ayah</h1>
              <p className="text-emerald-200 text-sm mt-1">
                {surah.nameTransliteration} · {verses.length} verses
              </p>
            </div>
            <p className="arabic-text text-3xl text-amber-300">{surah.nameArabic}</p>
          </div>
          {verses.length > 0 && (
            <div className="mt-3">
              <Progress
                value={((verseIndex + 1) / verses.length) * 100}
                className="h-2 bg-white/20"
              />
              <p className="text-xs text-emerald-200 mt-1">
                Verse {verseIndex + 1} of {verses.length}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Tajweed notes */}
        {surah.tajweedNotes && surah.tajweedNotes.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3">
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => setShowTajweed(!showTajweed)}
              >
                <Info size={14} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700">
                  Tajweed Notes for {surah.nameTransliteration}
                </span>
                <ChevronRight
                  size={12}
                  className={`text-amber-600 ml-auto transition-transform ${showTajweed ? "rotate-90" : ""}`}
                />
              </button>
              {showTajweed && (
                <ul className="mt-2 space-y-1">
                  {surah.tajweedNotes.map((note, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                      <span>•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current verse */}
        {currentVerse && (
          <Card className="verse-card shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="secondary" className="text-xs">
                  Verse {currentVerse.number}
                </Badge>
                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                  {surah.nameTransliteration}
                </Badge>
              </div>
              <div className="py-4 border-y border-border/50 mb-4">
                <VersePlayer
                  key={`${surah.number}-${currentVerse.number}`}
                  arabic={currentVerse.arabic}
                  surahNumber={surah.number}
                  verseNumber={currentVerse.number}
                  size="lg"
                  reciter={sessionReciter}
                  onReciterChange={setSessionReciter}
                />
              </div>
              <div className="text-center mb-3">
                <p className="text-sm text-primary font-medium italic">
                  {currentVerse.transliteration}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "{currentVerse.translation}"
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tafsir */}
        {surah.tafsirBrief && (
          <Card className="border-border bg-emerald-50/50">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-primary mb-1">💡 Meaning</p>
              <p className="text-sm text-foreground leading-relaxed">{surah.tafsirBrief}</p>
            </CardContent>
          </Card>
        )}

        {/* Rating and save */}
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-2">
              How well did the recitation go?
            </p>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => setRating(r)}
                  className={`flex-1 py-2 rounded-xl text-lg transition-all ${
                    rating >= r ? "bg-amber-100 scale-105" : "bg-muted"
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {verseIndex < verses.length - 1 ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setVerseIndex((v) => v + 1); setRating(0); }}
                >
                  Next Verse <ChevronRight size={14} className="ml-1" />
                </Button>
              ) : null}
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <CheckCircle size={14} className="mr-1" />
                {saveMutation.isPending ? "Saving..." : "Save Progress"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* All verses list */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground px-1">All Verses</h3>
          {verses.map((verse, i) => (
            <button
              key={verse.number}
              onClick={() => { setVerseIndex(i); setRating(0); }}
              className="w-full text-left"
            >
              <Card
                className={`border transition-colors ${
                  i === verseIndex ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === verseIndex
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {verse.number}
                  </div>
                  <p
                    className="arabic-text text-base text-foreground truncate flex-1"
                    dir="rtl"
                  >
                    {verse.arabic}
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}

// ─── AyahCircles (expanded surah view) ───────────────────────────────────────

function AyahCircles({
  totalVerses,
  memorizedAyahs,
  onToggle,
  isPending,
}: {
  totalVerses: number;
  memorizedAyahs: number[];
  onToggle: (ayah: number) => void;
  isPending: boolean;
}) {
  const memorizedSet = new Set(memorizedAyahs);
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {Array.from({ length: totalVerses }, (_, i) => i + 1).map((n) => {
        const done = memorizedSet.has(n);
        return (
          <button
            key={n}
            disabled={isPending}
            onClick={() => onToggle(n)}
            className={cn(
              "w-8 h-8 rounded-full text-xs font-bold transition-all border",
              done
                ? "bg-emerald-500 text-white border-emerald-600"
                : "bg-muted text-muted-foreground border-border hover:border-primary/40"
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MemorizationPage() {
  const { childId } = useParams<{ childId: string }>();
  const [filter, setFilter] = useState<"all" | "memorized" | "in_progress" | "not_started" | "today">("all");
  const [expandedSurahId, setExpandedSurahId] = useState<number | null>(null);
  const [studyingSurahId, setStudyingSurahId] = useState<number | null>(null);
  const [studyingInitialAyah, setStudyingInitialAyah] = useState(0);
  const qc = useQueryClient();

  const { data: surahsData } = useQuery({
    queryKey: ["surahs"],
    queryFn: () => listSurahs(),
  });

  const { data: progressData, isLoading } = useQuery({
    queryKey: ["memorization", childId],
    queryFn: () => listMemorization(parseInt(childId)),
  });

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard", childId],
    queryFn: () => getChildDashboard(parseInt(childId)),
  });

  const toggleAyahMutation = useMutation({
    mutationFn: ({
      surahNumber,
      newAyahs,
    }: {
      surahNumber: number;
      newAyahs: number[];
    }) =>
      updateMemorization(parseInt(childId), {
        surahId: surahNumber,
        memorizedAyahs: newAyahs,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memorization", childId] });
      qc.invalidateQueries({ queryKey: ["dashboard", childId] });
    },
  });

  // If in study mode, render study view
  if (studyingSurahId !== null) {
    return (
      <SurahStudyView
        surahId={studyingSurahId}
        childId={childId}
        onBack={() => setStudyingSurahId(null)}
        initialVerseIndex={studyingInitialAyah}
      />
    );
  }

  const progress = progressData?.progress ?? [];
  const surahs = surahsData?.surahs ?? [];
  const nextSurah = dashboard?.nextSurah;

  type NewMemExt = { surahName: string; surahNumber?: number; ayahStart: number; ayahEnd: number; pageStart?: number };
  type TodayProgress = {
    memStatus: "not_started" | "in_progress" | "completed";
    memTargetSurah: number | null;
    memTargetAyahStart: number | null;
    memTargetAyahEnd: number | null;
    memCompletedAyahEnd: number | null;
    reviewStatus: "not_started" | "in_progress" | "completed";
    reviewTargetCount: number | null;
    reviewCompletedCount: number;
  };
  const newMem = dashboard?.todaysPlan?.newMemorization as NewMemExt | undefined;
  const todayProgress = (dashboard as { todayProgress?: TodayProgress } | undefined)?.todayProgress;
  const todayMemStatus = todayProgress?.memStatus ?? "not_started";
  const todaysSurahId = newMem?.surahNumber
    ? surahs.find(s => s.number === newMem.surahNumber)?.id
    : nextSurah?.id;
  const showUpNext = !!nextSurah && (
    todayMemStatus === "completed" ||
    (newMem?.surahNumber !== undefined && nextSurah.number !== newMem.surahNumber)
  );

  const memStart = todayProgress?.memTargetAyahStart ?? newMem?.ayahStart ?? 1;
  const memEnd = todayProgress?.memTargetAyahEnd ?? newMem?.ayahEnd ?? 1;
  const memDone = todayProgress?.memCompletedAyahEnd ?? memStart - 1;
  const memPct = memEnd > memStart ? ((memDone - memStart + 1) / (memEnd - memStart + 1)) * 100 : 0;

  const filteredProgress = (() => {
    if (filter === "all") return progress;
    if (filter === "today") {
      const targetNum = todayProgress?.memTargetSurah ?? newMem?.surahNumber;
      if (targetNum == null) return [];
      return progress.filter(p => surahs.find(s => s.id === p.surahId)?.number === targetNum);
    }
    return progress.filter(p => p.status === filter);
  })();

  const memorizedCount = progress.filter((p) => p.status === "memorized").length;
  const totalVerses = progress.reduce((s, p) => s + p.versesMemorized, 0);

  function handleToggleAyah(item: (typeof progress)[0], ayah: number) {
    const surahMeta = surahs.find((s) => s.id === item.surahId);
    if (!surahMeta) return;
    const current = new Set(item.memorizedAyahs ?? []);
    if (current.has(ayah)) { current.delete(ayah); } else { current.add(ayah); }
    const newAyahs = Array.from(current).sort((a, b) => a - b);
    toggleAyahMutation.mutate({ surahNumber: surahMeta.number, newAyahs });
  }

  function handleMarkAllDone(item: (typeof progress)[0]) {
    const surahMeta = surahs.find((s) => s.id === item.surahId);
    if (!surahMeta) return;
    const allAyahs = Array.from({ length: item.totalVerses }, (_, i) => i + 1);
    toggleAyahMutation.mutate({ surahNumber: surahMeta.number, newAyahs: allAyahs });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="pattern-bg text-white px-4 pt-8 pb-6">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
              <ChevronLeft size={16} /> Dashboard
            </button>
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Memorization</h1>
              <p className="text-emerald-200 text-sm mt-1">
                {memorizedCount} surahs · {totalVerses} verses memorized
              </p>
            </div>
            <Link href={`/child/${childId}/mushaf-reader`}>
              <button className="flex items-center gap-1.5 text-xs text-amber-200 border border-amber-200/40 bg-white/10 px-3 py-1.5 rounded-full mt-1 shrink-0">
                <BookOpen size={12} /> Full Quran
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Today's Work banner */}
        {newMem && (
          <Card className={cn(
            "border",
            todayMemStatus === "completed"
              ? "border-emerald-500/40 bg-emerald-50/60"
              : "border-primary/30 bg-primary/5"
          )}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0",
                    todayMemStatus === "completed"
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-primary/15 text-primary"
                  )}>
                    {newMem.surahNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {todayMemStatus === "completed" ? (
                        <p className="text-xs font-semibold text-emerald-700">Today's Work · ✓ Completed</p>
                      ) : todayMemStatus === "in_progress" ? (
                        <p className="text-xs font-semibold text-primary">Today's Work · In Progress</p>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-primary">Today's Work</p>
                          {newMem.pageStart !== undefined && (
                            <span className="text-xs text-muted-foreground">· Page {newMem.pageStart}</span>
                          )}
                        </>
                      )}
                    </div>
                    {todayMemStatus === "in_progress" ? (
                      <>
                        <p className="text-sm font-medium text-foreground truncate">
                          {newMem.surahName} · Ayah {newMem.ayahStart}–{todayProgress?.memCompletedAyahEnd ?? newMem.ayahStart} done of {newMem.ayahStart}–{newMem.ayahEnd}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, memPct))}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-foreground truncate">
                        {newMem.surahName} · Ayah {newMem.ayahStart}–{newMem.ayahEnd}
                      </p>
                    )}
                  </div>
                </div>
                <div className={cn("flex gap-2 shrink-0", todayMemStatus === "completed" && "opacity-50")}>
                  <button
                    onClick={() => {
                      if (todaysSurahId !== undefined) {
                        setStudyingInitialAyah((newMem.ayahStart ?? 1) - 1);
                        setStudyingSurahId(todaysSurahId);
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-primary font-medium border border-primary px-2.5 py-1.5 rounded-full whitespace-nowrap"
                  >
                    <ListOrdered size={12} /> Ayah by Ayah
                  </button>
                  <Link href={`/child/${childId}/quran-memorize?surah=${newMem.surahNumber}&mode=mushaf&fromAyah=${newMem.ayahStart}&toAyah=${newMem.ayahEnd}`}>
                    <button className="flex items-center gap-1 text-xs text-white font-medium bg-primary px-2.5 py-1.5 rounded-full whitespace-nowrap">
                      <BookOpen size={12} /> Full Mushaf
                    </button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Up Next banner — only shown when next surah differs from today's work */}
        {showUpNext && nextSurah && (
          <Card className="border-border bg-muted/20">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {nextSurah.number}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Up Next</p>
                  <p className="text-sm font-medium text-foreground">{nextSurah.nameTransliteration}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setStudyingInitialAyah(0); setStudyingSurahId(nextSurah.id); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground font-medium border border-border px-2.5 py-1.5 rounded-full whitespace-nowrap"
                >
                  <ListOrdered size={12} /> Ayah by Ayah
                </button>
                <Link href={`/child/${childId}/quran-memorize?surah=${nextSurah.number}&mode=mushaf`}>
                  <button className="flex items-center gap-1 text-xs text-foreground font-medium bg-muted px-2.5 py-1.5 rounded-full whitespace-nowrap">
                    <BookOpen size={12} /> Full Mushaf
                  </button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter tabs */}
        <div className="bg-white rounded-2xl border border-border p-1 flex gap-1 shadow-sm overflow-x-auto">
          {(["all", "today", "not_started", "in_progress", "memorized"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 text-xs py-2 px-2 rounded-xl font-medium whitespace-nowrap transition-colors",
                filter === f
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? "All"
                : f === "today" ? "Today"
                : f === "not_started" ? "Not Started"
                : f === "in_progress" ? "In Progress"
                : "Memorized"}
            </button>
          ))}
        </div>

        {/* Surah list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProgress.map((item) => {
              const surahMeta = surahs.find((s) => s.id === item.surahId);
              const isExpanded = expandedSurahId === item.surahId;
              const memorizedAyahs: number[] = item.memorizedAyahs ?? [];
              const range = getConsecutiveRange(memorizedAyahs);
              const barColor = getStatusColor(item.status, item.percentComplete);

              return (
                <Card key={item.surahId} className="border-border overflow-hidden">
                  {/* Colored progress bar at top */}
                  <div className="h-1.5 w-full bg-muted">
                    <div
                      className={cn("h-full transition-all", barColor)}
                      style={{ width: `${Math.max(item.percentComplete, item.status === "memorized" ? 100 : 0)}%` }}
                    />
                  </div>

                  <CardContent className="p-3">
                    {/* Main row */}
                    <button
                      className="w-full flex items-center gap-3 text-left"
                      onClick={() =>
                        setExpandedSurahId(isExpanded ? null : item.surahId)
                      }
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/10 flex-shrink-0">
                        {surahMeta?.number ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{item.surahName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.status === "memorized"
                            ? `All ${item.totalVerses} ayahs ✓`
                            : item.status === "in_progress" && range
                            ? `Ayahs ${range.start}–${range.end} done · ${item.totalVerses} total`
                            : `${item.totalVerses} ayahs`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="arabic-text text-base text-primary">{surahMeta?.nameArabic}</p>
                        <ChevronRight
                          size={14}
                          className={cn(
                            "text-muted-foreground transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </div>
                    </button>

                    {/* Expanded: ayah circles + actions */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Tap an ayah to mark it memorized
                        </p>
                        <AyahCircles
                          totalVerses={item.totalVerses}
                          memorizedAyahs={memorizedAyahs}
                          onToggle={(ayah) => handleToggleAyah(item, ayah)}
                          isPending={toggleAyahMutation.isPending}
                        />
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 flex-1 border-primary text-primary"
                            onClick={() => { setStudyingInitialAyah(0); setStudyingSurahId(item.surahId); }}
                          >
                            <ListOrdered size={11} className="mr-1" /> Ayah by Ayah
                          </Button>
                          <Link href={`/child/${childId}/quran-memorize?surah=${surahMeta?.number}&mode=mushaf`}>
                            <Button size="sm" className="h-7 text-xs px-2 flex-1">
                              <BookOpen size={11} className="mr-1" /> Full Mushaf
                            </Button>
                          </Link>
                        </div>
                        {item.status !== "memorized" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2 w-full mt-2"
                            onClick={() => handleMarkAllDone(item)}
                            disabled={toggleAyahMutation.isPending}
                          >
                            <CheckCircle size={11} className="mr-1" /> Mark All Done
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
