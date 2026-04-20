import { useState } from "react";
import { useParams, Link } from "wouter";
import { ChevronLeft, Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ChildNav } from "@/components/child-nav";
import { useSettings } from "@/hooks/use-settings";
import type { BlurIntensity, FontSize } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const MUSHAF_THEME_OPTIONS = [
  { key: "teal",         name: "Madinah",       swatch: "#1a4a5c", parchment: "#fdf6e3" },
  { key: "maroon",       name: "Ottoman",       swatch: "#4a1a2c", parchment: "#fdf0e0" },
  { key: "navy",         name: "Modern",        swatch: "#1a2a4a", parchment: "#f8f6f2" },
  { key: "forest",       name: "Classic",       swatch: "#0d2b1a", parchment: "#fdf6e3" },
  { key: "madinah_dark", name: "Madinah Night", swatch: "#0d2b38", parchment: "#1a1a2e" },
  { key: "ottoman_dark", name: "Ottoman Night", swatch: "#2b0d1a", parchment: "#1a1208" },
  { key: "modern_dark",  name: "Modern Night",  swatch: "#0d1a2b", parchment: "#0f0f1a" },
  { key: "classic_dark", name: "Classic Night", swatch: "#0d1a0d", parchment: "#0d1308" },
];

const FONT_SIZE_OPTIONS: { key: FontSize; label: string }[] = [
  { key: "small",  label: "Small"  },
  { key: "medium", label: "Medium" },
  { key: "large",  label: "Large"  },
];

const BLUR_OPTIONS: { key: BlurIntensity; label: string; desc: string }[] = [
  { key: "low",    label: "Low",    desc: "Slightly hidden" },
  { key: "medium", label: "Medium", desc: "Moderately hidden" },
  { key: "high",   label: "High",   desc: "Heavily hidden" },
];

const COMING_SOON_RECITERS = [
  "Abdul Basit Abdul Samad",
  "Mishary Rashid Alafasy",
  "Saud Al-Shuraim",
];

export default function SettingsPage() {
  const { childId } = useParams<{ childId: string }>();
  const { settings, updateSettings } = useSettings();

  const arabicPreviewSize =
    settings.fontSize === "small" ? "1.2rem" :
    settings.fontSize === "large" ? "2.1rem" : "1.6rem";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pattern-bg text-white px-4 pt-8 pb-12">
        <div className="max-w-lg mx-auto">
          <Link href={`/child/${childId}/more`}>
            <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
              <ChevronLeft size={16} /> More
            </button>
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-emerald-200 text-sm mt-1">Customise your learning experience</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">

        {/* ── Display & Appearance ── */}
        <SectionCard title="Display & Appearance">
          <ToggleRow
            label="Dark Mode"
            description="Easier on the eyes at night"
            checked={settings.darkMode}
            onCheckedChange={(v) => updateSettings({ darkMode: v })}
            icon={
              settings.darkMode
                ? <Moon size={18} className="text-indigo-400" />
                : <Sun size={18} className="text-amber-500" />
            }
          />

          <Divider />

          {/* Mushaf theme */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">Mushaf Theme</p>
            <p className="text-xs text-muted-foreground mb-3">Default theme in the memorization player</p>
            <div className="grid grid-cols-4 gap-2">
              {MUSHAF_THEME_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => updateSettings({ mushafTheme: t.key })}
                  className={cn(
                    "rounded-xl border-2 overflow-hidden flex flex-col items-center gap-1 py-2 px-1 transition-all",
                    settings.mushafTheme === t.key
                      ? "border-primary shadow-sm scale-[1.03]"
                      : "border-border hover:border-primary/40"
                  )}
                  style={{ background: t.parchment }}
                >
                  <span
                    className="w-5 h-5 rounded-full shadow-sm"
                    style={{ background: t.swatch, border: "2px solid rgba(255,255,255,0.3)" }}
                  />
                  <span
                    className="text-[9px] font-semibold leading-tight text-center px-0.5"
                    style={{ color: t.swatch }}
                  >
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Font size */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Arabic Font Size</p>
                <p className="text-xs text-muted-foreground mt-0.5">Affects Arabic text throughout the app</p>
              </div>
              <span
                className="arabic-text text-primary leading-none"
                style={{ fontSize: arabicPreviewSize }}
              >
                بِسْمِ
              </span>
            </div>
            <div className="flex gap-2">
              {FONT_SIZE_OPTIONS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => updateSettings({ fontSize: f.key })}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-sm font-medium transition-all",
                    settings.fontSize === f.key
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── Memorization Behaviour ── */}
        <SectionCard title="Memorization Behaviour">
          <ToggleRow
            label="Celebration Confetti"
            description="Show confetti when a session or surah is completed"
            checked={settings.confetti}
            onCheckedChange={(v) => updateSettings({ confetti: v })}
          />

          <Divider />

          <ToggleRow
            label="Auto-Advance"
            description="Continuously play through all ayahs without stopping"
            checked={settings.autoAdvance}
            onCheckedChange={(v) => updateSettings({ autoAdvance: v })}
          />

          <Divider />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Default Repeat Count</p>
              <p className="text-xs text-muted-foreground mt-0.5">How many times to play each ayah by default</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSettings({ defaultRepeatCount: Math.max(1, settings.defaultRepeatCount - 1) })}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">
                {settings.defaultRepeatCount}×
              </span>
              <button
                onClick={() => updateSettings({ defaultRepeatCount: Math.min(10, settings.defaultRepeatCount + 1) })}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <Divider />

          <ToggleRow
            label="Cumulative Review"
            description="Replay all ayahs from the start up to the current one"
            checked={settings.cumulativeReview}
            onCheckedChange={(v) => updateSettings({ cumulativeReview: v })}
          />

          {settings.cumulativeReview && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Cumulative Review Repeat Count</p>
                <p className="text-xs text-muted-foreground mt-0.5">How many times to loop through the cumulative range</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSettings({ defaultReviewRepeatCount: Math.max(1, settings.defaultReviewRepeatCount - 1) })}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums">
                  {settings.defaultReviewRepeatCount}×
                </span>
                <button
                  onClick={() => updateSettings({ defaultReviewRepeatCount: Math.min(10, settings.defaultReviewRepeatCount + 1) })}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Daily Goals ── */}
        <DailyGoalsSection childId={childId} />

        {/* ── Recite Mode ── */}
        <SectionCard title="Recite Mode">
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">Blur Intensity</p>
            <p className="text-xs text-muted-foreground mb-3">How much unrecited words are hidden while reciting</p>
            <div className="flex gap-2">
              {BLUR_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => updateSettings({ blurIntensity: o.key })}
                  className={cn(
                    "flex-1 rounded-xl border py-3 px-1 flex flex-col items-center gap-1.5 transition-all",
                    settings.blurIntensity === o.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span
                    className="arabic-text text-sm leading-none"
                    style={{
                      filter: o.key === "low" ? "blur(2px)" : o.key === "high" ? "blur(6px)" : "blur(4px)",
                      color: settings.blurIntensity === o.key ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    بِسْمِ
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      settings.blurIntensity === o.key ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {o.label}
                  </span>
                  <span
                    className={cn(
                      "text-[9px]",
                      settings.blurIntensity === o.key ? "text-primary/70" : "text-muted-foreground/60"
                    )}
                  >
                    {o.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── Audio ── */}
        <SectionCard title="Audio">
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">Reciter</p>
            <p className="text-xs text-muted-foreground mb-3">The voice used during memorization sessions</p>
            <div className="space-y-2">
              {/* Available: Husary */}
              <button
                onClick={() => updateSettings({ reciter: "husary" })}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border py-3 px-4 transition-all text-left",
                  settings.reciter === "husary"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors",
                    settings.reciter === "husary"
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Mahmoud Khalil Al-Husary</p>
                  <p className="text-xs text-muted-foreground">Murattal — clear and measured</p>
                </div>
              </button>

              {/* Coming soon */}
              {COMING_SOON_RECITERS.map((name) => (
                <div
                  key={name}
                  className="w-full flex items-center gap-3 rounded-xl border border-border py-3 px-4 opacity-40 cursor-not-allowed"
                >
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">More coming soon</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <ChildNav childId={childId} />
    </div>
  );
}

const MEMORIZE_OPTIONS = [
  { value: 0.25, label: "¼ page" },
  { value: 0.5,  label: "½ page" },
  { value: 1.0,  label: "1 page" },
  { value: 2.0,  label: "2 pages" },
];

const REVIEW_OPTIONS = [
  { value: 1.0,  label: "~1 page" },
  { value: 2.0,  label: "~2 pages" },
  { value: 4.0,  label: "~4 pages" },
  { value: 10.0, label: "10 pages" },
  { value: 20.0, label: "20 pages" },
];

function DailyGoalsSection({ childId }: { childId: string }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState<"memorize" | "review" | null>(null);
  const [memorizeValue, setMemorizeValue] = useState<number | null>(null);
  const [reviewValue, setReviewValue] = useState<number | null>(null);
  const [showMemorizeCustom, setShowMemorizeCustom] = useState(false);
  const [memorizeCustomInput, setMemorizeCustomInput] = useState("");

  const { data: child } = useQuery({
    queryKey: ["child", childId],
    queryFn: async () => {
      const res = await fetch(`/api/children/${childId}`);
      return res.json() as Promise<{ memorizePagePerDay: number; reviewPagesPerDay: number }>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (updates: { memorizePagePerDay?: number; reviewPagesPerDay?: number }) => {
      const res = await fetch(`/api/children/${childId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dashboard", childId] });
      qc.invalidateQueries({ queryKey: ["reviews", childId] });
      const key: "memorize" | "review" = "memorizePagePerDay" in vars ? "memorize" : "review";
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    },
  });

  const activeMemorize = memorizeValue ?? child?.memorizePagePerDay;
  const activeReview = reviewValue ?? child?.reviewPagesPerDay;

  return (
    <SectionCard title="Daily Goals">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-foreground">New Memorization Per Day</p>
            <p className="text-xs text-muted-foreground mt-0.5">How much new Quran to memorize each day</p>
          </div>
          {saved === "memorize" && (
            <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {MEMORIZE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                setMemorizeValue(o.value);
                setShowMemorizeCustom(false);
                mutation.mutate({ memorizePagePerDay: o.value });
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                activeMemorize === o.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {o.label}
            </button>
          ))}
          {activeMemorize !== undefined && !MEMORIZE_OPTIONS.some(o => o.value === activeMemorize) && !showMemorizeCustom && (
            <button
              onClick={() => { setShowMemorizeCustom(true); setMemorizeCustomInput(String(activeMemorize)); }}
              className="rounded-xl border px-3 py-2 text-sm font-medium border-primary bg-primary/5 text-primary"
            >
              {activeMemorize} pages
            </button>
          )}
          <button
            onClick={() => { setShowMemorizeCustom(!showMemorizeCustom); setMemorizeCustomInput(String(activeMemorize ?? "")); }}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              showMemorizeCustom
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            Custom…
          </button>
        </div>
        {showMemorizeCustom && (
          <div className="flex gap-2 items-center mt-2">
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.25"
              value={memorizeCustomInput}
              onChange={(e) => setMemorizeCustomInput(e.target.value)}
              placeholder="e.g. 0.75"
              className="w-24 rounded-xl border border-border px-3 py-2 text-sm bg-background"
              autoFocus
            />
            <button
              onClick={() => {
                const v = parseFloat(memorizeCustomInput);
                if (!isNaN(v) && v > 0) {
                  setMemorizeValue(v);
                  mutation.mutate({ memorizePagePerDay: v });
                }
                setShowMemorizeCustom(false);
              }}
              className="rounded-xl border border-primary bg-primary/5 text-primary px-3 py-2 text-sm font-medium"
            >
              Set
            </button>
            <button onClick={() => setShowMemorizeCustom(false)} className="text-sm text-muted-foreground">
              Cancel
            </button>
          </div>
        )}
      </div>

      <Divider />

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Daily Review Amount</p>
            <p className="text-xs text-muted-foreground mt-0.5">How much to review each day</p>
          </div>
          {saved === "review" && (
            <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {REVIEW_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                setReviewValue(o.value);
                mutation.mutate({ reviewPagesPerDay: o.value });
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                activeReview === o.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-4">
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border/40" />;
}
