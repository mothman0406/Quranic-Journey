import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChildDashboard, getSurah, updateMemorization } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { VersePlayer } from "@/components/verse-player";
import { ChevronLeft, CheckCircle, ChevronRight, Info } from "lucide-react";

export default function LessonPage() {
  const { childId } = useParams<{ childId: string }>();
  const [verseIndex, setVerseIndex] = useState(0);
  const [showTajweed, setShowTajweed] = useState(false);
  const [rating, setRating] = useState(0);
  const [completed, setCompleted] = useState(false);
  const qc = useQueryClient();

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", childId],
    queryFn: () => getChildDashboard(parseInt(childId))
  });

  const nextSurah = dashboard?.nextSurah;
  const surahId = nextSurah?.id;

  const { data: surahData, isLoading: surahLoading } = useQuery({
    queryKey: ["surah", surahId],
    queryFn: () => getSurah(surahId!),
    enabled: !!surahId
  });

  const saveMutation = useMutation({
    mutationFn: () => updateMemorization(parseInt(childId), { surahId: surahId!, versesMemorized: verseIndex + 1, qualityRating: rating || 3 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memorization", childId] });
      qc.invalidateQueries({ queryKey: ["dashboard", childId] });
      setCompleted(true);
    }
  });

  const isLoading = dashLoading || surahLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  const surah = surahData;
  const verses = surah?.verses || [];
  const currentVerse = verses[verseIndex];

  if (completed) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🌟</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Masha'Allah!</h2>
          <p className="text-muted-foreground mb-2">Great work on today's lesson!</p>
          <p className="text-sm text-muted-foreground mb-6">You learned {verseIndex + 1} verse{verseIndex > 0 ? "s" : ""} of {surah?.nameTransliteration}</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setCompleted(false); setVerseIndex(0); }}>Continue</Button>
            <Link href={`/child/${childId}`} className="flex-1"><Button className="w-full">Back to Dashboard</Button></Link>
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
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Dashboard</button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Today's Lesson</h1>
              {surah && <p className="text-emerald-200 text-sm mt-1">{surah.nameTransliteration} · {verses.length} verses</p>}
            </div>
            {surah && <p className="arabic-text text-3xl text-amber-300">{surah.nameArabic}</p>}
          </div>
          {verses.length > 0 && (
            <div className="mt-3">
              <Progress value={((verseIndex + 1) / verses.length) * 100} className="h-2 bg-white/20" />
              <p className="text-xs text-emerald-200 mt-1">Verse {verseIndex + 1} of {verses.length}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {!surah ? (
          <Card className="border-border"><CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No lesson planned for today. Check back tomorrow!</p>
          </CardContent></Card>
        ) : (
          <>
            {/* Tajweed Info */}
            {surah.tajweedNotes && surah.tajweedNotes.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-3">
                  <button className="flex items-center gap-2 w-full text-left" onClick={() => setShowTajweed(!showTajweed)}>
                    <Info size={14} className="text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">Tajweed Notes for {surah.nameTransliteration}</span>
                    <ChevronRight size={12} className={`text-amber-600 ml-auto transition-transform ${showTajweed ? "rotate-90" : ""}`} />
                  </button>
                  {showTajweed && (
                    <ul className="mt-2 space-y-1">
                      {surah.tajweedNotes.map((note, i) => (
                        <li key={i} className="text-xs text-amber-700 flex items-start gap-1"><span>•</span><span>{note}</span></li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Current verse with audio */}
            {currentVerse && (
              <Card className="verse-card shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="secondary" className="text-xs">Verse {currentVerse.number}</Badge>
                    <Badge variant="outline" className="text-xs text-primary border-primary/30">
                      {surah.nameTransliteration}
                    </Badge>
                  </div>

                  {/* Audio player with word highlighting — key forces full remount on verse change */}
                  <div className="py-4 border-y border-border/50 mb-4">
                    <VersePlayer
                      key={`${surah.number}-${currentVerse.number}`}
                      arabic={currentVerse.arabic}
                      surahNumber={surah.number}
                      verseNumber={currentVerse.number}
                      size="lg"
                    />
                  </div>

                  {/* Transliteration */}
                  <div className="text-center mb-3">
                    <p className="text-sm text-primary font-medium italic">{currentVerse.transliteration}</p>
                  </div>

                  {/* Translation */}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">"{currentVerse.translation}"</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tafsir */}
            {surah.tafsirBrief && (
              <Card className="border-border bg-emerald-50/50">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-primary mb-1">💡 Meaning of This Surah</p>
                  <p className="text-sm text-foreground leading-relaxed">{surah.tafsirBrief}</p>
                </CardContent>
              </Card>
            )}

            {/* Rate and save */}
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-2">How well did the recitation go?</p>
                <div className="flex gap-2 mb-4">
                  {[1,2,3,4,5].map(r => (
                    <button key={r} onClick={() => setRating(r)}
                      className={`flex-1 py-2 rounded-xl text-lg transition-all ${rating >= r ? "bg-amber-100 scale-105" : "bg-muted"}`}>
                      ⭐
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {verseIndex < verses.length - 1 ? (
                    <Button variant="outline" className="flex-1" onClick={() => { setVerseIndex(v => v + 1); setRating(0); }}>
                      Next Verse <ChevronRight size={14} className="ml-1" />
                    </Button>
                  ) : null}
                  <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <CheckCircle size={14} className="mr-1" />
                    {saveMutation.isPending ? "Saving..." : "Save Progress"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* All verses */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground px-1">All Verses</h3>
              {verses.map((verse, i) => (
                <button key={verse.number} onClick={() => { setVerseIndex(i); setRating(0); }} className="w-full text-left">
                  <Card className={`border transition-colors ${i === verseIndex ? "border-primary bg-primary/5" : "border-border"}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === verseIndex ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{verse.number}</div>
                      <p className="arabic-text text-base text-foreground truncate flex-1" dir="rtl">{verse.arabic}</p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
