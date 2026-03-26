import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getSurah } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { VersePlayer } from "@/components/verse-player";
import { ChevronLeft, Info } from "lucide-react";

export default function SurahDetailPage() {
  const { surahId } = useParams<{ surahId: string }>();
  const [, setLocation] = useLocation();
  const [showTajweed, setShowTajweed] = useState(false);

  const { data: surah, isLoading } = useQuery({
    queryKey: ["surah", parseInt(surahId)],
    queryFn: () => getSurah(parseInt(surahId))
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-8">
        <div className="pattern-bg h-44" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!surah) return null;

  const DIFFICULTY_COLORS: Record<string, string> = {
    beginner: "bg-emerald-100 text-emerald-700",
    intermediate: "bg-amber-100 text-amber-700",
    advanced: "bg-rose-100 text-rose-700"
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="pattern-bg text-white px-4 pt-8 pb-14">
        <div className="max-w-lg mx-auto">
          <button onClick={() => setLocation(-1 as unknown as string)} className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
            <ChevronLeft size={16} /> Back
          </button>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-emerald-200 text-xs font-medium mb-1">Surah {surah.number}</p>
              <h1 className="text-2xl font-bold text-white">{surah.nameTransliteration}</h1>
              <p className="text-emerald-200 text-sm">{surah.nameTranslation} · {surah.verseCount} verses</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`border-0 text-[10px] ${DIFFICULTY_COLORS[surah.difficulty]}`}>{surah.difficulty}</Badge>
                <Badge className="border-0 bg-white/20 text-white text-[10px]">{surah.revelationType}</Badge>
              </div>
            </div>
            <p className="arabic-text text-5xl text-amber-300">{surah.nameArabic}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-8 space-y-4">
        {/* Tafsir brief */}
        {surah.tafsirBrief && (
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">💡 About This Surah</p>
              <p className="text-sm text-amber-800 leading-relaxed">{surah.tafsirBrief}</p>
            </CardContent>
          </Card>
        )}

        {/* Tajweed notes */}
        {surah.tajweedNotes && surah.tajweedNotes.length > 0 && (
          <Card className="border-border">
            <CardContent className="p-3">
              <button className="flex items-center gap-2 w-full text-left" onClick={() => setShowTajweed(!showTajweed)}>
                <Info size={14} className="text-primary" />
                <span className="text-xs font-medium text-foreground">Tajweed Notes</span>
                <span className="text-xs text-primary ml-auto">{showTajweed ? "Hide" : "Show"}</span>
              </button>
              {showTajweed && (
                <ul className="mt-2 space-y-1 pt-2 border-t border-border">
                  {surah.tajweedNotes.map((note: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1"><span className="text-primary">•</span>{note}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bismillah header (except Al-Fatihah which includes it, and Al-Tawbah) */}
        {surah.number !== 9 && (
          <div className="text-center py-2">
            <p className="arabic-text text-3xl text-primary">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
            <p className="text-xs text-muted-foreground mt-1 italic">Bismillahir-rahmanir-raheem</p>
          </div>
        )}

        {/* Verses with audio */}
        <div className="space-y-3">
          {surah.verses.map((verse: { number: number; arabic: string; transliteration: string; translation: string }) => (
            <Card key={verse.number} className="verse-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-full border-2 border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                    {verse.number}
                  </div>
                </div>

                {/* Audio player with word highlighting */}
                <VersePlayer
                  arabic={verse.arabic}
                  surahNumber={surah.number}
                  verseNumber={verse.number}
                  size="md"
                />

                {/* Transliteration */}
                <p className="text-sm text-primary font-medium italic text-center mt-3 mb-2">{verse.transliteration}</p>

                {/* Translation */}
                <p className="text-sm text-muted-foreground text-center leading-relaxed">"{verse.translation}"</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
