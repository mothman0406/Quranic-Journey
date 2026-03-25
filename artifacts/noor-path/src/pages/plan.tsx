import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getChildPlan } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import { ChevronLeft, Target, BookOpen, Calendar, Star } from "lucide-react";

export default function PlanPage() {
  const { childId } = useParams<{ childId: string }>();

  const { data: plan, isLoading } = useQuery({
    queryKey: ["plan", childId],
    queryFn: () => getChildPlan(parseInt(childId))
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const AGE_GROUP_LABELS: Record<string, string> = {
    toddler: "Seeds of Faith (Ages 3–6)",
    child: "Building Foundation (Ages 7–10)",
    preteen: "Deepening Knowledge (Ages 11–14)",
    teen: "Path to Hifz (Ages 15+)"
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4"><ChevronLeft size={16} /> Dashboard</button>
          </Link>
          <h1 className="text-xl font-bold">Learning Plan</h1>
          <p className="text-emerald-200 text-sm mt-1">{AGE_GROUP_LABELS[plan.ageGroup]}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
        {/* Description */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-foreground leading-relaxed">{plan.description}</p>
          </CardContent>
        </Card>

        {/* Current phase */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-primary" />
              <h2 className="font-semibold text-foreground">Current Phase</h2>
            </div>
            <Badge className="bg-primary/15 text-primary border-0 mb-2">{plan.currentPhase.phaseName}</Badge>
            <p className="text-sm text-foreground mb-3">{plan.currentPhase.description}</p>
            <div className="flex flex-wrap gap-1">
              {plan.currentPhase.surahs.map(s => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly goals */}
        <Card className="border-border">
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-primary" /> Weekly Goals
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-primary/5 rounded-xl">
                <p className="text-2xl font-bold text-primary">{plan.weeklyGoal.memorizationDays}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Memorization days</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-xl">
                <p className="text-2xl font-bold text-amber-600">{plan.weeklyGoal.reviewDays}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Review days</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{plan.weeklyGoal.storyDays}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Story days</p>
              </div>
              <div className="text-center p-3 bg-rose-50 rounded-xl">
                <p className="text-2xl font-bold text-rose-500">{plan.weeklyGoal.duasDays}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Du'a practice days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card className="border-border">
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Star size={16} className="text-amber-500" /> Milestones
            </h2>
            <div className="space-y-3">
              {plan.milestones.map((m: { id: string; title: string; description: string; targetSurahs: string[]; reward: string }) => (
                <div key={m.id} className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/50">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-sm text-foreground">{m.title}</p>
                    <span className="text-sm">{m.reward.split(" ")[0]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{m.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {m.targetSurahs.map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 mt-2 font-medium">🎁 {m.reward}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tajweed rules */}
        <Card className="border-border">
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <BookOpen size={16} className="text-primary" /> Tajweed Rules for This Level
            </h2>
            <div className="space-y-3">
              {plan.tajweedRules.map((rule: { rule: string; description: string; ageIntroduced: number }) => (
                <div key={rule.rule} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">
                    {rule.ageIntroduced}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{rule.rule}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                    <p className="text-[10px] text-primary mt-1">Introduced at age {rule.ageIntroduced}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
