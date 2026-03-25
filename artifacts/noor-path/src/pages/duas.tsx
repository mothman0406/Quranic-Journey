import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listChildDuas, markDuaLearned } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { Link } from "wouter";
import { ChevronLeft, CheckCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Du'aas",
  morning: "Morning",
  evening: "Evening",
  eating: "Eating",
  sleeping: "Sleeping",
  travel: "Travel",
  general: "General",
  prayer: "Prayer"
};

const IMPORTANCE_COLORS: Record<string, string> = {
  essential: "bg-emerald-100 text-emerald-700",
  important: "bg-blue-100 text-blue-700",
  recommended: "bg-purple-100 text-purple-700"
};

export default function DuasPage() {
  const { childId } = useParams<{ childId: string }>();
  const [category, setCategory] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["duas", childId],
    queryFn: () => listChildDuas(parseInt(childId))
  });

  const learnMutation = useMutation({
    mutationFn: ({ duaId, learned }: { duaId: number; learned: boolean }) =>
      markDuaLearned(parseInt(childId), { duaId, learned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duas", childId] })
  });

  const duas = data?.duas || [];
  const filtered = category === "all" ? duas : duas.filter(d => d.dua.category === category);
  const learnedCount = duas.filter(d => d.learned).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Dashboard</button>
          </Link>
          <h1 className="text-xl font-bold">Du'aas to Learn</h1>
          <p className="text-emerald-200 text-sm mt-1">{learnedCount} of {duas.length} learned</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Category filter */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max">
            {Object.keys(CATEGORY_LABELS).map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                  category === c ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/50"
                )}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ dua, learned, practicedCount }) => {
              const isExpanded = expandedId === dua.id;
              return (
                <Card key={dua.id} className={cn("border transition-all", learned ? "border-emerald-200 bg-emerald-50/30" : "border-border")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn("text-[10px] border-0", IMPORTANCE_COLORS[dua.importance])}>{dua.importance}</Badge>
                          <span className="text-[10px] text-muted-foreground">{dua.occasion}</span>
                        </div>
                      </div>
                      <button onClick={() => learnMutation.mutate({ duaId: dua.id, learned: !learned })}
                        className={cn("flex-shrink-0 transition-colors", learned ? "text-emerald-500" : "text-muted-foreground")}>
                        {learned ? <CheckCircle size={20} /> : <Circle size={20} />}
                      </button>
                    </div>

                    {/* Arabic */}
                    <p className="arabic-text text-2xl text-foreground text-right mb-2 leading-loose" dir="rtl">{dua.arabic}</p>

                    <button className="w-full text-left" onClick={() => setExpandedId(isExpanded ? null : dua.id)}>
                      <p className="text-xs text-primary italic mb-1">{dua.transliteration}</p>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <p className="text-sm text-muted-foreground">"{dua.translation}"</p>
                          <p className="text-xs text-muted-foreground mt-2"><span className="font-medium">Source:</span> {dua.source}</p>
                          {practicedCount > 0 && <p className="text-xs text-primary mt-1">Practiced {practicedCount} times</p>}
                        </div>
                      )}
                    </button>

                    {!isExpanded && <p className="text-xs text-muted-foreground truncate">"{dua.translation}"</p>}

                    <button onClick={() => setExpandedId(isExpanded ? null : dua.id)}
                      className="text-xs text-primary mt-2 font-medium">
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
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
