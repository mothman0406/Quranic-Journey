import { Link, useLocation } from "wouter";
import { BookOpen, RefreshCw, BookMarked, Star, Heart, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Lesson", icon: BookOpen, path: "lesson" },
  { label: "Memorize", icon: BookMarked, path: "memorize" },
  { label: "Review", icon: RefreshCw, path: "review" },
  { label: "Stories", icon: Star, path: "stories" },
  { label: "Du'aas", icon: Heart, path: "duas" },
];

export function ChildNav({ childId }: { childId: string }) {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-lg z-50 bottom-nav-safe">
      <div className="flex items-stretch max-w-lg mx-auto">
        {navItems.map(({ label, icon: Icon, path }) => {
          const href = `/child/${childId}/${path}`;
          const isActive = location.includes(`/${path}`);
          return (
            <Link key={path} href={href} className="flex-1">
              <div className={cn(
                "flex flex-col items-center justify-center py-2 px-1 transition-colors min-h-[56px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}>
                <div className={cn(
                  "rounded-full p-1.5 transition-colors",
                  isActive && "bg-primary/10"
                )}>
                  <Icon size={20} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium mt-0.5",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
