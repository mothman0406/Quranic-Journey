import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getChildDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChildNav } from "@/components/child-nav";
import { ChevronLeft, ChevronRight, Star, Heart, Trophy, BookOpen, Settings } from "lucide-react";

export default function MorePage() {
  const { childId } = useParams<{ childId: string }>();

  const { data } = useQuery({
    queryKey: ["dashboard", childId],
    queryFn: () => getChildDashboard(parseInt(childId)),
  });

  const child = data?.child;
  const showStories = !child?.hideStories;
  const showDuas = !child?.hideDuas;

  const sections = [
    showStories && {
      label: "Stories",
      subtitle: "Islamic stories for your learning journey",
      icon: Star,
      color: "bg-blue-100",
      iconColor: "text-blue-600",
      href: `/child/${childId}/stories`,
    },
    showDuas && {
      label: "Du'aas",
      subtitle: "Essential supplications to learn and practise",
      icon: Heart,
      color: "bg-rose-100",
      iconColor: "text-rose-600",
      href: `/child/${childId}/duas`,
    },
    {
      label: "Progress & Stats",
      subtitle: "Streaks, achievements, and weekly activity",
      icon: Trophy,
      color: "bg-amber-100",
      iconColor: "text-amber-600",
      href: `/child/${childId}/progress`,
    },
    {
      label: "Learning Plan",
      subtitle: "Curriculum, goals, and tajweed rules",
      icon: BookOpen,
      color: "bg-teal-100",
      iconColor: "text-teal-600",
      href: `/child/${childId}/plan`,
    },
    {
      label: "Settings",
      subtitle: "Dark mode, themes, recite mode, and more",
      icon: Settings,
      color: "bg-slate-100",
      iconColor: "text-slate-600",
      href: `/child/${childId}/settings`,
    },
  ].filter(Boolean) as {
    label: string;
    subtitle: string;
    icon: typeof Star;
    color: string;
    iconColor: string;
    href: string;
  }[];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
              <ChevronLeft size={16} /> Dashboard
            </button>
          </Link>
          <h1 className="text-xl font-bold">More</h1>
          <p className="text-emerald-200 text-sm mt-1">Stories, du'aas, and your learning journey</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-3">
        {sections.map(({ label, subtitle, icon: Icon, color, iconColor, href }) => (
          <Link key={label} href={href}>
            <Card className="cursor-pointer hover:shadow-md transition-all border-border active:scale-[0.99]">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={22} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}

        {!showStories && !showDuas && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Stories and du'aas are hidden. A parent can re-enable them from the profiles page.
          </p>
        )}
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}
