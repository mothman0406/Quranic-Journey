import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VersePlayerProps {
  arabic: string;
  surahNumber: number;
  verseNumber: number;
  size?: "sm" | "md" | "lg";
}

const EVERYAYAH_BASE = "https://everyayah.com/data/Husary_128kbps";
const QURAN_API_BASE = "https://api.quran.com/api/v4";
const QURAN_CDN_BASE = "https://verses.quran.com";

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

type Segment = [number, number, number]; // [wordIndex1based, startMs, endMs]

interface AudioInfo {
  audioUrl: string;
  segments: Segment[];
}

async function fetchVerseAudio(surah: number, verse: number): Promise<AudioInfo> {
  try {
    const res = await fetch(`${QURAN_API_BASE}/recitations/10/by_ayah/${surah}:${verse}`);
    if (res.ok) {
      const data = await res.json();
      const file = data.audio_files?.[0];
      if (file?.url) {
        return {
          audioUrl: `${QURAN_CDN_BASE}/${file.url}`,
          segments: Array.isArray(file.segments) ? file.segments : []
        };
      }
    }
  } catch {
    // fall through
  }
  // Fallback to everyayah.com (no word timing available)
  return {
    audioUrl: `${EVERYAYAH_BASE}/${pad(surah, 3)}${pad(verse, 3)}.mp3`,
    segments: []
  };
}

export function VersePlayer({ arabic, surahNumber, verseNumber, size = "md" }: VersePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const audioInfoRef = useRef<AudioInfo | null>(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState(-1);
  const [error, setError] = useState(false);

  const words = arabic.split(/\s+/).filter(Boolean);

  // Cleanup on unmount or verse change
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [surahNumber, verseNumber]);

  const updateHighlight = useCallback(() => {
    const audio = audioRef.current;
    const info = audioInfoRef.current;
    if (!audio || audio.paused) return;

    const currentMs = audio.currentTime * 1000;

    if (info && info.segments.length > 0) {
      let found = -1;
      for (const [wordIdx, startMs, endMs] of info.segments) {
        if (currentMs >= startMs && currentMs < endMs) {
          found = wordIdx - 1; // 1-based → 0-based
          break;
        }
      }
      // If past all segments, highlight last word
      if (found === -1 && currentMs > 0) {
        const last = info.segments[info.segments.length - 1];
        if (last && currentMs >= last[1]) found = words.length - 1;
      }
      setHighlightedWord(found);
    } else {
      // Uniform timing fallback
      const dur = (audio.duration || 1) * 1000;
      const wordDur = dur / words.length;
      const idx = Math.min(Math.floor(currentMs / wordDur), words.length - 1);
      setHighlightedWord(idx);
    }

    rafRef.current = requestAnimationFrame(updateHighlight);
  }, [words.length]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setHighlightedWord(-1);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const handlePlay = useCallback(async () => {
    if (error) return;

    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      // Fetch audio info if not already loaded
      if (!audioInfoRef.current) {
        audioInfoRef.current = await fetchVerseAudio(surahNumber, verseNumber);
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.onended = handleEnded;
        audioRef.current.onerror = () => { setError(true); setLoading(false); setPlaying(false); };
      }

      if (audioRef.current.src !== audioInfoRef.current.audioUrl) {
        audioRef.current.src = audioInfoRef.current.audioUrl;
        audioRef.current.load();
      }

      await audioRef.current.play();
      setPlaying(true);
      rafRef.current = requestAnimationFrame(updateHighlight);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [playing, error, surahNumber, verseNumber, handleEnded, updateHighlight]);

  const textSize = size === "sm" ? "text-xl" : size === "lg" ? "text-4xl" : "text-3xl";

  return (
    <div className="space-y-3">
      {/* Arabic with word highlighting */}
      <div
        className={cn("arabic-text leading-loose text-right", textSize)}
        dir="rtl"
        lang="ar"
      >
        {words.map((word, i) => (
          <span
            key={i}
            className={cn(
              "inline-block transition-all duration-100 rounded-md px-0.5 mx-0.5",
              highlightedWord === i
                ? "bg-amber-300 text-amber-900 scale-110 shadow-sm"
                : playing && highlightedWord > i
                  ? "text-primary/50"
                  : "text-foreground"
            )}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Play button */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlay}
          disabled={loading || error}
          className={cn(
            "gap-2 rounded-full transition-all",
            playing ? "bg-primary text-primary-foreground border-primary" : "",
            error ? "opacity-50" : ""
          )}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : playing ? (
            <Pause size={13} />
          ) : (
            <Play size={13} />
          )}
          <span className="text-xs">
            {loading ? "Loading..." : error ? "Unavailable" : playing ? "Pause" : "Sheikh Al-Husary"}
          </span>
        </Button>
        {playing && (
          <span className="text-xs text-muted-foreground animate-pulse">🔊 Playing...</span>
        )}
      </div>
    </div>
  );
}
