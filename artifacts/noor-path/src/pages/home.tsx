import { useState, useRef, useEffect } from "react";
import { CelebrationOverlay } from "@/components/celebration-overlay";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { signOut, useSession } from "@/lib/auth-client";
import { listChildren, updateChild, listSurahs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Plus, Flame, Star, BookOpen, ChevronRight, ChevronLeft, Check, Book, Settings, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const AVATARS = ["⭐", "🌙", "☀️", "🌸", "🌿", "🦋", "🌟", "🕊️", "🌺", "💎"];

const AGE_GROUP_LABELS: Record<string, string> = {
  toddler: "Ages 3–6 · Seeds of Faith",
  child: "Ages 7–10 · Building Foundation",
  preteen: "Ages 11–14 · Deepening Knowledge",
  teen: "Ages 15+ · Path to Hifz"
};

const PRACTICE_OPTIONS = [
  { value: 10, label: "10 min", desc: "Light — just getting started" },
  { value: 20, label: "20 min", desc: "Regular — steady progress" },
  { value: 30, label: "30 min", desc: "Focused — strong progress" },
  { value: 45, label: "45 min", desc: "Intensive — fast track" },
];

type InitialSurahLevel = "very_strong" | "solid" | "learning" | "just_started";

type InitialSurahSetup = {
  surahId: number;
  level: InitialSurahLevel;
  knownAyahCount: number | null;
};

const SURAH_LEVEL_OPTIONS: Array<{
  value: InitialSurahLevel;
  label: string;
  desc: string;
}> = [
  {
    value: "very_strong",
    label: "Very Strong",
    desc: "Review as green",
  },
  {
    value: "solid",
    label: "Solid",
    desc: "Review as green",
  },
  {
    value: "learning",
    label: "Learning",
    desc: "Review as orange",
  },
  {
    value: "just_started",
    label: "Just Started",
    desc: "Memorization only",
  },
];

type OnboardingForm = {
  name: string;
  age: string;
  gender: "male" | "female";
  avatarEmoji: string;
  initialSurahSetups: InitialSurahSetup[];
  practiceMinutesPerDay: number;
  memorizePagePerDay: number;
  reviewPagesPerDay: number;
};

const DEFAULT_FORM: OnboardingForm = {
  name: "",
  age: "",
  gender: "male",
  avatarEmoji: "⭐",
  initialSurahSetups: [],
  practiceMinutesPerDay: 20,
  memorizePagePerDay: 1.0,
  reviewPagesPerDay: 2.0,
};

const STEP_LABELS = ["Basic Info", "Memorization", "Strength", "Goals"];

export default function Home() {
  const [showAdd, setShowAdd] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(DEFAULT_FORM);
  const [settingsChildId, setSettingsChildId] = useState<number | null>(null);
  const [deleteChildId, setDeleteChildId] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeTo, setRangeTo] = useState<number | null>(null);
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: session } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: () => listChildren()
  });

  const { data: surahsData, isLoading: surahsLoading } = useQuery({
    queryKey: ["surahs"],
    queryFn: () => listSurahs(),
    enabled: showAdd,
  });
  const allSurahs = (surahsData?.surahs ?? []).slice().sort((a, b) => a.recommendedOrder - b.recommendedOrder);

  const createMutation = useMutation({
    mutationFn: () => fetch("/api/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        age: parseInt(form.age),
        gender: form.gender,
        avatarEmoji: form.avatarEmoji,
        initialSurahSetups: form.initialSurahSetups.map((setup) => ({
          surahId: setup.surahId,
          level: setup.level,
          knownAyahCount: setup.knownAyahCount,
        })),
        practiceMinutesPerDay: form.practiceMinutesPerDay,
        memorizePagePerDay: form.memorizePagePerDay,
        reviewPagesPerDay: form.reviewPagesPerDay,
      })
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      setShowAdd(false);
      setStep(1);
      setForm(DEFAULT_FORM);
    }
  });

  const children = data?.children || [];
  const settingsChild = children.find((c) => c.id === settingsChildId);

  const toggleMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: number; field: "hideStories" | "hideDuas"; value: boolean }) =>
      updateChild(id, { [field]: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
  });

  const selfCreateMutation = useMutation({
    mutationFn: () => fetch("/api/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: session?.user?.name || session?.user?.email?.split("@")[0] || "Me",
        age: 18,
        gender: "male",
        avatarEmoji: "⭐",
        initialSurahSetups: [],
        practiceMinutesPerDay: 20,
        memorizePagePerDay: 1.0,
        reviewPagesPerDay: 2.0,
      })
    }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["children"] });
      navigate(`/child/${data.id}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (childId: number) => fetch(`/api/children/${childId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      setDeleteChildId(null);
    }
  });

  const [customMemorizePage, setCustomMemorizePage] = useState("");
  const [streakCelebration, setStreakCelebration] = useState<{ message: string; subMessage?: string } | null>(null);
  const streakShownRef = useRef(false);

  useEffect(() => {
    if (streakShownRef.current) return;
    if (!children || children.length === 0) return;
    for (const child of children) {
      if (child.streakDays === 7 || child.streakDays === 30) {
        setStreakCelebration({
          message: `${child.streakDays} Day Streak! 🔥`,
          subMessage: "Consistency is key to memorization",
        });
        streakShownRef.current = true;
        break;
      }
    }
  }, [children]);

  const selectedSurahIds = form.initialSurahSetups.map((setup) => setup.surahId);
  const selectedSurahSetups = allSurahs
    .filter((surah) => selectedSurahIds.includes(surah.id))
    .map((surah) => ({
      surah,
      setup: form.initialSurahSetups.find((entry) => entry.surahId === surah.id)!,
    }));
  const levelCounts = form.initialSurahSetups.reduce(
    (counts, setup) => {
      counts[setup.level] += 1;
      return counts;
    },
    {
      very_strong: 0,
      solid: 0,
      learning: 0,
      just_started: 0,
    } satisfies Record<InitialSurahLevel, number>,
  );

  const canProceedStep1 = form.name.trim().length > 0 && form.age.length > 0 && parseInt(form.age) >= 3;
  const canProceedStep3 = form.initialSurahSetups.every((setup) => {
    const surah = allSurahs.find((entry) => entry.id === setup.surahId);
    if (!surah) return false;
    const knownAyahCount = setup.knownAyahCount ?? surah.verseCount;
    if (!Number.isInteger(knownAyahCount) || knownAyahCount < 1 || knownAyahCount > surah.verseCount) return false;
    if (setup.level === "just_started" && knownAyahCount >= surah.verseCount) return false;
    return true;
  });

  function toggleSurah(id: number) {
    const surah = allSurahs.find((entry) => entry.id === id);
    setForm(f => ({
      ...f,
      initialSurahSetups: f.initialSurahSetups.some((setup) => setup.surahId === id)
        ? f.initialSurahSetups.filter((setup) => setup.surahId !== id)
        : [...f.initialSurahSetups, { surahId: id, level: "solid", knownAyahCount: surah?.verseCount ?? 1 }]
    }));
  }

  function applyRange() {
    if (rangeFrom === null || rangeTo === null) return;
    const fromIndex = allSurahs.findIndex((surah) => surah.number === rangeFrom);
    const toIndex = allSurahs.findIndex((surah) => surah.number === rangeTo);
    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const inRange = allSurahs.slice(start, end + 1).map((surah) => surah.id);
    setForm(f => ({
      ...f,
      initialSurahSetups: [
        ...f.initialSurahSetups,
        ...inRange
          .filter((surahId) => !f.initialSurahSetups.some((setup) => setup.surahId === surahId))
          .map((surahId) => {
            const surah = allSurahs.find((entry) => entry.id === surahId);
            return { surahId, level: "solid" as const, knownAyahCount: surah?.verseCount ?? 1 };
          }),
      ]
    }));
  }

  function updateSurahLevel(surahId: number, level: InitialSurahLevel) {
    const surah = allSurahs.find((entry) => entry.id === surahId);
    setForm((current) => ({
      ...current,
      initialSurahSetups: current.initialSurahSetups.map((setup) =>
        setup.surahId === surahId
          ? {
              ...setup,
              level,
              knownAyahCount: setup.knownAyahCount ?? surah?.verseCount ?? 1,
            }
          : setup,
      ),
    }));
  }

  function updateKnownAyahCount(surahId: number, nextValue: string) {
    const surah = allSurahs.find((entry) => entry.id === surahId);
    setForm((current) => ({
      ...current,
      initialSurahSetups: current.initialSurahSetups.map((setup) =>
        setup.surahId === surahId
          ? {
              ...setup,
              knownAyahCount: nextValue === ""
                ? null
                : Math.max(1, Math.min(Math.floor(Number(nextValue)), surah?.verseCount ?? Number.MAX_SAFE_INTEGER)),
            }
          : setup,
      ),
    }));
  }

  function applyLevelToAll(level: InitialSurahLevel) {
    setForm((current) => ({
      ...current,
      initialSurahSetups: current.initialSurahSetups.map((setup) => ({
        ...setup,
        level,
        knownAyahCount: setup.knownAyahCount,
      })),
    }));
  }

  function handleNext() {
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (form.initialSurahSetups.length > 0) { setStep(3); } else { setStep(4); }
      return;
    }
    if (step === 3 && !canProceedStep3) return;
    if (step === 3) { setStep(4); return; }
    if (step === 4) { setStep(5); return; }
    if (step === 5) { createMutation.mutate(); return; }
  }

  function handleBack() {
    if (step === 4 && form.initialSurahSetups.length === 0) { setStep(2); return; }
    if (step === 5) { setStep(4); return; }
    setStep(s => s - 1);
  }

  const displayStep = step <= 3 ? step : form.initialSurahSetups.length > 0 ? step : step - 1;
  const displayTotal = form.initialSurahSetups.length > 0 ? 5 : 4;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="pattern-bg text-white px-4 pt-12 pb-16">
        <div className="max-w-lg mx-auto text-center">
          <p className="arabic-text text-4xl mb-2 text-amber-200">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          <h1 className="text-2xl font-bold mt-3 text-white">NoorPath</h1>
          <p className="text-emerald-200 text-sm mt-1">Your path to the Quran — one verse at a time</p>
          {session?.user && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="text-emerald-200 text-xs">{session.user.email}</span>
              <button
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
                className="text-xs text-white/70 hover:text-white underline underline-offset-2"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-8 pb-12">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : children.length === 0 ? (
          <div className="space-y-3">
            {showWelcome ? (
              <Card className="text-center border-border shadow-md">
                <CardContent className="py-10 px-6">
                  <div className="text-5xl mb-4">🌙</div>
                  <h2 className="text-xl font-bold text-foreground mb-1">Welcome to NoorPath</h2>
                  <p className="text-muted-foreground mb-6 text-sm leading-relaxed">Who is this app for?</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => selfCreateMutation.mutate()}
                      disabled={selfCreateMutation.isPending}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <span className="text-3xl">🧑</span>
                      <div>
                        <p className="font-semibold text-foreground">It's for me</p>
                        <p className="text-xs text-muted-foreground mt-0.5">I'm learning the Quran for myself</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setShowWelcome(false); setShowAdd(true); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <span className="text-3xl">👶</span>
                      <div>
                        <p className="font-semibold text-foreground">It's for a child</p>
                        <p className="text-xs text-muted-foreground mt-0.5">I'm setting this up for my child</p>
                      </div>
                    </button>
                  </div>
                  {selfCreateMutation.isPending && (
                    <p className="text-xs text-muted-foreground mt-4">Setting up your profile…</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center border-border shadow-md">
                <CardContent className="py-12 px-6">
                  <div className="text-6xl mb-4">📖</div>
                  <h2 className="text-xl font-bold text-foreground mb-2">Begin the Journey</h2>
                  <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                    Add a profile to receive a personalized Quran and Islamic learning plan — from the very first surah all the way to completing the Quran, in sha Allah.
                  </p>
                  <Button onClick={() => setShowAdd(true)} className="rounded-full px-8">
                    <Plus size={16} className="mr-2" /> Add Your First Profile
                  </Button>
                </CardContent>
              </Card>
            )}

            <Link href="/mushaf">
              <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/60 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-200/60 flex items-center justify-center flex-shrink-0 shadow-inner">
                    <Book size={22} className="text-amber-800" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 text-sm">Read Quran</p>
                    <p className="text-xs text-amber-700 mt-0.5">Mushaf-style — page by page, 604 pages</p>
                  </div>
                  <ChevronRight size={16} className="text-amber-600 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          </div>
        ) : (
          <>
            {/* Profiles header — fixed alignment */}
            <div className="bg-background rounded-2xl shadow-md px-4 py-3 mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-base">Profiles</h2>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                <Plus size={13} /> Add Profile
              </button>
            </div>

            <div className="space-y-3">
              {children.map((child) => (
                <div key={child.id} className="relative">
                  <Link href={`/child/${child.id}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-all border-border active:scale-[0.99]">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner border border-primary/10">
                            {child.avatarEmoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-foreground">{child.name}</h3>
                              <ChevronRight size={16} className="text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{AGE_GROUP_LABELS[child.ageGroup]}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-1 text-xs text-orange-500">
                                <Flame size={11} /><span className="font-bold">{child.streakDays}</span><span className="text-muted-foreground">streak</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <Star size={11} /><span className="font-bold">{child.totalPoints}</span><span className="text-muted-foreground">pts</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-primary">
                                <BookOpen size={11} /><span className="font-bold">{child.juzCompleted}</span><span className="text-muted-foreground">juz</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  {/* Settings button — outside the Link so it doesn't navigate */}
                  <button
                    onClick={(e) => { e.preventDefault(); setSettingsChildId(child.id); }}
                    className="absolute top-3 right-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
                    title="Profile settings"
                  >
                    <Settings size={14} />
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.preventDefault(); setDeleteChildId(child.id); }}
                    className="absolute top-3 right-[4.5rem] p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors z-10"
                    title="Delete profile"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Read Quran (Mushaf) entry */}
            <Link href="/mushaf">
              <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/60 hover:shadow-md transition-all cursor-pointer active:scale-[0.99] mt-5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-200/60 flex items-center justify-center flex-shrink-0 shadow-inner">
                    <Book size={22} className="text-amber-800" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 text-sm">Read Quran</p>
                    <p className="text-xs text-amber-700 mt-0.5">Mushaf-style — page by page, 604 pages</p>
                  </div>
                  <ChevronRight size={16} className="text-amber-600 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Card className="border-border"><CardContent className="p-4 text-center"><div className="text-2xl mb-2">📿</div><p className="text-xs font-semibold">Smart Review</p><p className="text-xs text-muted-foreground mt-1">Spaced repetition keeps memorization strong</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-4 text-center"><div className="text-2xl mb-2">🎯</div><p className="text-xs font-semibold">Ability-Based Progress</p><p className="text-xs text-muted-foreground mt-1">Advance at your own pace, not by age</p></CardContent></Card>
            </div>
          </>
        )}
      </div>

      {/* Per-child content settings dialog (parent only) */}
      <Dialog open={settingsChildId !== null} onOpenChange={(open) => { if (!open) setSettingsChildId(null); }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-base">
              {settingsChild?.name}'s Content Settings
            </DialogTitle>
          </DialogHeader>
          {settingsChild && (
            <div className="space-y-4 pt-1">
              <p className="text-xs text-muted-foreground">
                Toggle which content types appear in this profile. These can be changed any time.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium">Stories</p>
                    <p className="text-xs text-muted-foreground">Islamic stories in the More tab</p>
                  </div>
                  <Switch
                    checked={!settingsChild.hideStories}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: settingsChild.id, field: "hideStories", value: !checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium">Du'aas</p>
                    <p className="text-xs text-muted-foreground">Supplications in the More tab</p>
                  </div>
                  <Switch
                    checked={!settingsChild.hideDuas}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: settingsChild.id, field: "hideDuas", value: !checked })
                    }
                  />
                </div>
              </div>
              <Button className="w-full" onClick={() => setSettingsChildId(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteChildId !== null} onOpenChange={(open) => { if (!open) setDeleteChildId(null); }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Are you sure? This will delete all progress for{" "}
              <span className="font-semibold text-foreground">
                {children.find(c => c.id === deleteChildId)?.name ?? "this profile"}
              </span>
              , including memorization history, streaks, and sessions. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteChildId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => deleteChildId !== null && deleteMutation.mutate(deleteChildId)}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-step onboarding dialog */}
      <Dialog open={showAdd} onOpenChange={open => { setShowAdd(open); if (!open) { setStep(1); setForm(DEFAULT_FORM); setRangeFrom(null); setRangeTo(null); setCustomMemorizePage(""); } }}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {step === 1 ? "Create a Profile" : step === 2 ? "Prior Memorization" : step === 3 ? "How Well Do They Know Each Surah?" : step === 4 ? "Daily Practice Goal" : "Daily Learning Goals"}
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-1">
            {Array.from({ length: displayTotal }, (_, i) => i + 1).map(s => (
              <div key={s} className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s < displayStep ? "bg-primary" : s === displayStep ? "bg-primary/70" : "bg-muted"
              )} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">Step {displayStep} of {displayTotal}</p>

          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className="mt-1" />
              </div>
              <div>
                <Label>Age</Label>
                <Input type="number" min={3} max={18} value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="3–18" className="mt-1" />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v as "male" | "female" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Avatar</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {AVATARS.map(emoji => (
                    <button key={emoji} onClick={() => setForm(f => ({ ...f, avatarEmoji: emoji }))}
                      className={cn("text-xl p-2 rounded-xl transition-all", form.avatarEmoji === emoji ? "bg-primary/20 ring-2 ring-primary scale-110" : "bg-muted hover:bg-muted/70")}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Prior memorization */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Which surahs does {form.name || "this profile"} already know? Select the surahs they know at least some of, then we’ll sort each one into review or memorization.
              </p>

              {/* Range picker */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <p className="text-xs font-semibold text-primary">Range Selection</p>
                <div className="flex gap-2 items-center">
                  <Select
                    value={rangeFrom?.toString() ?? ""}
                    onValueChange={v => setRangeFrom(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="From surah" /></SelectTrigger>
                    <SelectContent className="max-h-52">
                      {allSurahs.map(s => (
                        <SelectItem key={s.id} value={s.number.toString()} className="text-xs">
                          {s.number}. {s.nameTransliteration}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground shrink-0">to</span>
                  <Select
                    value={rangeTo?.toString() ?? ""}
                    onValueChange={v => setRangeTo(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="To surah" /></SelectTrigger>
                    <SelectContent className="max-h-52">
                      {allSurahs.map(s => (
                        <SelectItem key={s.id} value={s.number.toString()} className="text-xs">
                          {s.number}. {s.nameTransliteration}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-2.5 shrink-0"
                    onClick={applyRange}
                    disabled={rangeFrom === null || rangeTo === null}
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">All surahs between the two selections in NoorPath's learning order will be added.</p>
              </div>

              {/* Individual selection list */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {surahsLoading ? (
                  <div className="space-y-1.5">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-11 rounded-xl" />)}
                  </div>
                ) : (
                  allSurahs.map(s => {
                    const selected = selectedSurahIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSurah(s.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all",
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-border/80 hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          selected ? "border-primary bg-primary text-white" : "border-muted-foreground/40"
                        )}>
                          {selected && <Check size={11} />}
                        </div>
                        <span className="text-xs text-muted-foreground w-6 shrink-0 tabular-nums">{s.number}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{s.nameTransliteration}</p>
                          <p className="text-xs text-muted-foreground">{s.verseCount} verses</p>
                        </div>
                        <span className="arabic-text text-sm text-muted-foreground shrink-0">{s.nameArabic}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {form.initialSurahSetups.length === 0 ? (
                <p className="text-xs text-primary bg-primary/5 rounded-lg p-2 text-center">
                  ✨ Starting fresh? We'll begin with Al-Fatihah — the foundation of every prayer.
                </p>
              ) : (
                <p className="text-xs text-primary bg-primary/5 rounded-lg p-2 text-center flex items-center justify-center gap-2">
                  <span>{form.initialSurahSetups.length} surah{form.initialSurahSetups.length > 1 ? "s" : ""} selected</span>
                  <button
                    className="underline underline-offset-2 text-primary/70 hover:text-primary"
                    onClick={() => setForm(f => ({ ...f, initialSurahSetups: [] }))}
                  >
                    Clear all
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Step 3: Per-surah starting level */}
          {step === 3 && form.initialSurahSetups.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose the strength and memorized amount for each surah. Partial surahs stay in memorization until the full surah is completed.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-primary">Quick Apply</p>
                <div className="flex flex-wrap gap-2">
                  {SURAH_LEVEL_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => applyLevelToAll(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                {SURAH_LEVEL_OPTIONS.map((opt) => (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs mr-2 mb-2",
                      opt.value === "very_strong" || opt.value === "solid"
                        ? "bg-emerald-100 text-emerald-700"
                        : opt.value === "learning"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-rose-100 text-rose-700"
                    )}
                    key={opt.value}
                  >
                    {opt.label}: {opt.desc}
                  </span>
                ))}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedSurahSetups.map(({ surah, setup }) => (
                  <div key={surah.id} className="rounded-xl border border-border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{surah.number}. {surah.nameTransliteration}</p>
                        <p className="text-xs text-muted-foreground">{surah.verseCount} ayahs</p>
                      </div>
                      <p className="arabic-text text-sm text-primary shrink-0">{surah.nameArabic}</p>
                    </div>

                    <Select
                      value={setup.level}
                      onValueChange={(value) => updateSurahLevel(surah.id, value as InitialSurahLevel)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SURAH_LEVEL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Known through ayah</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={surah.verseCount}
                          value={setup.knownAyahCount ?? ""}
                          onChange={(e) => updateKnownAyahCount(surah.id, e.target.value)}
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          of {surah.verseCount}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Default is the full surah. Lower it only if they know part of the surah so far.
                      </p>
                      {setup.level !== "just_started" && (setup.knownAyahCount ?? surah.verseCount) < surah.verseCount && (
                        <p className="text-xs text-muted-foreground">
                          This will seed the surah as in progress first, and it will move into review once the full surah is completed.
                        </p>
                      )}
                      {setup.level === "just_started" && (
                        <p className="text-xs text-muted-foreground">
                          Just Started stays in memorization, so use a partial ayah count rather than the full surah.
                        </p>
                      )}
                      {setup.level === "just_started" && (setup.knownAyahCount ?? surah.verseCount) >= surah.verseCount && (
                        <p className="text-xs text-destructive">
                          Lower this below the full surah for Just Started.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Practice goal */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                How much time can {form.name || "this profile"} practice each day?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PRACTICE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, practiceMinutesPerDay: opt.value }))}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      form.practiceMinutesPerDay === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <p className="text-lg font-bold text-primary">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Daily learning goals */}
          {step === 5 && (
            <div className="space-y-5">
              {/* Memorization picker */}
              <div className="space-y-2">
                <p className="text-sm font-medium">New memorization per day</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0.25, label: "¼ page", desc: "A few verses" },
                    { value: 0.5,  label: "½ page", desc: "~7 verses" },
                    { value: 1.0,  label: "1 page",  desc: "Standard" },
                    { value: 2.0,  label: "2 pages", desc: "Intensive" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setForm(f => ({ ...f, memorizePagePerDay: opt.value })); setCustomMemorizePage(""); }}
                      className={cn(
                        "px-3 py-2 rounded-full border text-left transition-all text-sm",
                        form.memorizePagePerDay === opt.value && customMemorizePage === ""
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-muted-foreground text-xs ml-1">· {opt.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.25}
                    placeholder="Custom (e.g. 1.5)"
                    value={customMemorizePage}
                    onChange={e => {
                      setCustomMemorizePage(e.target.value);
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) setForm(f => ({ ...f, memorizePagePerDay: v }));
                    }}
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">pages/day</span>
                </div>
              </div>

              {/* Review picker */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Daily review amount</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 1.0,  label: "~1 page",   desc: "Light" },
                    { value: 2.0,  label: "~2 pages",  desc: "Regular" },
                    { value: 4.0,  label: "~4 pages",  desc: "Strong" },
                    { value: 10.0, label: "10 pages",  desc: "Intensive" },
                    { value: 20.0, label: "20 pages",  desc: "Hafidh pace" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, reviewPagesPerDay: opt.value }))}
                      className={cn(
                        "px-3 py-2 rounded-full border text-left transition-all text-sm",
                        form.reviewPagesPerDay === opt.value
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-muted-foreground text-xs ml-1">· {opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Don't worry — you can always change this in Settings later.
              </p>

              {/* Summary */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-primary mb-2">📋 Profile Summary</p>
                <p className="text-sm"><span className="text-muted-foreground">Name:</span> <span className="font-medium">{form.name}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Age:</span> <span className="font-medium">{form.age}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Already memorized:</span> <span className="font-medium">
                  {form.initialSurahSetups.length === 0 ? "Starting fresh" : `${form.initialSurahSetups.length} surah${form.initialSurahSetups.length > 1 ? "s" : ""} selected`}
                </span></p>
                {form.initialSurahSetups.length > 0 && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Starting levels:</span>{" "}
                    <span className="font-medium">
                      {[
                        levelCounts.very_strong ? `${levelCounts.very_strong} very strong` : null,
                        levelCounts.solid ? `${levelCounts.solid} solid` : null,
                        levelCounts.learning ? `${levelCounts.learning} learning` : null,
                        levelCounts.just_started ? `${levelCounts.just_started} just started` : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                )}
                <p className="text-sm"><span className="text-muted-foreground">Daily practice:</span> <span className="font-medium">{form.practiceMinutesPerDay} min/day</span></p>
                <p className="text-sm"><span className="text-muted-foreground">New memorization:</span> <span className="font-medium">{form.memorizePagePerDay} page{form.memorizePagePerDay !== 1 ? "s" : ""}/day</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Daily review:</span> <span className="font-medium">{form.reviewPagesPerDay} page{form.reviewPagesPerDay !== 1 ? "s" : ""}/day</span></p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-2 mt-4 pt-2 border-t border-border">
            {step > 1 && (
              <Button variant="outline" size="sm" onClick={handleBack} className="gap-1">
                <ChevronLeft size={14} /> Back
              </Button>
            )}
            <Button
              className="flex-1 rounded-full"
              onClick={handleNext}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 3 && !canProceedStep3) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? "Creating..." :
               step < 5 ? (
                 <span className="flex items-center gap-1">Next <ChevronRight size={14} /></span>
               ) : (
                 "Start Their Journey ✨"
               )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CelebrationOverlay
        show={streakCelebration !== null}
        onDone={() => setStreakCelebration(null)}
        message={streakCelebration?.message ?? ""}
        subMessage={streakCelebration?.subMessage}
      />
    </div>
  );
}
