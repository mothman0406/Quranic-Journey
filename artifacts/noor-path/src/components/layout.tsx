import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, BookOpen, Star, Trophy, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backTo?: string;
  childId?: number;
  hideNav?: boolean;
}

export function Layout({ children, title, showBack, backTo, childId, hideNav }: LayoutProps) {
  const [location] = useLocation();

  const navItems = childId ? [
    { label: "Home", icon: Home, path: `/child/${childId}` },
    { label: "Memorize", icon: BookOpen, path: `/child/${childId}/memorize` },
    { label: "Review", icon: Star, path: `/child/${childId}/review` },
    { label: "Progress", icon: Trophy, path: `/child/${childId}/progress` },
  ] : [];

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Header */}
      {(title || showBack) && (
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <Link href={backTo || (childId ? `/child/${childId}` : "/")} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors text-foreground/80">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            {title && <h1 className="text-xl font-bold text-foreground font-display">{title}</h1>}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 overflow-y-auto pb-24", !title && !showBack && "pt-6")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="h-full px-4 md:px-6"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      {!hideNav && childId && (
        <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-border/50 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl">
          <div className="flex items-center justify-around p-2">
            {navItems.map((item) => {
              const isActive = location === item.path || (item.path !== `/child/${childId}` && location.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path} className="relative flex flex-col items-center p-3 w-16">
                  <div className={cn(
                    "p-2 rounded-2xl transition-all duration-300 relative z-10",
                    isActive ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 -translate-y-1" : "text-muted-foreground hover:bg-secondary"
                  )}>
                    <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold mt-1 transition-all duration-300",
                    isActive ? "text-primary opacity-100 translate-y-0" : "text-muted-foreground opacity-70 translate-y-1"
                  )}>
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-primary/5 rounded-3xl -z-0 scale-125"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
