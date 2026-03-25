import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getChildDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { ChevronLeft, Flame, Trophy, Star, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function ProgressPage() {
  const { childId } = useParams<{ childId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", childId],
    queryFn: () => getChildDashboard(parseInt(childId))
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { child, memorizationStats, achievements } = data;
  const earned = achievements.filter(a => a.earned);
  const notEarned = achievements.filter(a => !a.earned);

  const weekData = memorizationStats.weeklyProgress.map(w => ({
    name: w.day,
    verses: w.versesMemorized,
    minutes: w.minutesPracticed
  }));

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Dashboard</button>
          </Link>
          <h1 className="text-xl font-bold">{child.name}'s Progress</h1>
          <p className="text-emerald-200 text-sm mt-1">In sha Allah, every step counts</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={16} className="text-orange-500" />
                <span className="text-xs text-muted-foreground">Current Streak</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{child.streakDays}</p>
              <p className="text-xs text-muted-foreground">days in a row</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Star size={16} className="text-amber-500" />
                <span className="text-xs text-muted-foreground">Total Points</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{child.totalPoints}</p>
              <p className="text-xs text-muted-foreground">points earned</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={16} className="text-primary" />
                <span className="text-xs text-muted-foreground">Surahs Memorized</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{memorizationStats.totalSurahsMemorized}</p>
              <p className="text-xs text-muted-foreground">{memorizationStats.totalVersesMemorized} total verses</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={16} className="text-amber-600" />
                <span className="text-xs text-muted-foreground">Badges Earned</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{earned.length}</p>
              <p className="text-xs text-muted-foreground">of {achievements.length} total</p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly chart */}
        <Card className="border-border">
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              📊 This Week's Activity
            </h2>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="minutes" fill="hsl(152, 55%, 25%)" radius={[4, 4, 0, 0]} name="Minutes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">Minutes practiced per day</p>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card className="border-border">
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" /> Achievements
            </h2>

            {earned.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Earned</p>
                <div className="space-y-3">
                  {earned.map(a => (
                    <div key={a.id} className="flex items-center gap-3 bg-amber-50 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">{a.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                      </div>
                      <Badge className="ml-auto bg-amber-500 text-white text-[10px] border-0">✓</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notEarned.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">In Progress</p>
                <div className="space-y-3">
                  {notEarned.map(a => (
                    <div key={a.id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl opacity-40">{a.icon}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                        {a.target && (
                          <div className="mt-1.5">
                            <Progress value={((a.progress || 0) / a.target) * 100} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground mt-0.5">{a.progress || 0} / {a.target}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
