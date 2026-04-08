import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSurahs, listMemorization, updateMemorization } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { ChevronLeft, CheckCircle, Clock, BookOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700" },
  memorized: { label: "Memorized ✓", color: "bg-emerald-100 text-emerald-700" },
  needs_review: { label: "Needs Review", color: "bg-orange-100 text-orange-700" }
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "text-emerald-600",
  intermediate: "text-amber-600",
  advanced: "text-rose-600"
};

export default function MemorizePage() {
  const { childId } = useParams<{ childId: string }>();
  const [filter, setFilter] = useState<"all" | "memorized" | "in_progress" | "not_started">("all");
  const qc = useQueryClient();

  const { data: surahsData } = useQuery({
    queryKey: ["surahs"],
    queryFn: () => listSurahs()
  });

  const { data: progressData, isLoading } = useQuery({
    queryKey: ["memorization", childId],
    queryFn: () => listMemorization(parseInt(childId))
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { surahId: number; status: string; versesMemorized: number }) =>
      updateMemorization(parseInt(childId), { surahId: vars.surahId, status: vars.status as "memorized", versesMemorized: vars.versesMemorized }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memorization", childId] })
  });

  const progress = progressData?.progress || [];
  const surahs = surahsData?.surahs || [];

  const filteredProgress = filter === "all"
    ? progress
    : progress.filter(p => p.status === filter);

  const memorizedCount = progress.filter(p => p.status === "memorized").length;
  const totalVerses = progress.reduce((s, p) => s + p.versesMemorized, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Dashboard</button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">Memorization Track</h1>
              <p className="text-emerald-200 text-sm mt-1">{memorizedCount} surahs · {totalVerses} verses memorized</p>
            </div>
            <Link href={`/child/${childId}/quran-memorize`}>
              <button className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/20">
                <Layers size={13} />
                Full Quran
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Filter tabs */}
        <div className="bg-white rounded-2xl border border-border p-1 flex gap-1 shadow-sm overflow-x-auto">
          {(["all", "not_started", "in_progress", "memorized"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("flex-1 text-xs py-2 px-2 rounded-xl font-medium whitespace-nowrap transition-colors",
                filter === f ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}>
              {f === "all" ? "All" : f === "not_started" ? "Not Started" : f === "in_progress" ? "In Progress" : "Memorized"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {filteredProgress.map((item) => {
              const surahMeta = surahs.find(s => s.id === item.surahId);
              const statusInfo = STATUS_LABELS[item.status];
              return (
                <Card key={item.surahId} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/10">
                          {surahMeta?.number || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{item.surahName}</p>
                          <p className={cn("text-xs font-medium", DIFFICULTY_COLORS[surahMeta?.difficulty || "beginner"])}>
                            {surahMeta?.difficulty} · {item.totalVerses} verses
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="arabic-text text-lg text-primary">{surahMeta?.nameArabic}</p>
                        <Badge className={cn("text-[10px] mt-1 border-0", statusInfo.color)}>{statusInfo.label}</Badge>
                      </div>
                    </div>

                    <Progress value={item.percentComplete} className="h-2 mb-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{item.versesMemorized}/{item.totalVerses} verses</span>
                      <div className="flex gap-2">
                        <Link href={`/surah/${item.surahId}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                            <BookOpen size={11} className="mr-1" /> Study
                          </Button>
                        </Link>
                        {item.status !== "memorized" && (
                          <Button size="sm" className="h-7 text-xs px-2"
                            onClick={() => updateMutation.mutate({ surahId: item.surahNumber, status: "memorized", versesMemorized: item.totalVerses })}>
                            <CheckCircle size={11} className="mr-1" /> Mark Done
                          </Button>
                        )}
                      </div>
                    </div>
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
