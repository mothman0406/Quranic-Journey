import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getStory } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { ChevronLeft, Clock, MessageSquare, BookOpen } from "lucide-react";

export default function StoryDetailPage() {
  const { childId, storyId } = useParams<{ childId: string; storyId: string }>();

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", storyId],
    queryFn: () => getStory(parseInt(storyId))
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!story) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-14">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}/stories`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Stories</button>
          </Link>
          <Badge className="bg-white/20 text-white border-0 mb-2">{story.category}</Badge>
          <h1 className="text-xl font-bold text-white">{story.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-emerald-200 text-xs flex items-center gap-1"><Clock size={11} />{story.readingTimeMinutes} min read</span>
            <span className="text-emerald-200 text-xs">· {story.featuredCharacter}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Story content */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
              {story.content.split('\n\n').map((para, i) => (
                <p key={i} className="mb-4 text-sm leading-relaxed text-foreground">{para}</p>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Morals */}
        {story.morals.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">💡 Lessons from this Story</p>
              <ul className="space-y-1">
                {story.morals.map((moral, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{moral}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Related surahs */}
        {story.relatedSurahs.length > 0 && (
          <Card className="border-border bg-emerald-50/50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-2"><BookOpen size={14} /> Related Surahs</p>
              <div className="flex flex-wrap gap-2">
                {story.relatedSurahs.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Discussion questions */}
        {story.discussionQuestions.length > 0 && (
          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><MessageSquare size={14} className="text-primary" /> Talk About It</p>
              <p className="text-xs text-muted-foreground mb-3">Discuss these questions with your child after reading:</p>
              <div className="space-y-3">
                {story.discussionQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-sm text-foreground">{q}</p>
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
