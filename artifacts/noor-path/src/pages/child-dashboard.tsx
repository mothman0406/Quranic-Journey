import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getChildDashboard, listReviews } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { Flame, Star, BookOpen, RefreshCw, ChevronLeft, Trophy, Heart, BookMarked } from "lucide-react";

export default function ChildDashboard() {
  const { childId } = useParams<{ childId: string }>();

  const getTodayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const todayLocal = getTodayLocal();
  const datedSessionKey = `child-${childId}-review-session-${todayLocal}`;
  const legacySessionKey = `child-${childId}-review-session`;
  const reviewSession = (() => {
    try {
      const stored = localStorage.getItem(datedSessionKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === todayLocal) return parsed;
      }
    } catch {}

    try {
      const stored = localStorage.getItem(legacySessionKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed.date !== todayLocal) return null;
      return parsed;
    } catch { return null; }
  })();
  const reviewSessionDone = reviewSession?.sessionDone === true;
  const reviewSessionTotal = reviewSession?.sessionTotal as number | undefined;
  const reviewSessionCompleted = (reviewSession?.completedItemsData as any[] | undefined)?.length ?? 0;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", childId],
    queryFn: () => getChildDashboard(parseInt(childId))
  });

  const { data: reviewsData } = useQuery({
    queryKey: ["reviews", childId],
    queryFn: () => listReviews(parseInt(childId)),
    staleTime: 0
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pattern-bg h-48" />
        <div className="max-w-lg mx-auto px-4 -mt-8 space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { child, todaysPlan, memorizationStats, achievements, nextSurah } = data;
  const reviewsDueToday = reviewsData?.dueToday?.length ?? data.reviewsDueToday;
  type TodayProgress = {
    memStatus: "not_started" | "in_progress" | "completed";
    memTargetAyahStart: number | null;
    memTargetAyahEnd: number | null;
    memCompletedAyahEnd: number | null;
    reviewStatus: "not_started" | "in_progress" | "completed";
    reviewTargetCount: number | null;
    reviewCompletedCount: number;
  };
  const todayProgress = (data as { todayProgress?: TodayProgress } | undefined)?.todayProgress;
  const hasReviewWorkToday =
    reviewsDueToday > 0 ||
    todayProgress?.reviewStatus === "completed" ||
    (todayProgress?.reviewCompletedCount ?? 0) > 0;
  const reviewTotalForToday =
    todayProgress?.reviewTargetCount != null
      ? todayProgress.reviewTargetCount
      : reviewsData !== undefined && todayProgress?.reviewCompletedCount != null
      ? (reviewsData.dueToday?.length ?? 0) + todayProgress.reviewCompletedCount
      : reviewsDueToday;
  const todaysMem = todaysPlan.newMemorization as
    | {
        surahName: string;
        ayahStart: number;
        ayahEnd: number;
        workType?: "new_memorization" | "cumulative_block" | "cumulative_full" | "final_surah_test";
        workLabel?: string;
        isReviewOnly?: boolean;
      }
    | undefined;
  const earned = achievements.filter(a => a.earned).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="pattern-bg text-white px-4 pt-8 pb-14">
        <div className="max-w-lg mx-auto">
          <Link href="/">
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
              <ChevronLeft size={16} /> All Profiles
            </button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-3xl border border-white/20">
              {child.avatarEmoji}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{child.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-orange-300 text-sm"><Flame size={13} /><b>{child.streakDays}</b> day streak</span>
                <span className="flex items-center gap-1 text-amber-300 text-sm"><Star size={13} /><b>{child.totalPoints}</b> pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-8 space-y-4">
        {/* Today's Plan */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Today's Plan</h2>
              <Badge variant="secondary" className="text-xs">{todaysPlan.totalEstimatedMinutes} min</Badge>
            </div>
            <div className="space-y-2">
              {todaysMem && (
                <Link href={`/child/${childId}/memorization`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"><BookMarked size={16} className="text-primary" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{todaysMem.workLabel ?? "New Memorization"}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {todayProgress?.memStatus === "completed" ? (
                          <p className="text-xs text-muted-foreground">{todaysMem.surahName} · ✓ Completed</p>
                        ) : todayProgress?.memStatus === "in_progress" ? (
                          <p className="text-xs text-muted-foreground">{todaysMem.surahName} · In Progress</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{todaysMem.surahName} · Ayah {todaysMem.ayahStart}–{todaysMem.ayahEnd}</p>
                        )}
                        {todayProgress?.memStatus === "in_progress" && (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">In Progress</span>
                        )}
                      </div>
                    </div>
                    {todayProgress?.memStatus === "completed" ? (
                      <span className="text-xs text-emerald-600 font-semibold">✓ Completed</span>
                    ) : todayProgress?.memStatus === "in_progress" ? (
                      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        In Progress
                      </span>
                    ) : (
                      <span className="text-xs text-primary font-medium">Start →</span>
                    )}
                  </div>
                </Link>
              )}
              {hasReviewWorkToday && (
                <Link href={`/child/${childId}/review`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center"><RefreshCw size={16} className="text-amber-600" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Review Session</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {reviewSessionDone ? (
                          <p className="text-xs text-muted-foreground">{reviewSessionTotal ?? reviewSessionCompleted}/{reviewSessionTotal ?? reviewSessionCompleted} surahs done</p>
                        ) : reviewsData !== undefined && todayProgress?.reviewCompletedCount != null && todayProgress.reviewCompletedCount > 0 ? (
                          <p className="text-xs text-muted-foreground">{todayProgress.reviewCompletedCount}/{Math.max(reviewTotalForToday, todayProgress.reviewCompletedCount)} surahs done</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{reviewsDueToday} surah{reviewsDueToday > 1 ? "s" : ""} to review today</p>
                        )}
                        {todayProgress?.reviewStatus === "in_progress" && (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">In Progress</span>
                        )}
                      </div>
                    </div>
                    {reviewSessionDone || todayProgress?.reviewStatus === "completed" ? (
                      <span className="text-xs text-emerald-600 font-semibold">✓ Completed</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">Review →</span>
                    )}
                  </div>
                </Link>
              )}
              {todaysPlan.story && (
                <Link href={`/child/${childId}/stories/${todaysPlan.story.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><Star size={16} className="text-blue-600" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Today's Story</p>
                      <p className="text-xs text-muted-foreground">{todaysPlan.story.title}</p>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">Read →</span>
                  </div>
                </Link>
              )}
              {todaysPlan.dua && (
                <Link href={`/child/${childId}/duas`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center"><Heart size={16} className="text-rose-600" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Today's Du'a</p>
                      <p className="text-xs text-muted-foreground arabic-text text-sm">{todaysPlan.dua.arabic}</p>
                    </div>
                    <span className="text-xs text-rose-600 font-medium">Learn →</span>
                  </div>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{memorizationStats.totalSurahsMemorized}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Surahs</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{memorizationStats.totalVersesMemorized}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Verses</p>
          </CardContent></Card>
          <Card className="border-border"><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-rose-500">{earned}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Badges</p>
          </CardContent></Card>
        </div>

        {/* Achievements */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> Achievements</h2>
              <Link href={`/child/${childId}/progress`}><span className="text-xs text-primary">View All</span></Link>
            </div>
            <div className="space-y-3">
              {achievements.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${a.earned ? "bg-amber-100" : "bg-muted"}`}>{a.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-medium ${a.earned ? "text-foreground" : "text-muted-foreground"}`}>{a.title}</p>
                      {a.earned && <Badge className="text-[10px] bg-amber-500 text-white h-4">Earned!</Badge>}
                    </div>
                    {!a.earned && a.target && (
                      <Progress value={((a.progress || 0) / a.target) * 100} className="h-1.5 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next surah */}
        {nextSurah && (
          <Card className="border-border">
            <CardContent className="p-4">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><BookOpen size={16} className="text-primary" /> Next to Memorize</h2>
              <Link href={`/child/${childId}/memorization`}>
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{nextSurah.number}</div>
                    <div>
                      <p className="font-medium text-sm">{nextSurah.nameTransliteration}</p>
                      <p className="text-xs text-muted-foreground">{nextSurah.nameTranslation} · {nextSurah.verseCount} verses</p>
                    </div>
                  </div>
                  <p className="arabic-text text-xl text-primary">{nextSurah.nameArabic}</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/child/${childId}/progress`}>
            <Card className="cursor-pointer hover:shadow-sm transition-shadow border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center"><Trophy size={18} className="text-purple-600" /></div>
                <div><p className="text-sm font-medium">Progress</p><p className="text-xs text-muted-foreground">View stats</p></div>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/child/${childId}/plan`}>
            <Card className="cursor-pointer hover:shadow-sm transition-shadow border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center"><BookOpen size={18} className="text-teal-600" /></div>
                <div><p className="text-sm font-medium">Learning Plan</p><p className="text-xs text-muted-foreground">View curriculum</p></div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
