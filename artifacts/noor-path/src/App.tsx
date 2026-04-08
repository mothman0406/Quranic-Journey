import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSession } from "@/lib/auth-client";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ChildDashboard from "@/pages/child-dashboard";
import MemorizationPage from "@/pages/memorization";
import ReviewPage from "@/pages/review";
import MorePage from "@/pages/more";
import StoriesPage from "@/pages/stories";
import StoryDetailPage from "@/pages/story-detail";
import DuasPage from "@/pages/duas";
import ProgressPage from "@/pages/progress";
import PlanPage from "@/pages/plan";
import SurahDetailPage from "@/pages/surah-detail";
import MushafPage from "@/pages/mushaf";
import QuranMemorizePage from "@/pages/quran-memorize";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 }
  }
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!session?.user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (session?.user) return <Redirect to="/" />;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={() => <PublicOnlyRoute component={LoginPage} />} />
      <Route path="/register" component={() => <PublicOnlyRoute component={RegisterPage} />} />
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/child/:childId" component={() => <ProtectedRoute component={ChildDashboard} />} />
      <Route path="/child/:childId/memorization" component={() => <ProtectedRoute component={MemorizationPage} />} />
      <Route path="/child/:childId/review" component={() => <ProtectedRoute component={ReviewPage} />} />
      <Route path="/child/:childId/more" component={() => <ProtectedRoute component={MorePage} />} />
      <Route path="/child/:childId/stories" component={() => <ProtectedRoute component={StoriesPage} />} />
      <Route path="/child/:childId/stories/:storyId" component={() => <ProtectedRoute component={StoryDetailPage} />} />
      <Route path="/child/:childId/duas" component={() => <ProtectedRoute component={DuasPage} />} />
      <Route path="/child/:childId/progress" component={() => <ProtectedRoute component={ProgressPage} />} />
      <Route path="/child/:childId/plan" component={() => <ProtectedRoute component={PlanPage} />} />
      <Route path="/surah/:surahId" component={() => <ProtectedRoute component={SurahDetailPage} />} />
      <Route path="/mushaf" component={() => <ProtectedRoute component={MushafPage} />} />
      <Route path="/child/:childId/quran-memorize" component={() => <ProtectedRoute component={QuranMemorizePage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
