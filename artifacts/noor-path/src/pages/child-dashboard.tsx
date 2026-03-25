import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Star, Flame, Trophy, Play, Book, HeartHandshake, Map } from "lucide-react";
import { useGetChildDashboard } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button, Badge } from "@/components/ui-elements";

export default function ChildDashboard() {
  const params = useParams();
  const childId = parseInt(params.childId || "0");
  
  const { data: dashboard, isLoading, error } = useGetChildDashboard(childId, { query: { retry: false } });

  if (isLoading) return <Layout childId={childId}><div className="py-20 text-center animate-pulse"><div className="w-16 h-16 bg-secondary rounded-full mx-auto mb-4" /><div className="h-6 w-32 bg-secondary rounded mx-auto" /></div></Layout>;
  if (error || !dashboard) return <Layout childId={childId}><div className="py-20 text-center">Failed to load dashboard. <Link href="/" className="text-primary underline mt-4 block">Go back</Link></div></Layout>;

  const { child, todaysPlan, memorizationStats, reviewsDueToday } = dashboard;

  return (
    <Layout childId={childId}>
      <div className="py-6 space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-4xl shadow-inner border-2 border-white">
            {child.avatarEmoji}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Salam, {child.name}!</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              Ready to learn today? <Star className="w-4 h-4 text-accent fill-accent" />
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-sm flex flex-col items-center justify-center">
            <Flame className="w-6 h-6 text-orange-500 mb-1" />
            <div className="text-xl font-bold text-orange-700">{child.streakDays}</div>
            <div className="text-[10px] uppercase tracking-wider text-orange-600/80 font-bold">Day Streak</div>
          </Card>
          <Card className="p-3 text-center bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm flex flex-col items-center justify-center">
            <Book className="w-6 h-6 text-green-600 mb-1" />
            <div className="text-xl font-bold text-green-700">{memorizationStats.totalSurahsMemorized}</div>
            <div className="text-[10px] uppercase tracking-wider text-green-600/80 font-bold">Surahs</div>
          </Card>
          <Card className="p-3 text-center bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 shadow-sm flex flex-col items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-500 mb-1" />
            <div className="text-xl font-bold text-yellow-700">{child.totalPoints}</div>
            <div className="text-[10px] uppercase tracking-wider text-yellow-600/80 font-bold">Points</div>
          </Card>
        </div>

        {/* Today's Plan */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold">Today's Journey</h2>
            <Link href={`/child/${childId}/plan`}>
              <Badge variant="default" className="flex items-center gap-1 cursor-pointer"><Map className="w-3 h-3"/> View Plan</Badge>
            </Link>
          </div>

          <div className="space-y-4">
            {/* New Memorization */}
            {todaysPlan.newMemorization && (
              <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <Card className="bg-primary text-primary-foreground border-none relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Book className="w-24 h-24" />
                  </div>
                  <div className="relative z-10">
                    <Badge className="bg-white/20 text-white border-none mb-3">New Lesson</Badge>
                    <h3 className="text-2xl font-bold mb-1">{todaysPlan.newMemorization.surahName}</h3>
                    <p className="text-primary-foreground/80 mb-4">Ayahs {todaysPlan.newMemorization.ayahStart}-{todaysPlan.newMemorization.ayahEnd} • ~{todaysPlan.newMemorization.estimatedMinutes} mins</p>
                    <Link href={`/child/${childId}/surah/1` /* mock ID */}>
                      <Button className="w-full bg-white text-primary hover:bg-white/90">
                        <Play className="w-4 h-4 mr-2" fill="currentColor" /> Start Lesson
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Reviews */}
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
              <Card className="flex items-center p-4">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mr-4">
                  <Star className="w-6 h-6 text-accent fill-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">Review Time</h3>
                  <p className="text-sm text-muted-foreground">{reviewsDueToday > 0 ? `${reviewsDueToday} surahs need review today` : "All caught up! Great job."}</p>
                </div>
                <Link href={`/child/${childId}/review`}>
                  <Button variant={reviewsDueToday > 0 ? "accent" : "outline"} size="sm">{reviewsDueToday > 0 ? "Review" : "Check"}</Button>
                </Link>
              </Card>
            </motion.div>

            {/* Story Time */}
            {todaysPlan.story && (
              <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                <Card className="flex items-center p-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mr-4">
                    <Book className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">Story Time</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{todaysPlan.story.title}</p>
                  </div>
                  <Link href={`/child/${childId}/stories/${todaysPlan.story.id}`}>
                    <Button variant="outline" size="sm">Read</Button>
                  </Link>
                </Card>
              </motion.div>
            )}

            {/* Daily Dua */}
            {todaysPlan.dua && (
              <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                <Card className="flex items-center p-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mr-4">
                    <HeartHandshake className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">Daily Dua</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1 font-arabic" dir="rtl">{todaysPlan.dua.arabic}</p>
                  </div>
                  <Link href={`/child/${childId}/duas`}>
                    <Button variant="outline" size="sm">Learn</Button>
                  </Link>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
