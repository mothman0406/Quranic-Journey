import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { listChildren, createChild } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Flame, Star, BookOpen, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const AVATARS = ["⭐", "🌙", "☀️", "🌸", "🌿", "🦋", "🌟", "🕊️", "🌺", "💎"];

const AGE_GROUP_LABELS: Record<string, string> = {
  toddler: "Ages 3–6 · Seeds of Faith",
  child: "Ages 7–10 · Building Foundation",
  preteen: "Ages 11–14 · Deepening Knowledge",
  teen: "Ages 15+ · Path to Hifz"
};

export default function Home() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", age: "", gender: "male" as "male" | "female", avatarEmoji: "⭐" });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: () => listChildren()
  });

  const createMutation = useMutation({
    mutationFn: () => createChild({ name: form.name, age: parseInt(form.age), gender: form.gender, avatarEmoji: form.avatarEmoji }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["children"] }); setShowAdd(false); setForm({ name: "", age: "", gender: "male", avatarEmoji: "⭐" }); }
  });

  const children = data?.children || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="pattern-bg text-white px-4 pt-12 pb-12">
        <div className="max-w-lg mx-auto text-center">
          <p className="arabic-text text-4xl mb-2 text-amber-200">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          <h1 className="text-2xl font-bold mt-3 text-white">NoorPath</h1>
          <p className="text-emerald-200 text-sm mt-1">Guiding children to the Quran — one verse at a time</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 pb-12">
        {isLoading ? (
          <div className="space-y-3 mt-2">
            {[1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : children.length === 0 ? (
          <Card className="mt-2 text-center border-border shadow-sm">
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
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 mt-2">
              <h2 className="font-semibold text-foreground">Profiles</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="text-primary text-xs">
                <Plus size={14} className="mr-1" /> Add Child
              </Button>
            </div>
            <div className="space-y-3">
              {children.map((child) => (
                <Link key={child.id} href={`/child/${child.id}`}>
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
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <Card className="border-border"><CardContent className="p-4 text-center"><div className="text-2xl mb-2">📿</div><p className="text-xs font-semibold">Smart Review</p><p className="text-xs text-muted-foreground mt-1">Spaced repetition keeps memorization strong</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-4 text-center"><div className="text-2xl mb-2">🎯</div><p className="text-xs font-semibold">Age-Based Plans</p><p className="text-xs text-muted-foreground mt-1">Tailored curriculum from age 3 to Hifz</p></CardContent></Card>
            </div>
          </>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle>Add a Child Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Child's name" className="mt-1" /></div>
            <div><Label>Age</Label><Input type="number" min={3} max={18} value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="3–18" className="mt-1" /></div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v as "male" | "female" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Avatar</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {AVATARS.map(emoji => (
                  <button key={emoji} onClick={() => setForm(f => ({ ...f, avatarEmoji: emoji }))}
                    className={`text-xl p-2 rounded-xl transition-all ${form.avatarEmoji === emoji ? "bg-primary/20 ring-2 ring-primary scale-110" : "bg-muted hover:bg-muted/70"}`}>{emoji}</button>
                ))}
              </div>
            </div>
            <Button className="w-full rounded-full" onClick={() => createMutation.mutate()} disabled={!form.name || !form.age || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Start Their Journey ✨"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
