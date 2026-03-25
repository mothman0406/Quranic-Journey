import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ChildDashboard from "@/pages/child-dashboard";
import MemorizePage from "@/pages/memorize";
import ReviewPage from "@/pages/review";
import LessonPage from "@/pages/lesson";
import StoriesPage from "@/pages/stories";
import StoryDetailPage from "@/pages/story-detail";
import DuasPage from "@/pages/duas";
import ProgressPage from "@/pages/progress";
import PlanPage from "@/pages/plan";
import SurahDetailPage from "@/pages/surah-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/child/:childId" component={ChildDashboard} />
      <Route path="/child/:childId/memorize" component={MemorizePage} />
      <Route path="/child/:childId/review" component={ReviewPage} />
      <Route path="/child/:childId/lesson" component={LessonPage} />
      <Route path="/child/:childId/stories" component={StoriesPage} />
      <Route path="/child/:childId/stories/:storyId" component={StoryDetailPage} />
      <Route path="/child/:childId/duas" component={DuasPage} />
      <Route path="/child/:childId/progress" component={ProgressPage} />
      <Route path="/child/:childId/plan" component={PlanPage} />
      <Route path="/surah/:surahId" component={SurahDetailPage} />
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
