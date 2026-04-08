import { useState } from "react";
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
import { Plus, Flame, Star, BookOpen, ChevronRight, ChevronLeft, Check, Book, Settings } from "lucide-react";
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

type OnboardingForm = {
  name: string;
  age: string;
  gender: "male" | "female";
  avatarEmoji: string;
  preMemorizedSurahIds: number[];
  memorationStrength: number;
  practiceMinutesPerDay: number;
};

const DEFAULT_FORM: OnboardingForm = {
  name: "",
  age: "",
  gender: "male",
  avatarEmoji: "⭐",
  preMemorizedSurahIds: [],
  memorationStrength: 3,
  practiceMinutesPerDay: 20,
};

const STEP_LABELS = ["Basic Info", "Memorization", "Strength", "Goals"];

export default function Home() {
  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(DEFAULT_FORM);
  const [settingsChildId, setSettingsChildId] = useState<number | null>(null);
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
  const allSurahs = (surahsData?.surahs ?? []).slice().sort((a, b) => a.number - b.number);

  const createMutation = useMutation({
    mutationFn: () => fetch("/api/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        age: parseInt(form.age),
        gender: form.gender,
        avatarEmoji: form.avatarEmoji,
        preMemorizedSurahIds: form.preMemorizedSurahIds,
        memorationStrength: form.memorationStrength,
        practiceMinutesPerDay: form.practiceMinutesPerDay,
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

  const totalSteps = form.preMemorizedSurahIds.length > 0 ? 4 : 3;

  const canProceedStep1 = form.name.trim().length > 0 && form.age.length > 0 && parseInt(form.age) >= 3;

  function toggleSurah(id: number) {
    setForm(f => ({
      ...f,
      preMemorizedSurahIds: f.preMemorizedSurahIds.includes(id)
        ? f.preMemorizedSurahIds.filter(s => s !== id)
        : [...f.preMemorizedSurahIds, id]
    }));
  }

  function applyRange() {
    if (rangeFrom === null || rangeTo === null) return;
    const min = Math.min(rangeFrom, rangeTo);
    const max = Math.max(rangeFrom, rangeTo);
    const inRange = allSurahs.filter(s => s.number >= min && s.number <= max).map(s => s.id);
    setForm(f => ({
      ...f,
      preMemorizedSurahIds: [...new Set([...f.preMemorizedSurahIds, ...inRange])]
    }));
  }

  function handleNext() {
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      if (form.preMemorizedSurahIds.length > 0) { setStep(3); } else { setStep(4); }
      return;
    }
    if (step === 3) { setStep(4); return; }
    if (step === 4) { createMutation.mutate(); return; }
  }

  function handleBack() {
    if (step === 4 && form.preMemorizedSurahIds.length === 0) { setStep(2); return; }
    setStep(s => s - 1);
  }

  const displayStep = step === 4 ? (form.preMemorizedSurahIds.length > 0 ? 4 : 3) : step;
  const displayTotal = form.preMemorizedSurahIds.length > 0 ? 4 : 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="pattern-bg text-white px-4 pt-12 pb-16">
        <div className="max-w-lg mx-auto text-center">
          <p className="arabic-text text-4xl mb-2 text-amber-200">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          <h1 className="text-2xl font-bold mt-3 text-white">NoorPath</h1>
          <p className="text-emerald-200 text-sm mt-1">Guiding children to the Quran — one verse at a time</p>
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
            <Card className="text-center border-border shadow-md">
              <CardContent className="py-12 px-6">
                <div className="text-6xl mb-4">📖</div>
                <h2 className="text-xl font-bold text-foreground mb-2">Begin the Journey</h2>
                <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                  Add your child's profile to receive a personalized Quran and Islamic learning plan — from their very first surah all the way to completing the Quran, in sha Allah.
                </p>
                <Button onClick={() => setShowAdd(true)} className="rounded-full px-8">
                  <Plus size={16} className="mr-2" /> Add Your First Child
                </Button>
              </CardContent>
            </Card>

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
                <Plus size={13} /> Add Child
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
                    title="Child settings"
                  >
                    <Settings size={14} />
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
                Toggle which content types appear in your child's app. These can be changed any time.
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

      {/* Multi-step onboarding dialog */}
      <Dialog open={showAdd} onOpenChange={open => { setShowAdd(open); if (!open) { setStep(1); setForm(DEFAULT_FORM); setRangeFrom(null); setRangeTo(null); } }}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {step === 1 ? "Create a Profile" : step === 2 ? "Prior Memorization" : step === 3 ? "How Strong Is the Memorization?" : "Daily Practice Goal"}
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
                <Label>Child's Name</Label>
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
                Which surahs has {form.name || "your child"} already memorized? Select individually or use Range Selection to mark many at once.
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
                <p className="text-xs text-muted-foreground">All surahs between the two selected will be added to the selection.</p>
              </div>

              {/* Individual selection list */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {surahsLoading ? (
                  <div className="space-y-1.5">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-11 rounded-xl" />)}
                  </div>
                ) : (
                  allSurahs.map(s => {
                    const selected = form.preMemorizedSurahIds.includes(s.id);
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

              {form.preMemorizedSurahIds.length === 0 ? (
                <p className="text-xs text-primary bg-primary/5 rounded-lg p-2 text-center">
                  ✨ Starting fresh? We'll begin with Al-Fatihah — the foundation of every prayer.
                </p>
              ) : (
                <p className="text-xs text-primary bg-primary/5 rounded-lg p-2 text-center flex items-center justify-center gap-2">
                  <span>{form.preMemorizedSurahIds.length} surah{form.preMemorizedSurahIds.length > 1 ? "s" : ""} selected</span>
                  <button
                    className="underline underline-offset-2 text-primary/70 hover:text-primary"
                    onClick={() => setForm(f => ({ ...f, preMemorizedSurahIds: [] }))}
                  >
                    Clear all
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Step 3: Memorization strength (only if surahs selected) */}
          {step === 3 && form.preMemorizedSurahIds.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                How solid is {form.name || "their"} memorization of the selected surahs?
              </p>
              <div className="space-y-2">
                {[
                  { value: 5, label: "Very Strong", desc: "Can recite confidently from memory, no hesitation", emoji: "🌟" },
                  { value: 3, label: "Solid",       desc: "Knows it well but could use occasional review",    emoji: "✅" },
                  { value: 2, label: "Learning",    desc: "Knows most of it but needs more practice",          emoji: "📖" },
                  { value: 1, label: "Just Started", desc: "Only partially memorized, still very new",         emoji: "🌱" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, memorationStrength: opt.value }))}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      form.memorationStrength === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    {form.memorationStrength === opt.value && (
                      <Check size={16} className="ml-auto text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Practice goal */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                How much time can {form.name || "your child"} practice each day?
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

              {/* Summary */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-primary mb-2">📋 Profile Summary</p>
                <p className="text-sm"><span className="text-muted-foreground">Name:</span> <span className="font-medium">{form.name}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Age:</span> <span className="font-medium">{form.age}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Already memorized:</span> <span className="font-medium">
                  {form.preMemorizedSurahIds.length === 0 ? "Starting fresh" : `${form.preMemorizedSurahIds.length} surah${form.preMemorizedSurahIds.length > 1 ? "s" : ""}`}
                </span></p>
                <p className="text-sm"><span className="text-muted-foreground">Daily practice:</span> <span className="font-medium">{form.practiceMinutesPerDay} min/day</span></p>
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
                createMutation.isPending
              }
            >
              {createMutation.isPending ? "Creating..." :
               step < 4 ? (
                 <span className="flex items-center gap-1">Next <ChevronRight size={14} /></span>
               ) : (
                 "Start Their Journey ✨"
               )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
