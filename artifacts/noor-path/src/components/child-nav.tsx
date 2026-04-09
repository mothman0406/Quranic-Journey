import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { listReviews } from "@workspace/api-client-react";
import { House, BookMarked, RefreshCw, Grid2X2, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/use-dark-mode";

const navItems = [
  { label: "Home",          icon: House,      path: "" },
  { label: "Memorization",  icon: BookMarked, path: "memorization" },
  { label: "Review",        icon: RefreshCw,  path: "review" },
  { label: "More",          icon: Grid2X2,    path: "more" },
];

export function ChildNav({ childId }: { childId: string }) {
  const [location] = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const { data: reviews } = useQuery({
    queryKey: ["reviews", childId],
    queryFn: () => listReviews(parseInt(childId)),
    staleTime: 60_000
  });

  const reviewsDue = reviews?.dueToday?.length ?? 0;
  const base = `/child/${childId}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-border dark:border-gray-700 shadow-lg z-50 bottom-nav-safe">
      <div className="flex items-stretch max-w-lg mx-auto">
        {navItems.map(({ label, icon: Icon, path }) => {
          const href = path ? `${base}/${path}` : base;
          // Home tab: exact match only; others: prefix match
          const isActive = path === ""
            ? location === base || location === `${base}/`
            : location.startsWith(`${base}/${path}`);
          const showBadge = path === "review" && reviewsDue > 0;

          return (
            <Link key={path || "home"} href={href} className="flex-1">
              <div className={cn(
                "flex flex-col items-center justify-center py-2 px-1 transition-colors min-h-[56px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <div className={cn(
                  "relative rounded-full p-1.5 transition-colors",
                  isActive && "bg-primary/10"
                )}>
                  <Icon size={20} />
                  {showBadge && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                      {reviewsDue > 9 ? "9+" : reviewsDue}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium mt-0.5",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>{label}</span>
              </div>
            </Link>
          );
        })}
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex flex-col items-center justify-center py-2 px-1 min-h-[56px] text-muted-foreground hover:text-foreground transition-colors"
          title={isDarkMode ? "Light mode" : "Dark mode"}
        >
          <div className="rounded-full p-1.5">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </div>
          <span className="text-[10px] font-medium mt-0.5">{isDarkMode ? "Light" : "Dark"}</span>
        </button>
      </div>
    </nav>
  );
}
