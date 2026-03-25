import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { listStories } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { ChevronLeft, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  prophet: "bg-emerald-100 text-emerald-700",
  companion: "bg-blue-100 text-blue-700",
  quran: "bg-amber-100 text-amber-700",
  moral: "bg-purple-100 text-purple-700"
};

const CATEGORY_LABELS: Record<string, string> = {
  prophet: "Prophets",
  companion: "Companions",
  quran: "Quran Stories",
  moral: "Moral Stories"
};

const CATEGORY_EMOJIS: Record<string, string> = {
  prophet: "🌟",
  companion: "⚔️",
  quran: "📖",
  moral: "💎"
};

export default function StoriesPage() {
  const { childId } = useParams<{ childId: string }>();
  const [category, setCategory] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["stories", category],
    queryFn: () => listStories(category !== "all" ? { category: category as "prophet" | "companion" | "quran" | "moral" } : undefined)
  });

  const stories = data?.stories || [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Dashboard</button>
          </Link>
          <h1 className="text-xl font-bold">Islamic Stories</h1>
          <p className="text-emerald-200 text-sm mt-1">Stories of prophets, companions & wisdom</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Category filters */}
        <div className="bg-white rounded-2xl border border-border p-1 flex gap-1 shadow-sm overflow-x-auto">
          {["all", "prophet", "companion", "quran", "moral"].map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn("flex-1 text-xs py-2 px-2 rounded-xl font-medium whitespace-nowrap transition-colors",
                category === c ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}>
              {c === "all" ? "All" : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        ) : stories.length === 0 ? (
          <Card className="border-border"><CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No stories found for this category.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {stories.map(story => (
              <Link key={story.id} href={`/child/${childId}/stories/${story.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-all border-border active:scale-[0.99]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                        {CATEGORY_EMOJIS[story.category]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm text-foreground">{story.title}</h3>
                          <ChevronRight size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn("text-[10px] border-0", CATEGORY_COLORS[story.category])}>{story.category}</Badge>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock size={9} />{story.readingTimeMinutes} min</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{story.summary}</p>
                        {story.morals.length > 0 && (
                          <p className="text-[10px] text-primary mt-1.5 font-medium">💡 {story.morals[0]}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
