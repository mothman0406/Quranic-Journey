import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ——————————————————————————————————————————————————
// Reciters — everyayah.com folder names are exact
// ——————————————————————————————————————————————————
export interface Reciter {
  id: string;
  fullName: string;
  style: string;
  folder: string;        // everyayah.com data folder
  quranComId: number;    // Quran.com recitation ID for word timing
}

export const RECITERS: Reciter[] = [
  { id: "husary",    fullName: "Mahmoud Khalil Al-Husary",       style: "Murattal",  folder: "Husary_128kbps",                 quranComId: 7  },
  { id: "afasy",     fullName: "Mishary Rashid Al-Afasy",         style: "Murattal",  folder: "Alafasy_128kbps",                quranComId: 4  },
  { id: "sudais",    fullName: "Abdul Rahman Al-Sudais",          style: "Murattal",  folder: "Sudais_192kbps",                 quranComId: 9  },
  { id: "basit",     fullName: "Abdul Basit Abdul Samad",         style: "Murattal",  folder: "Abdul_Basit_Murattal_192kbps",   quranComId: 2  },
  { id: "minshawi",  fullName: "Muhammad Siddiq Al-Minshawi",     style: "Murattal",  folder: "Minshawi_Murattal_128kbps",      quranComId: 3  },
  { id: "ghamdi",    fullName: "Sa'd Al-Ghamdi",                  style: "Murattal",  folder: "Ghamadi_40kbps",                 quranComId: 5  },
  { id: "ajmi",      fullName: "Ahmad Al-Ajmi",                   style: "Murattal",  folder: "ahmed_ibn_ali_al-ajmy128kbps",   quranComId: 6  },
];

const DEFAULT_RECITER_ID = "husary";
const STORAGE_KEY = "noorpath-reciter";

function getDefaultReciter(): Reciter {
  return RECITERS.find(r => r.id === DEFAULT_RECITER_ID)!;
}

function setStoredReciter(id: string) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function buildAudioUrl(reciter: Reciter, surah: number, verse: number): string {
  return `https://everyayah.com/data/${reciter.folder}/${pad(surah, 3)}${pad(verse, 3)}.mp3`;
}

// Fetch word-timing segments from Quran.com (optional — fails gracefully)
type Segment = [number, number, number]; // [wordIndex1based, startMs, endMs]

async function fetchWordTiming(quranComId: number, surah: number, verse: number): Promise<Segment[]> {
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/recitations/${quranComId}/by_ayah/${surah}:${verse}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const segs = data.audio_files?.[0]?.segments;
    return Array.isArray(segs) ? segs : [];
  } catch {
    return [];
  }
}

// ——————————————————————————————————————————————————
// ReciterPicker — small inline dropdown
// ——————————————————————————————————————————————————
function ReciterPicker({ current, onChange }: { current: Reciter; onChange: (r: Reciter) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border-b border-dashed border-muted-foreground/40 pb-0.5"
      >
        {current.fullName}
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 bg-white border border-border rounded-xl shadow-lg overflow-hidden min-w-[260px]">
          <p className="text-[10px] text-muted-foreground px-3 pt-2 pb-1 font-medium uppercase tracking-wide">Choose Reciter</p>
          {RECITERS.map(r => (
            <button
              key={r.id}
              onClick={() => { onChange(r); setStoredReciter(r.id); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                r.id === current.id && "bg-primary/5 text-primary"
              )}
            >
              {r.id === current.id ? (
                <Check size={12} className="text-primary flex-shrink-0" />
              ) : (
                <span className="w-3 flex-shrink-0" />
              )}
              <span>
                <span className="font-medium">{r.fullName}</span>
                <span className="text-muted-foreground ml-1">· {r.style}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ——————————————————————————————————————————————————
// VersePlayer — main component
// ——————————————————————————————————————————————————
interface VersePlayerProps {
  arabic: string;
  surahNumber: number;
  verseNumber: number;
  size?: "sm" | "md" | "lg";
  /** Optional controlled reciter — when provided, overrides internal state */
  reciter?: Reciter;
  /** Called when the user switches reciters — required when reciter prop is provided */
  onReciterChange?: (r: Reciter) => void;
}

export function VersePlayer({ arabic, surahNumber, verseNumber, size = "md", reciter: reciterProp, onReciterChange }: VersePlayerProps) {
  const [internalReciter, setInternalReciter] = useState<Reciter>(getDefaultReciter);

  const reciter = reciterProp ?? internalReciter;
  const setReciter = (r: Reciter) => {
    if (onReciterChange) {
      onReciterChange(r);
    } else {
      setInternalReciter(r);
    }
  };
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const segmentsRef = useRef<Segment[]>([]);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState(-1);
  const [error, setError] = useState(false);

  const words = arabic.split(/\s+/).filter(Boolean);

  // Cleanup when surah/verse/reciter changes
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    audioRef.current = null;
    segmentsRef.current = [];
    setPlaying(false);
    setHighlightedWord(-1);
    setError(false);
    setLoading(false);
  }, [surahNumber, verseNumber, reciter.id]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const updateHighlight = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const currentMs = audio.currentTime * 1000;
    const segs = segmentsRef.current;

    if (segs.length > 0) {
      let found = -1;
      for (const [wordIdx, startMs, endMs] of segs) {
        if (currentMs >= startMs && currentMs < endMs) {
          found = wordIdx - 1; // 1-based → 0-based
          break;
        }
      }
      if (found === -1 && currentMs > 0) {
        const last = segs[segs.length - 1];
        if (last && currentMs >= last[1]) found = words.length - 1;
      }
      setHighlightedWord(found);
    } else {
      // Uniform timing: estimate word positions from audio duration
      const dur = (audio.duration || 1) * 1000;
      const wordDur = dur / words.length;
      setHighlightedWord(Math.min(Math.floor(currentMs / wordDur), words.length - 1));
    }

    rafRef.current = requestAnimationFrame(updateHighlight);
  }, [words.length]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setHighlightedWord(-1);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const handlePlay = useCallback(async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      // Build fresh audio element
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audio.onended = handleEnded;
      audio.onerror = () => {
        setError(true);
        setLoading(false);
        setPlaying(false);
        cancelAnimationFrame(rafRef.current);
      };
      audio.src = buildAudioUrl(reciter, surahNumber, verseNumber);
      audioRef.current = audio;

      // Fetch word timing in parallel (don't block audio)
      fetchWordTiming(reciter.quranComId, surahNumber, verseNumber).then(segs => {
        segmentsRef.current = segs;
      });

      await audio.play();
      setPlaying(true);
      rafRef.current = requestAnimationFrame(updateHighlight);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [playing, reciter, surahNumber, verseNumber, handleEnded, updateHighlight]);

  const textSize = size === "sm" ? "text-xl" : size === "lg" ? "text-4xl" : "text-3xl";

  return (
    <div className="space-y-3">
      {/* Arabic text with word highlighting */}
      <div
        className={cn("arabic-text leading-loose text-right select-none", textSize)}
        dir="rtl"
        lang="ar"
      >
        {words.map((word, i) => (
          <span
            key={i}
            className={cn(
              "inline-block transition-all duration-100 rounded-md px-0.5 mx-0.5 cursor-default",
              highlightedWord === i
                ? "bg-amber-300 text-amber-900 scale-110 shadow-sm"
                : playing && highlightedWord > i
                  ? "text-primary/40"
                  : "text-foreground"
            )}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Play/Pause button */}
        <Button
          variant={playing ? "default" : "outline"}
          size="sm"
          onClick={handlePlay}
          disabled={loading}
          className="gap-2 rounded-full transition-all"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : playing ? (
            <Pause size={13} />
          ) : (
            <Play size={13} />
          )}
          <span className="text-xs">
            {loading ? "Loading..." : playing ? "Pause" : "Listen"}
          </span>
        </Button>

        {/* Reciter name (clickable to change) */}
        <ReciterPicker current={reciter} onChange={r => setReciter(r)} />

        {/* Error state */}
        {error && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            ⚠ Audio unavailable — try a different reciter
          </span>
        )}

        {playing && !error && (
          <span className="text-xs text-emerald-600 animate-pulse">🔊</span>
        )}
      </div>
    </div>
  );
}
