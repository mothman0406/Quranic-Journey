import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReviews, completeReview, getSurah } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { ChevronLeft, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";

const QUALITY_LABELS = ["Forgot completely", "Serious errors", "Correct with difficulty", "Correct with hesitation", "Good", "Perfect"];
const QUALITY_COLORS = ["bg-red-100 text-red-700", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-emerald-200 text-emerald-800"];

export default function ReviewPage() {
  const { childId } = useParams<{ childId: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showVerses, setShowVerses] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", childId],
    queryFn: () => listReviews(parseInt(childId))
  });

  const dueToday = data?.dueToday || [];
  const currentItem = dueToday[currentIndex];
  const surahId = currentItem?.surahId;

  const { data: surahData } = useQuery({
    queryKey: ["surah", surahId],
    queryFn: () => getSurah(surahId!),
    enabled: !!surahId
  });

  const reviewMutation = useMutation({
    mutationFn: (quality: number) => completeReview(parseInt(childId), { surahId: currentItem!.surahId, qualityRating: quality, durationMinutes: 5 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", childId] });
      setRating(null);
      setShowVerses(false);
      if (currentIndex >= dueToday.length - 1) {
        setSessionDone(true);
      } else {
        setCurrentIndex(i => i + 1);
      }
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (sessionDone || dueToday.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">{sessionDone ? "🏆" : "✅"}</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{sessionDone ? "Review Complete!" : "All Caught Up!"}</h2>
          <p className="text-muted-foreground mb-2">
            {sessionDone ? `Great job! You reviewed ${dueToday.length} surah${dueToday.length > 1 ? "s" : ""} today.` : "No surahs due for review today. Keep memorizing!"}
          </p>
          <p className="text-xs text-muted-foreground mb-6">Consistent review is the key to strong memorization.</p>
          <Link href={`/child/${childId}`}><Button className="w-full rounded-full">Back to Dashboard</Button></Link>
        </div>
        <ChildNav childId={childId} />
      </div>
    );
  }

  const surah = surahData;
  const verses = surah?.verses || [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Dashboard</button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Review Session</h1>
              <p className="text-emerald-200 text-sm mt-1">{currentIndex + 1} of {dueToday.length} • {dueToday.length - currentIndex - 1} remaining</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
              <RefreshCw size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {currentItem && (
          <>
            {/* Overdue notice */}
            {currentItem.isOverdue && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-3 flex items-center gap-2">
                  <AlertCircle size={14} className="text-orange-600" />
                  <p className="text-xs text-orange-700">This surah was due on {currentItem.dueDate} — let's catch up!</p>
                </CardContent>
              </Card>
            )}

            {/* Surah to review */}
            <Card className="verse-card shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-lg text-foreground">{currentItem.surahName}</p>
                    <p className="text-xs text-muted-foreground">Surah {currentItem.surahNumber} · Due {currentItem.dueDate}</p>
                  </div>
                  <p className="arabic-text text-3xl text-primary">{surah?.nameArabic}</p>
                </div>

                <div className="bg-muted/50 rounded-xl p-3 mb-4 text-center">
                  <p className="text-sm text-muted-foreground">Recite this surah from memory, then rate yourself below</p>
                </div>

                {/* Show verses toggle */}
                <Button variant="outline" className="w-full mb-3" onClick={() => setShowVerses(!showVerses)}>
                  {showVerses ? "Hide Verses" : "Show Verses (if needed)"}
                </Button>

                {showVerses && verses.map(verse => (
                  <div key={verse.number} className="mb-3 pb-3 border-b border-border last:border-0">
                    <p className="arabic-text text-xl text-foreground text-right mb-1" dir="rtl">{verse.arabic}</p>
                    <p className="text-xs text-primary italic">{verse.transliteration}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">"{verse.translation}"</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Rate yourself */}
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-3">How was your recitation?</p>
                <div className="space-y-2 mb-4">
                  {[0, 1, 2, 3, 4, 5].map(q => (
                    <button key={q} onClick={() => setRating(q)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border ${rating === q ? "border-primary bg-primary/5 scale-[1.01]" : "border-transparent hover:bg-muted"}`}>
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${rating === q ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{q}</div>
                      <span className={`text-xs ${QUALITY_COLORS[q]} px-2 py-0.5 rounded-full`}>{QUALITY_LABELS[q]}</span>
                    </button>
                  ))}
                </div>
                <Button className="w-full" disabled={rating === null || reviewMutation.isPending}
                  onClick={() => rating !== null && reviewMutation.mutate(rating)}>
                  <CheckCircle size={14} className="mr-1" />
                  {reviewMutation.isPending ? "Saving..." : "Submit Review"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Upcoming */}
        {(data?.upcoming || []).length > 0 && (
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-3">Upcoming Reviews</p>
              <div className="space-y-2">
                {(data?.upcoming || []).slice(0, 5).map(item => (
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
