import { useState } from "react";
import { useParams, Link } from "wouter";
import { useListSurahs, useListMemorization } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Badge, Input } from "@/components/ui-elements";
import { Search, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { motion } from "framer-motion";

export default function Memorize() {
  const { childId } = useParams();
  const id = parseInt(childId || "0");
  const [search, setSearch] = useState("");

  const { data: surahsData, isLoading: surahsLoading } = useListSurahs();
  const { data: memData, isLoading: memLoading } = useListMemorization(id);

  const isLoading = surahsLoading || memLoading;

  // Merge surahs with progress
  const surahs = surahsData?.surahs || [];
  const progressMap = new Map(memData?.progress?.map(p => [p.surahId, p]) || []);

  const filteredSurahs = surahs.filter(s => 
    s.nameTransliteration.toLowerCase().includes(search.toLowerCase()) || 
    s.nameTranslation.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusIcon = (status?: string) => {
    switch(status) {
      case 'memorized': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress': return <Clock className="w-5 h-5 text-accent" />;
      case 'needs_review': return <Clock className="w-5 h-5 text-orange-500" />;
      default: return <CircleDashed className="w-5 h-5 text-muted-foreground/30" />;
    }
  };

  return (
    <Layout childId={id} title="Memorization (Hifz)">
      <div className="py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            className="pl-10 bg-white" 
            placeholder="Search surahs..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3 pt-4">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-secondary animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filteredSurahs.map((surah, index) => {
              const progress = progressMap.get(surah.id);
              const percent = progress ? (progress.versesMemorized / surah.verseCount) * 100 : 0;
              
              return (
                <motion.div
                  key={surah.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.5) }}
                >
                  <Link href={`/child/${id}/surah/${surah.id}`}>
                    <Card className="p-4 hover:border-primary/40 cursor-pointer transition-all hover:shadow-lg active:scale-[0.98]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-bold text-primary border border-primary/10">
                            {surah.number}
                          </div>
                          <div>
                            <h3 className="font-bold font-display">{surah.nameTransliteration}</h3>
                            <p className="text-xs text-muted-foreground">{surah.nameTranslation} • {surah.verseCount} Ayahs</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="font-arabic text-xl text-primary">{surah.nameArabic}</span>
                          <div className="mt-1">
                            {getStatusIcon(progress?.status)}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <div className="mt-2 text-[10px] text-right text-muted-foreground font-semibold">
                        {progress?.versesMemorized || 0} / {surah.verseCount} Memorized
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
