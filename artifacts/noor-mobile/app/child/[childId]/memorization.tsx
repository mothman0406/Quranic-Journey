import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { ayahAudioUrl } from "@/src/lib/audio";
import { stripTashkeel, wordMatches, stripAlPrefix, tokenize, SKIP_CHARS } from "@/src/lib/recite";
import {
  fetchDashboard,
  fetchTimingsForReciter,
  submitMemorization,
  type Segment,
  type ChapterTimings,
} from "@/src/lib/memorization";
import {
  fetchSurahVerses,
  fetchVersesByPage,
  fetchAllChapters,
  type ApiWord,
  type ApiPageVerse,
  type ApiChapter,
} from "@/src/lib/quran";
import {
  THEMES,
  DEFAULT_THEME_KEY,
  THEME_DISPLAY_NAMES,
  getJuzForPage,
  type ThemeKey,
  type MushafTheme,
} from "@/src/lib/mushaf-theme";
import { findReciter, RECITERS } from "@/src/lib/reciters";
import { loadProfileSettings, saveProfileSettings, DEFAULT_SESSION_SETTINGS } from "@/src/lib/settings";
import { extractTajweedColor } from "@/src/lib/tajweed";

const PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5] as const;
type InternalPhase = "single" | "cumulative";

export default function MemorizationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    childId: string;
    name: string;
    surahNumber?: string;
    ayahStart?: string;
    ayahEnd?: string;
  }>();
  const childId = params.childId;

  const [surahNumber, setSurahNumber] = useState<number | null>(
    params.surahNumber ? Number(params.surahNumber) : null,
  );
  const [ayahStart, setAyahStart] = useState<number | null>(
    params.ayahStart ? Number(params.ayahStart) : null,
  );
  const [ayahEnd, setAyahEnd] = useState<number | null>(
    params.ayahEnd ? Number(params.ayahEnd) : null,
  );
  const [currentVerse, setCurrentVerse] = useState<number>(
    params.ayahStart ? Number(params.ayahStart) : 1,
  );
  const [pageStart, setPageStart] = useState<number | null>(null);
  const [pageEnd, setPageEnd] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayWordsMap, setDisplayWordsMap] = useState<Map<number, ApiWord[]>>(new Map());
  const [chapterTimings, setChapterTimings] = useState<ChapterTimings | null>(null);
  const [pageWordsMap, setPageWordsMap] = useState<Map<number, ApiPageVerse[]>>(new Map());
  const [chaptersMap, setChaptersMap] = useState<Map<number, ApiChapter>>(new Map());

  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState(-1);
  const [highlightedPage, setHighlightedPage] = useState<{
    verseKey: string;
    position: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Session-level settings — reset to defaults each session (not persisted)
  const [repeatCount, setRepeatCount] = useState<number>(DEFAULT_SESSION_SETTINGS.repeatCount);
  const [autoAdvanceDelayMs, setAutoAdvanceDelayMs] = useState<number>(DEFAULT_SESSION_SETTINGS.autoAdvanceDelayMs);
  const [autoplayThroughRange, setAutoplayThroughRange] = useState<boolean>(DEFAULT_SESSION_SETTINGS.autoplayThroughRange);
  const [blindMode, setBlindMode] = useState<boolean>(DEFAULT_SESSION_SETTINGS.blindMode);
  const [blurMode, setBlurMode] = useState<boolean>(DEFAULT_SESSION_SETTINGS.blurMode);
  const [viewMode, setViewMode] = useState<"ayah" | "page">("ayah");
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [reciterId, setReciterId] = useState("husary");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revealedVerses, setRevealedVerses] = useState<Set<string>>(new Set());
  const [tajweedEnabled, setTajweedEnabled] = useState<boolean>(false);
  const [translationPopup, setTranslationPopup] = useState<{
    arabic: string;
    translation: string;
  } | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const playbackRateRef = useRef(playbackRate);
  const [internalPhase, setInternalPhase] = useState<InternalPhase>("single");
  const [cumAyahIdx, setCumAyahIdx] = useState<number>(0);
  const [cumPass, setCumPass] = useState<number>(1);
  const [cumUpTo, setCumUpTo] = useState<number>(0);
  const [cumulativeReview, setCumulativeReview] = useState<boolean>(false);
  const [reviewRepeatCount, setReviewRepeatCount] = useState<number>(3);

  // Recite mode
  const [reciteMode, setReciteMode] = useState(false);
  const [reciteListening, setReciteListening] = useState(false);
  const [reciteError, setReciteError] = useState<string | null>(null);
  const [reciteExpectedIdx, setReciteExpectedIdx] = useState(0);

  // Derived from reciterId state
  const reciter = findReciter(reciterId);
  const playingVerseNumber =
    internalPhase === "cumulative" && ayahStart !== null
      ? ayahStart + cumAyahIdx
      : currentVerse;

  // Themed styles factory — recomputed only when themeKey changes
  const themedStyles = useMemo(() => makeThemedStyles(THEMES[themeKey]), [themeKey]);

  // Audio + RAF refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const rafIdRef = useRef<number>(0);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const segsRef = useRef<Segment[]>([]);
  const autoPlayRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Refs readable inside async callbacks and RAF ticks (avoid stale closures)
  const viewModeRef = useRef<"ayah" | "page">(viewMode);
  const currentVerseRef = useRef<number>(currentVerse);
  const playingVerseNumberRef = useRef<number>(playingVerseNumber);
  const ayahStartRef = useRef<number | null>(ayahStart);
  const ayahEndRef = useRef<number | null>(ayahEnd);
  const isPlayingRef = useRef(false);
  const pendingSeekPositionRef = useRef<number | null>(null);
  const reciterRef = useRef(reciter);
  const internalPhaseRef = useRef<InternalPhase>("single");
  const cumAyahIdxRef = useRef(0);
  const cumPassRef = useRef(1);
  const cumUpToRef = useRef(0);
  const cumulativeReviewRef = useRef(cumulativeReview);
  const reviewRepeatCountRef = useRef(reviewRepeatCount);

  // Refs for practice settings (audio callbacks close over stale state otherwise)
  const repeatCountRef = useRef(repeatCount);
  const autoAdvanceDelayRef = useRef(autoAdvanceDelayMs);
  const autoplayThroughRangeRef = useRef(autoplayThroughRange);
  const currentRepeatRef = useRef(1);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Layout refs for auto-scroll
  const scrollViewRef = useRef<ScrollView>(null);
  const lineLayoutMap = useRef<Map<string, number>>(new Map());
  const pageCardLayoutMap = useRef<Map<number, number>>(new Map());

  // Recite refs (callbacks read these; state isn't visible inside listeners)
  const reciteModeRef = useRef(false);
  const reciteExpectedIdxRef = useRef(0);
  const displayWordsMapRef = useRef<Map<number, ApiWord[]>>(new Map());
  const surahNumberRef = useRef<number | null>(null);
  const matchedWordCountRef = useRef(0);
  const lastMatchedWordRef = useRef("");
  const lastMatchTimeRef = useRef(0);

  // Keep callback-visible refs in sync with state
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { currentVerseRef.current = currentVerse; }, [currentVerse]);
  useEffect(() => { playingVerseNumberRef.current = playingVerseNumber; }, [playingVerseNumber]);
  useEffect(() => { reciteModeRef.current = reciteMode; }, [reciteMode]);
  useEffect(() => { reciteExpectedIdxRef.current = reciteExpectedIdx; }, [reciteExpectedIdx]);
  useEffect(() => { displayWordsMapRef.current = displayWordsMap; }, [displayWordsMap]);
  useEffect(() => { surahNumberRef.current = surahNumber; }, [surahNumber]);
  useEffect(() => { reciterRef.current = reciter; }, [reciter]);
  useEffect(() => { internalPhaseRef.current = internalPhase; }, [internalPhase]);
  useEffect(() => { cumAyahIdxRef.current = cumAyahIdx; }, [cumAyahIdx]);
  useEffect(() => { cumPassRef.current = cumPass; }, [cumPass]);
  useEffect(() => { cumUpToRef.current = cumUpTo; }, [cumUpTo]);
  useEffect(() => { cumulativeReviewRef.current = cumulativeReview; }, [cumulativeReview]);
  useEffect(() => { reviewRepeatCountRef.current = reviewRepeatCount; }, [reviewRepeatCount]);

  // Clear reveals on context switches so old peeks don't bleed through
  useEffect(() => { setRevealedVerses(new Set()); }, [viewMode]);
  useEffect(() => { setRevealedVerses(new Set()); }, [blindMode]);
  useEffect(() => {
    if (ayahStart !== null) setCumUpTo(ayahStart);
  }, [ayahStart]);
  useEffect(() => { ayahStartRef.current = ayahStart; }, [ayahStart]);
  useEffect(() => { ayahEndRef.current = ayahEnd; }, [ayahEnd]);
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
  useEffect(() => { autoAdvanceDelayRef.current = autoAdvanceDelayMs; }, [autoAdvanceDelayMs]);
  useEffect(() => { autoplayThroughRangeRef.current = autoplayThroughRange; }, [autoplayThroughRange]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);

  // Apply playback rate changes to the currently-playing sound
  useEffect(() => {
    if (soundRef.current && isPlayingRef.current) {
      soundRef.current.setRateAsync(playbackRate, true).catch(() => {
        // best-effort
      });
    }
  }, [playbackRate]);

  // Hydrate profile settings from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      const p = await loadProfileSettings(childId);
      setThemeKey(p.themeKey);
      setReciterId(p.reciterId);
      setViewMode(p.viewMode);
      setSettingsLoaded(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Configure iOS audio session so playback works through the speaker even
  // when the silent switch is on (AirPods always worked via Bluetooth).
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {
      // setAudioModeAsync can fail on simulator; non-fatal in production
    });
  }, []);

  // Persist profile settings on change (300ms debounce, skip during initial hydration)
  useEffect(() => {
    if (!settingsLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveProfileSettings(childId, { themeKey, reciterId, viewMode });
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [childId, settingsLoaded, themeKey, reciterId, viewMode]);

  // Stop audio when reciter changes so next Play tap recreates sound with new URL
  useEffect(() => {
    if (settingsLoaded) {
      void stopAudioCompletely();
    }
  }, [reciterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load chapter metadata once for surah name lookups
  useEffect(() => {
    fetchAllChapters()
      .then((chapters) => {
        const map = new Map<number, ApiChapter>();
        for (const ch of chapters) map.set(ch.id, ch);
        setChaptersMap(map);
      })
      .catch(() => {});
  }, []);

  // Step 1: if no params, fetch dashboard to get today's memorization target
  useEffect(() => {
    if (surahNumber !== null && ayahStart !== null && ayahEnd !== null) {
      setCurrentVerse(ayahStart);
      return;
    }
    (async () => {
      try {
        const dash = await fetchDashboard(childId);
        const nm = dash.todaysPlan.newMemorization;
        if (!nm) {
          setError("No memorization assigned for today.");
          setLoading(false);
          return;
        }
        const sn = nm.currentWorkSurahNumber;
        const as = nm.currentWorkAyahStart;
        const ae = nm.currentWorkAyahEnd;
        setSurahNumber(sn);
        setAyahStart(as);
        setAyahEnd(ae);
        setCurrentVerse(as);
        setPageStart(nm.pageStart);
        setPageEnd(nm.pageEnd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load today's plan.");
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: once surahNumber + chapters are known, fetch verses + timings in parallel.
  // Gated on chaptersMap.size > 0 so chapter metadata (name_arabic etc.) is available.
  useEffect(() => {
    if (surahNumber === null || chaptersMap.size === 0) return;
    const currentReciter = findReciter(reciterId);
    let cancelled = false;
    (async () => {
      try {
        const [verses, timings] = await Promise.all([
          fetchSurahVerses(surahNumber),
          fetchTimingsForReciter(currentReciter, surahNumber),
        ]);
        if (cancelled) return;
        const map = new Map<number, ApiWord[]>();
        for (const verse of verses) {
          map.set(
            verse.verse_number,
            verse.words.filter((w) => w.char_type_name === "word"),
          );
        }
        setDisplayWordsMap(map);
        setChapterTimings(timings);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load verses.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [surahNumber, reciterId, chaptersMap]);

  // Fetch Mushaf page data when switching to Full Mushaf mode
  useEffect(() => {
    if (viewMode !== "page" || pageStart === null || pageEnd === null) return;
    const pagesToFetch: number[] = [];
    for (let p = pageStart; p <= pageEnd; p++) {
      if (!pageWordsMap.has(p)) pagesToFetch.push(p);
    }
    if (pagesToFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(pagesToFetch.map((p) => fetchVersesByPage(p)));
        if (cancelled) return;
        setPageWordsMap((prev) => {
          const next = new Map(prev);
          pagesToFetch.forEach((p, i) => next.set(p, results[i]!));
          return next;
        });
      } catch {
        // fail silently; page card shows loading indicator
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, pageStart, pageEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep segsRef up-to-date for the RAF tick
  useEffect(() => {
    if (surahNumber === null || chapterTimings === null) return;
    if (chapterTimings.kind === "chapter") {
      segsRef.current = chapterTimings.map.get(`${surahNumber}:${playingVerseNumber}`) ?? [];
      return;
    }
    // On-demand: fetch this verse's timings (cached + dedup'd inside fetchQuranComV4VerseTiming)
    let cancelled = false;
    segsRef.current = [];
    chapterTimings.fetch(playingVerseNumber).then((segs) => {
      if (!cancelled && playingVerseNumberRef.current === playingVerseNumber) {
        segsRef.current = segs;
      }
    });
    return () => { cancelled = true; };
  }, [chapterTimings, surahNumber, playingVerseNumber]);

  // Auto-scroll to active verse on verse/mode change (page mode only, best-effort)
  useEffect(() => {
    if (viewMode !== "page" || pageStart === null || pageEnd === null || surahNumber === null) return;
    for (let p = pageStart; p <= pageEnd; p++) {
      const verses = pageWordsMap.get(p);
      if (!verses) continue;
      for (const verse of verses) {
        const ci = verse.verse_key.indexOf(":");
        const vSurah = Number(verse.verse_key.slice(0, ci));
        const vVerse = Number(verse.verse_key.slice(ci + 1));
        if (vSurah !== surahNumber || vVerse !== playingVerseNumber) continue;
        if (!verse.words.length) continue;
        const firstWord = verse.words[0]!;
        const lineKey = `page:${p}:line:${firstWord.line_number}`;
        const lineY = lineLayoutMap.current.get(lineKey);
        const pageCardY = pageCardLayoutMap.current.get(p);
        if (lineY !== undefined && pageCardY !== undefined) {
          // pageCardY = card's Y in scroll content; ~40px header; lineY within pageBody
          const targetY = pageCardY + 40 + lineY;
          scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 80), animated: true });
        }
        return;
      }
    }
  }, [playingVerseNumber, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void stopAudioCompletely();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup + optional auto-play on verse change
  useEffect(() => {
    currentRepeatRef.current = 1;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    cancelAnimationFrame(rafIdRef.current);

    // In recite mode, the highlight tracks the next word to say. On verse change,
    // reset to word 0. Otherwise (audio playback), clear highlight entirely.
    if (reciteModeRef.current) {
      setHighlightedWord(0);
      if (surahNumberRef.current !== null) {
        setHighlightedPage({
          verseKey: `${surahNumberRef.current}:${currentVerseRef.current}`,
          position: 1,
        });
      }
    } else {
      setHighlightedWord(-1);
      setHighlightedPage(null);
    }

    setReciteExpectedIdx(0);
    matchedWordCountRef.current = 0;
    lastMatchedWordRef.current = "";
    positionRef.current = 0;
    durationRef.current = 0;

    let cancelled = false;
    const doChange = async () => {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (cancelled) return;
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        await playVerse(playingVerseNumberRef.current);
        // Seek to tapped word position after new verse starts
        if (pendingSeekPositionRef.current !== null) {
          const pos = pendingSeekPositionRef.current;
          pendingSeekPositionRef.current = null;
          await seekToWordPosition(pos);
        }
      }
    };
    doChange();
    return () => { cancelled = true; };
  }, [playingVerseNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAF highlight loop ───────────────────────────────────────────────────────

  function startRAF() {
    const sn = surahNumber; // captured at call time; stable during playback
    function tick() {
      const dur = durationRef.current;
      const pos = positionRef.current;
      if (dur > 0) {
        const frac = pos / dur;
        const segs = segsRef.current;
        let found = -1;

        if (segs.length > 0) {
          // True word-level timing (Husary via QDC, or any reciter with v4 segments)
          for (const [wordIdx, start, end] of segs) {
            if (frac >= start && frac < end) {
              found = wordIdx - 1; // 0-based display index
              break;
            }
          }
          if (found === -1 && frac > 0) {
            const last = segs[segs.length - 1];
            if (last && frac >= last[1]) found = last[0] - 1;
          }
        } else {
          // Fallback: no segment data. Spread highlight evenly across verse duration,
          // but shift forward by LEAD_MS so the highlight anticipates the audio rather
          // than chasing it. Husary's QDC segments produce a similar anticipatory feel
          // because segment 1 starts at frac=0 and extends through the leading silence.
          // Without this shift, the highlight runs ~300ms behind audio because everyayah
          // files have leading silence before recitation begins.
          const LEAD_MS = 500;
          const wordCount = displayWordsMapRef.current.get(playingVerseNumberRef.current)?.length ?? 0;
          if (wordCount > 0) {
            const shiftedPos = pos + LEAD_MS;
            const shiftedFrac = Math.min(shiftedPos / dur, 1);
            found = Math.min(Math.floor(shiftedFrac * wordCount), wordCount - 1);
          }
        }

        setHighlightedWord(found);
        // Page-mode highlight: 1-based position matches ApiWord.position
        if (sn !== null) {
          if (found === -1) {
            setHighlightedPage(null);
          } else {
            setHighlightedPage({
              verseKey: `${sn}:${playingVerseNumberRef.current}`,
              position: found + 1,
            });
          }
        }
      }
      rafIdRef.current = requestAnimationFrame(tick);
    }
    rafIdRef.current = requestAnimationFrame(tick);
  }

  // ── Audio helpers ────────────────────────────────────────────────────────────

  async function stopAudioCompletely() {
    cancelAnimationFrame(rafIdRef.current);
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // ignore — already unloaded or in bad state
      }
      soundRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    setHighlightedWord(-1);
    setHighlightedPage(null);
    positionRef.current = 0;
    durationRef.current = 0;
    isLoadingRef.current = false;
  }

  function handleSessionComplete() {
    isPlayingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(rafIdRef.current);
    setHighlightedWord(-1);
    setHighlightedPage(null);
  }

  function handleAllRepeatsDone() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    const fromA = ayahStartRef.current;
    const toA = ayahEndRef.current;
    if (fromA === null || toA === null) return;

    const delay = autoAdvanceDelayRef.current;
    const scheduleNext = (fn: () => void) => {
      if (delay > 0) {
        advanceTimeoutRef.current = setTimeout(() => {
          advanceTimeoutRef.current = null;
          fn();
        }, delay);
      } else {
        fn();
      }
    };

    if (internalPhaseRef.current === "single") {
      const cur = currentVerseRef.current;
      if (cumulativeReviewRef.current && cur > fromA) {
        currentRepeatRef.current = 1;
        autoPlayRef.current = true;
        setCumUpTo(cur);
        cumUpToRef.current = cur;
        setCumAyahIdx(0);
        cumAyahIdxRef.current = 0;
        setCumPass(1);
        cumPassRef.current = 1;
        setInternalPhase("cumulative");
        internalPhaseRef.current = "cumulative";
        return;
      }

      if (cur < toA) {
        const shouldAutoAdvance =
          cumulativeReviewRef.current ||
          (viewModeRef.current === "page" && autoplayThroughRangeRef.current);
        currentRepeatRef.current = 1;
        if (shouldAutoAdvance) {
          scheduleNext(() => {
            autoPlayRef.current = true;
            setCurrentVerse((v) => v + 1);
          });
        }
        return;
      }

      handleSessionComplete();
      return;
    }

    const rangeLen = cumUpToRef.current - fromA + 1;
    const nextIdx = cumAyahIdxRef.current + 1;
    if (nextIdx < rangeLen) {
      currentRepeatRef.current = 1;
      autoPlayRef.current = true;
      setCumAyahIdx(nextIdx);
      cumAyahIdxRef.current = nextIdx;
      return;
    }

    const nextPass = cumPassRef.current + 1;
    if (nextPass <= reviewRepeatCountRef.current) {
      currentRepeatRef.current = 1;
      autoPlayRef.current = true;
      setCumAyahIdx(0);
      cumAyahIdxRef.current = 0;
      setCumPass(nextPass);
      cumPassRef.current = nextPass;
      return;
    }

    setInternalPhase("single");
    internalPhaseRef.current = "single";
    if (currentVerseRef.current < toA) {
      currentRepeatRef.current = 1;
      scheduleNext(() => {
        autoPlayRef.current = true;
        setCurrentVerse((v) => v + 1);
      });
    } else {
      handleSessionComplete();
    }
  }

  async function playVerse(verseNum: number) {
    if (reciteModeRef.current) return;
    if (!surahNumber) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const url = ayahAudioUrl(reciter, surahNumber, verseNum);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          positionRef.current = status.positionMillis;
          if (status.durationMillis) durationRef.current = status.durationMillis;
          if (status.didJustFinish) {
            // During cumulative phase each verse plays once (no per-verse repeats).
            const effectiveRepeatCount =
              internalPhaseRef.current === "cumulative" ? 1 : repeatCountRef.current;
            if (currentRepeatRef.current < effectiveRepeatCount) {
              currentRepeatRef.current += 1;
              soundRef.current
                ?.setPositionAsync(0)
                .then(() => soundRef.current?.playAsync())
                .catch(() => {});
              return;
            }
            // All repeats done for this verse
            currentRepeatRef.current = 1;
            cancelAnimationFrame(rafIdRef.current);
            isPlayingRef.current = false;
            setIsPlaying(false);
            setHighlightedWord(-1);
            setHighlightedPage(null);

            // Unload the just-finished sound so the next playVerse creates a fresh instance.
            void (async () => {
              if (soundRef.current) {
                try {
                  await soundRef.current.unloadAsync();
                } catch {
                  // already gone
                }
                soundRef.current = null;
              }
              handleAllRepeatsDone();
            })();
          }
        },
      );
      soundRef.current = sound;
      // Ensure max volume — different everyayah recordings have very different
      // mastered loudness levels (Afasy is significantly quieter than Husary).
      try {
        await sound.setVolumeAsync(1.0);
      } catch {
        // best-effort; sound may already be playing
      }
      try {
        await sound.setRateAsync(playbackRateRef.current, true);
        // shouldCorrectPitch=true keeps recitation pitch natural
      } catch {
        // best-effort; some sound states may reject setRateAsync
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
      startRAF();
    } finally {
      isLoadingRef.current = false;
    }
  }

  async function seekToWordPosition(position: number) {
    const seg = segsRef.current.find((s) => s[0] === position);
    if (!seg) return;
    const dur = durationRef.current;
    if (soundRef.current && dur > 0) {
      await soundRef.current.setPositionAsync(Math.floor(seg[1] * dur));
      if (!isPlayingRef.current) {
        await soundRef.current.playAsync();
        isPlayingRef.current = true;
        setIsPlaying(true);
        startRAF();
      }
    }
  }

  async function handlePlayPause() {
    if (reciteMode) {
      Alert.alert("Recite mode is on", "Turn off Recite mode to play audio.");
      return;
    }
    // Block re-entry while audio is loading. Without this, rapid taps during
    // the createAsync window all fall through to playVerse or to the resume
    // branch and spawn concurrent playback.
    if (isLoadingRef.current) return;

    if (isPlayingRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      await soundRef.current?.pauseAsync();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else if (soundRef.current) {
      // Resume an existing-but-paused sound. Check ref first to avoid race.
      if (isPlayingRef.current) return; // double-check after await boundary
      isPlayingRef.current = true;
      setIsPlaying(true);
      await soundRef.current.playAsync();
      startRAF();
    } else {
      currentRepeatRef.current = 1;
      await playVerse(playingVerseNumberRef.current);
    }
  }

  async function handleWordTap(displayIdx: number) {
    const seg = segsRef.current.find((s) => s[0] - 1 === displayIdx);
    if (!seg) return;
    const dur = durationRef.current;
    if (soundRef.current && dur > 0) {
      await soundRef.current.setPositionAsync(Math.floor(seg[1] * dur));
      if (!isPlayingRef.current) {
        await soundRef.current.playAsync();
        isPlayingRef.current = true;
        setIsPlaying(true);
        startRAF();
      }
    }
  }

  async function handlePageWordTap(verseKey: string, position: number) {
    const ci = verseKey.indexOf(":");
    const vSurah = Number(verseKey.slice(0, ci));
    const vVerse = Number(verseKey.slice(ci + 1));
    if (vSurah !== surahNumber) return;

    if (vVerse !== currentVerse) {
      // Switch to the tapped verse, then seek to the tapped word after load
      pendingSeekPositionRef.current = position;
      autoPlayRef.current = true;
      setCurrentVerse(vVerse);
      return;
    }

    await seekToWordPosition(position);
  }

  function handlePrev() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (internalPhaseRef.current === "cumulative") {
      setInternalPhase("single");
      internalPhaseRef.current = "single";
      void stopAudioCompletely();
      return;
    }
    if (ayahStart === null || currentVerse <= ayahStart) return;
    autoPlayRef.current = true;
    setCurrentVerse((v) => v - 1);
  }

  function handleNext() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }

    if (internalPhaseRef.current === "cumulative") {
      void stopAudioCompletely();
      setInternalPhase("single");
      internalPhaseRef.current = "single";
      if (
        ayahEndRef.current !== null &&
        currentVerseRef.current < ayahEndRef.current
      ) {
        autoPlayRef.current = true;
        setCurrentVerse((v) => v + 1);
      }
      return;
    }

    if (
      cumulativeReviewRef.current &&
      ayahStartRef.current !== null &&
      currentVerseRef.current > ayahStartRef.current
    ) {
      const cur = currentVerseRef.current;
      currentRepeatRef.current = 1;
      autoPlayRef.current = true;
      setCumUpTo(cur);
      cumUpToRef.current = cur;
      setCumAyahIdx(0);
      cumAyahIdxRef.current = 0;
      setCumPass(1);
      cumPassRef.current = 1;
      setInternalPhase("cumulative");
      internalPhaseRef.current = "cumulative";
      if (isPlayingRef.current) {
        void stopAudioCompletely();
      }
      return;
    }

    if (ayahEnd === null || currentVerse >= ayahEnd) return;
    autoPlayRef.current = true;
    setCurrentVerse((v) => v + 1);
  }

  async function handleMarkComplete() {
    if (!surahNumber || ayahStart === null || ayahEnd === null) return;
    setInternalPhase("single");
    internalPhaseRef.current = "single";
    void stopAudioCompletely();
    const ayahs = Array.from({ length: ayahEnd - ayahStart + 1 }, (_, i) => ayahStart + i);
    setSubmitting(true);
    try {
      await submitMemorization(childId, {
        surahId: surahNumber,
        memorizedAyahs: ayahs,
        ratedAyahs: ayahs,
        qualityRating: 5,
        status: "memorized",
      });

      Alert.alert("Marked complete.", undefined, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Recite mode ──────────────────────────────────────────────────────────────

  async function startRecognition() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setReciteError("Microphone or speech recognition permission denied.");
      setReciteMode(false);
      Alert.alert(
        "Permission needed",
        "NoorPath needs microphone and speech recognition access. Enable them in Settings.",
      );
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "ar-SA",
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: false,
      maxAlternatives: 1,
    });
    setReciteListening(true);
    setReciteError(null);
  }

  useSpeechRecognitionEvent("result", (event) => {
    if (!reciteModeRef.current) return;

    // Debounce: ignore rapid-fire interim events right after a successful match.
    if (Date.now() - lastMatchTimeRef.current < 300) return;

    const result = event.results?.[0];
    if (!result) return;
    const transcript = result.transcript ?? "";
    if (!transcript) return;
    const isFinal = !!event.isFinal;

    const heardNormFull = stripTashkeel(transcript);
    const heardTokens = tokenize(heardNormFull);

    const verseWords = displayWordsMapRef.current.get(currentVerseRef.current);
    if (!verseWords) return;

    let expectedIdx = reciteExpectedIdxRef.current;
    let advanced = false;
    let searchFrom = matchedWordCountRef.current;

    // Walk forward through expected words, advancing as long as we keep finding
    // matches in the heard tokens. This handles iOS's growing partial transcript
    // — every result event includes everything heard so far in this utterance.
    while (expectedIdx < verseWords.length) {
      const expectedRaw = verseWords[expectedIdx]?.text_uthmani ?? "";
      if (!expectedRaw || SKIP_CHARS.test(expectedRaw)) {
        expectedIdx++;
        continue;
      }

      const expectedNorm = stripTashkeel(expectedRaw);
      if (!expectedNorm) {
        expectedIdx++;
        continue;
      }
      // Try with and without ال prefix
      const expectedTry = stripAlPrefix(expectedNorm);
      const expectedFinal = expectedTry.length >= 2 ? expectedTry : expectedNorm;

      // Skip Uthmani words that strip to ≤2 chars of only ه/ا — ligature artifacts
      // speech recognition will never produce.
      if (expectedFinal.length <= 2 && /^[هاا]+$/.test(expectedFinal)) {
        expectedIdx++;
        continue;
      }

      // Scan the heard transcript from searchFrom onward for any token matching expected
      let foundAt = -1;
      for (let i = searchFrom; i < heardTokens.length; i++) {
        const heardRaw = heardTokens[i];
        if (!heardRaw) continue;
        const heardTry = stripAlPrefix(heardRaw);
        const heardFinal = heardTry.length >= 2 ? heardTry : heardRaw;
        if (wordMatches(heardFinal, expectedFinal, lastMatchedWordRef.current)) {
          foundAt = i;
          break;
        }
      }

      if (foundAt === -1) break; // no more expected matches in this transcript

      advanced = true;
      lastMatchTimeRef.current = Date.now();
      const matchedRaw = heardTokens[foundAt];
      if (!matchedRaw) break;
      const matchedTry = stripAlPrefix(matchedRaw);
      lastMatchedWordRef.current = matchedTry.length >= 2 ? matchedTry : matchedRaw;
      matchedWordCountRef.current = foundAt + 1;
      searchFrom = foundAt + 1;

      expectedIdx++;
    }

    if (advanced) {
      if (expectedIdx >= verseWords.length) {
        if (
          ayahEndRef.current !== null &&
          currentVerseRef.current < ayahEndRef.current
        ) {
          // Move to next verse — the [currentVerse] effect resets the recite state.
          setCurrentVerse((v) => v + 1);
        } else {
          setReciteListening(false);
          ExpoSpeechRecognitionModule.stop();
          Alert.alert("MashaAllah!", "You recited the whole range.");
        }
      } else {
        setReciteExpectedIdx(expectedIdx);
        setHighlightedWord(expectedIdx);
        if (surahNumberRef.current !== null) {
          setHighlightedPage({
            verseKey: `${surahNumberRef.current}:${currentVerseRef.current}`,
            position: expectedIdx + 1,
          });
        }
      }
    }

    // Final result closes this utterance — reset search position so the
    // next utterance starts fresh from token 0.
    if (isFinal) {
      matchedWordCountRef.current = 0;
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!reciteModeRef.current) return;
    setReciteError(event.error ?? "Recognition error");
    setReciteListening(false);
  });

  useSpeechRecognitionEvent("end", () => {
    if (reciteModeRef.current) {
      startRecognition();
    } else {
      setReciteListening(false);
    }
  });

  useEffect(() => {
    if (reciteMode) {
      startRecognition();
    } else {
      ExpoSpeechRecognitionModule.stop();
      setReciteListening(false);
    }
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [reciteMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleVerseReveal(verseKey: string) {
    setRevealedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(verseKey)) {
        next.delete(verseKey);
      } else {
        next.add(verseKey);
      }
      return next;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getTranslationText(t: ApiWord["translation"]): string {
    if (!t) return "";
    if (typeof t === "string") return t;
    return t.text ?? "";
  }

  // ── Full Mushaf page renderer ────────────────────────────────────────────────

  function renderMushafPage(pageNum: number) {
    const verses = pageWordsMap.get(pageNum);

    if (!verses) {
      return (
        <View key={pageNum} style={[themedStyles.pageCard, styles.centered, { minHeight: 200 }]}>
          <ActivityIndicator color={THEMES[themeKey].pageMuted} />
        </View>
      );
    }

    // Group all words (including end markers) by line_number
    const lineMap = new Map<number, Array<{ word: ApiWord; verseKey: string }>>();
    for (const verse of verses) {
      for (const word of verse.words) {
        const ln = word.line_number;
        if (!lineMap.has(ln)) lineMap.set(ln, []);
        lineMap.get(ln)!.push({ word, verseKey: verse.verse_key });
      }
    }

    // Surah banners: injected before the first line of each new surah on the page
    let prevSurah: number | null = null;
    const bannerBeforeLine = new Map<number, number>(); // lineNum → surahNumber
    for (const verse of verses) {
      if (!verse.words.length) continue;
      const ci = verse.verse_key.indexOf(":");
      const vSurah = Number(verse.verse_key.slice(0, ci));
      const vVerse = Number(verse.verse_key.slice(ci + 1));
      const firstWord = verse.words[0];
      if (!firstWord) continue;
      if (prevSurah === null && vVerse === 1) {
        bannerBeforeLine.set(firstWord.line_number, vSurah);
      } else if (prevSurah !== null && vSurah !== prevSurah) {
        bannerBeforeLine.set(firstWord.line_number, vSurah);
      }
      prevSurah = vSurah;
    }

    const uniqueSurahs: number[] = [];
    for (const verse of verses) {
      const ci = verse.verse_key.indexOf(":");
      const vSurah = Number(verse.verse_key.slice(0, ci));
      if (!uniqueSurahs.includes(vSurah)) uniqueSurahs.push(vSurah);
    }
    const surahNamesStr = uniqueSurahs
      .map((s) => chaptersMap.get(s)?.name_arabic ?? "")
      .filter(Boolean)
      .join(" · ");

    const juz = getJuzForPage(pageNum);
    const lineNums = [...lineMap.keys()].sort((a, b) => a - b);

    return (
      <View
        key={pageNum}
        style={themedStyles.pageCard}
        onLayout={(e) => {
          pageCardLayoutMap.current.set(pageNum, e.nativeEvent.layout.y);
        }}
      >
        {/* Header bar: surah names (left) + Juz label (right) */}
        <View style={themedStyles.pageHeader}>
          <Text style={themedStyles.pageHeaderNames} numberOfLines={1}>
            {surahNamesStr}
          </Text>
          <Text style={themedStyles.pageHeaderJuz}>{`JUZ ${juz}`}</Text>
        </View>

        {/* Page body: lines with surah banners injected at surah transitions */}
        <View style={styles.pageBody}>
          {lineNums.map((lineNum) => {
            const lineItems = lineMap.get(lineNum)!;
            const bannerSurahNum = bannerBeforeLine.get(lineNum);
            const bannerName =
              bannerSurahNum !== undefined
                ? (chaptersMap.get(bannerSurahNum)?.name_arabic ?? "")
                : null;

            return (
              <React.Fragment key={lineNum}>
                {bannerSurahNum !== undefined && (
                  <View style={styles.surahBanner}>
                    <View style={themedStyles.surahBannerRule} />
                    <View style={styles.surahBannerLabel}>
                      <Text style={themedStyles.surahBannerText}>{bannerName}</Text>
                    </View>
                    <View style={themedStyles.surahBannerRule} />
                  </View>
                )}
                {/*
                 * One canonical Mushaf line may wrap to 2+ visual lines on phones.
                 * Real per-page typography is a later phase.
                 */}
                <View
                  style={styles.mushafLine}
                  onLayout={(e) => {
                    lineLayoutMap.current.set(
                      `page:${pageNum}:line:${lineNum}`,
                      e.nativeEvent.layout.y,
                    );
                  }}
                >
                  {lineItems.map((item, idx) => {
                    const ci = item.verseKey.indexOf(":");
                    const vSurah = Number(item.verseKey.slice(0, ci));
                    const vVerse = Number(item.verseKey.slice(ci + 1));
                    const inScope =
                      surahNumber !== null &&
                      ayahStart !== null &&
                      ayahEnd !== null &&
                      vSurah === surahNumber &&
                      vVerse >= ayahStart &&
                      vVerse <= ayahEnd;

                    if (item.word.char_type_name === "end") {
                      return (
                        <Text
                          key={`${item.verseKey}-${item.word.position}-${idx}`}
                          style={[
                            themedStyles.mushafEndMarker,
                            !inScope && themedStyles.mushafWordDimmed,
                          ]}
                        >
                          {item.word.text_uthmani}
                        </Text>
                      );
                    }

                    const isHighlighted =
                      highlightedPage?.verseKey === item.verseKey &&
                      highlightedPage?.position === item.word.position;
                    const verseHidden = inScope && blindMode && !revealedVerses.has(item.verseKey);
                    const isCurrentlyPlayingVerse =
                      isPlaying && item.verseKey === `${surahNumber}:${playingVerseNumber}`;
                    const isBlurred =
                      blurMode && isPlaying && inScope && !isCurrentlyPlayingVerse;

                    const tajweedColor =
                      tajweedEnabled && inScope
                        ? extractTajweedColor(item.word.text_uthmani_tajweed)
                        : null;
                    return (
                      <Pressable
                        key={`${item.verseKey}-${item.word.position}-${idx}`}
                        style={isHighlighted ? themedStyles.mushafWordHighlighted : undefined}
                        onPress={
                          inScope
                            ? () => {
                                if (blindMode) {
                                  toggleVerseReveal(item.verseKey);
                                  return;
                                }
                                handlePageWordTap(item.verseKey, item.word.position);
                              }
                            : undefined
                        }
                        onLongPress={
                          inScope
                            ? () => {
                                const translation = getTranslationText(item.word.translation);
                                if (translation) {
                                  setTranslationPopup({
                                    arabic: item.word.text_uthmani,
                                    translation,
                                  });
                                }
                              }
                            : undefined
                        }
                        delayLongPress={400}
                      >
                        <Text
                          style={[
                            themedStyles.mushafWord,
                            !inScope && themedStyles.mushafWordDimmed,
                            isBlurred && styles.mushafWordBlurred,
                            tajweedColor ? { color: tajweedColor } : undefined,
                          ]}
                        >
                          {verseHidden ? "••••" : item.word.text_uthmani}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Footer: centered page number */}
        <View style={themedStyles.pageFooter}>
          <Text style={themedStyles.pageFooterText}>{pageNum}</Text>
        </View>
      </View>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const words = displayWordsMap.get(playingVerseNumber) ?? [];
  const ayahVerseKey = surahNumber !== null ? `${surahNumber}:${playingVerseNumber}` : "";
  const ayahVerseHidden = blindMode && !revealedVerses.has(ayahVerseKey);
  const verseIndex = ayahStart !== null ? currentVerse - ayahStart + 1 : 1;
  const totalVerses = ayahStart !== null && ayahEnd !== null ? ayahEnd - ayahStart + 1 : 0;
  const canPrev = ayahStart !== null && currentVerse > ayahStart;
  const canNext = internalPhase === "cumulative" || (ayahEnd !== null && currentVerse < ayahEnd);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#2563eb" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {reciteMode
            ? `Recite Verse ${verseIndex} of ${totalVerses}`
            : internalPhase === "cumulative" && ayahStart !== null
              ? `Pass ${cumPass}/${reviewRepeatCount} · Ayahs ${ayahStart}–${cumUpTo}`
              : `Verse ${verseIndex} of ${totalVerses}`}
        </Text>
        <Pressable
          style={styles.headerButton}
          onPress={() => setSettingsOpen(true)}
        >
          <Text style={styles.headerButtonIcon}>⚙</Text>
        </Pressable>
      </View>

      {/* View mode toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.togglePill, viewMode === "ayah" && styles.togglePillSelected]}
          onPress={() => setViewMode("ayah")}
        >
          <Text
            style={[
              styles.togglePillText,
              viewMode === "ayah" && styles.togglePillTextSelected,
            ]}
          >
            Ayah by Ayah
          </Text>
        </Pressable>
        <Pressable
          style={[styles.togglePill, viewMode === "page" && styles.togglePillSelected]}
          onPress={() => setViewMode("page")}
        >
          <Text
            style={[
              styles.togglePillText,
              viewMode === "page" && styles.togglePillTextSelected,
            ]}
          >
            Full Mushaf
          </Text>
        </Pressable>
      </View>

      {/* Scrollable content — flex: 1 so controls island stays pinned below */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
      >
        {viewMode === "ayah" ? (
          <View style={styles.verseCard}>
            <View style={styles.wordContainer}>
              {words.map((word, idx) => {
                const tajweedColor = tajweedEnabled ? extractTajweedColor(word.text_uthmani_tajweed) : null;
                return (
                  <Pressable
                    key={`${playingVerseNumber}-${idx}`}
                    onPress={() => {
                      if (blindMode) {
                        toggleVerseReveal(ayahVerseKey);
                        return;
                      }
                      handleWordTap(idx);
                    }}
                    onLongPress={() => {
                      const translation = getTranslationText(word.translation);
                      if (translation) {
                        setTranslationPopup({ arabic: word.text_uthmani, translation });
                      }
                    }}
                    delayLongPress={400}
                    style={[styles.wordWrapper, highlightedWord === idx && styles.wordHighlighted]}
                  >
                    <Text
                      style={[
                        styles.arabicWord,
                        tajweedColor ? { color: tajweedColor } : undefined,
                      ]}
                    >
                      {ayahVerseHidden ? "••••" : word.text_uthmani}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : pageStart === null || pageEnd === null ? (
          <View style={[themedStyles.pageCard, styles.centered, { minHeight: 200 }]}>
            <Text style={styles.errorText}>Page data not available.</Text>
          </View>
        ) : (
          <>
            {Array.from({ length: pageEnd - pageStart + 1 }, (_, i) =>
              renderMushafPage(pageStart + i),
            )}
          </>
        )}
      </ScrollView>

      {/* Fixed controls island — always visible below the scroll area */}
      <View style={styles.controlsIsland}>
        {/* Mode buttons: Blind + Recite placeholder */}
        <View style={styles.modeButtonRow}>
          <Pressable
            style={[styles.modeButton, blindMode && styles.modeButtonActive]}
            onPress={() => setBlindMode(!blindMode)}
          >
            <Text style={[styles.modeButtonText, blindMode && styles.modeButtonTextActive]}>
              {blindMode ? "👁 Blind ON" : "Blind"}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeButton,
              reciteMode && styles.modeButtonActive,
            ]}
            onPress={async () => {
              if (reciteMode) {
                setReciteMode(false);
                return;
              }
              // Fully release the audio session so expo-speech-recognition can claim the mic.
              // pauseAsync alone leaves iOS holding the session for expo-av, blocking mic access.
              await stopAudioCompletely();
              setInternalPhase("single");
              internalPhaseRef.current = "single";
              matchedWordCountRef.current = 0;
              lastMatchedWordRef.current = "";
              setReciteExpectedIdx(0);
              setHighlightedWord(0);
              if (surahNumberRef.current !== null) {
                setHighlightedPage({
                  verseKey: `${surahNumberRef.current}:${currentVerse}`,
                  position: 1,
                });
              }
              setReciteMode(true);
            }}
          >
            <Text style={[styles.modeButtonText, reciteMode && styles.modeButtonTextActive]}>
              {reciteMode ? (reciteListening ? "🎤 Listening…" : "🎤 Recite ON") : "🎤 Recite"}
            </Text>
          </Pressable>
        </View>

        {/* Prev / Play / Next */}
        <View style={styles.controls}>
          <Pressable
            style={[styles.navButton, !canPrev && styles.navButtonDisabled]}
            onPress={handlePrev}
            disabled={!canPrev}
          >
            <Text style={styles.navButtonText}>‹ Prev</Text>
          </Pressable>

          <Pressable style={styles.playButton} onPress={handlePlayPause}>
            <Text style={styles.playButtonText}>{isPlaying ? "⏸" : "▶"}</Text>
          </Pressable>

          <Pressable
            style={[styles.navButton, !canNext && styles.navButtonDisabled]}
            onPress={handleNext}
            disabled={!canNext}
          >
            <Text style={styles.navButtonText}>Next ›</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.completeButton, submitting && styles.completeButtonDisabled]}
          onPress={handleMarkComplete}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.completeButtonText}>Mark Complete</Text>
          )}
        </Pressable>
      </View>

      {/* Recite error */}
      {reciteError && (
        <Text style={styles.errorText}>{reciteError}</Text>
      )}

      {/* Settings bottom sheet */}
      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} />
        <View style={styles.settingsSheet}>
          <Text style={styles.sheetTitle}>Settings</Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Repeat count</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setRepeatCount(Math.max(1, repeatCount - 1))}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{repeatCount}</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setRepeatCount(Math.min(10, repeatCount + 1))}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Delay between verses</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setAutoAdvanceDelayMs(Math.max(0, autoAdvanceDelayMs - 500))}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{(autoAdvanceDelayMs / 1000).toFixed(1)}s</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setAutoAdvanceDelayMs(Math.min(5000, autoAdvanceDelayMs + 500))}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Autoplay through range (Full Mushaf)</Text>
            <Pressable
              onPress={() => setAutoplayThroughRange(!autoplayThroughRange)}
              style={[styles.toggleSwitch, autoplayThroughRange && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, autoplayThroughRange && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Blur other verses while playing</Text>
            <Pressable
              onPress={() => setBlurMode(!blurMode)}
              style={[styles.toggleSwitch, blurMode && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, blurMode && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Tajweed coloring</Text>
            <Pressable
              onPress={() => setTajweedEnabled(!tajweedEnabled)}
              style={[styles.toggleSwitch, tajweedEnabled && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, tajweedEnabled && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Cumulative review</Text>
            <Pressable
              onPress={() => setCumulativeReview(!cumulativeReview)}
              style={[styles.toggleSwitch, cumulativeReview && styles.toggleSwitchOn]}
            >
              <View style={[styles.toggleKnob, cumulativeReview && styles.toggleKnobOn]} />
            </Pressable>
          </View>

          {cumulativeReview && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Review repeat count</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setReviewRepeatCount(Math.max(1, reviewRepeatCount - 1))}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{reviewRepeatCount}×</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setReviewRepeatCount(Math.min(10, reviewRepeatCount + 1))}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Playback speed</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {PLAYBACK_RATES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setPlaybackRate(r)}
                style={[
                  styles.ratePill,
                  playbackRate === r && styles.ratePillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.ratePillText,
                    playbackRate === r && styles.ratePillTextSelected,
                  ]}
                >
                  {r === 1.0 ? "1x" : `${r}x`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Theme</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => setThemeKey(k)}
                style={[
                  styles.themePill,
                  themeKey === k && styles.themePillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.themePillText,
                    themeKey === k && styles.themePillTextSelected,
                  ]}
                >
                  {THEME_DISPLAY_NAMES[k]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Reciter</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {RECITERS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReciterId(r.id)}
                style={[
                  styles.reciterPill,
                  reciterId === r.id && styles.reciterPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.reciterPillText,
                    reciterId === r.id && styles.reciterPillTextSelected,
                  ]}
                >
                  {r.fullName.split(" ").slice(-1)[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.sheetDoneButton} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={translationPopup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTranslationPopup(null)}
      >
        <Pressable style={styles.translationBackdrop} onPress={() => setTranslationPopup(null)}>
          <Pressable onPress={() => {}} style={styles.translationCard}>
            <Text style={styles.translationArabic}>{translationPopup?.arabic ?? ""}</Text>
            <Text style={styles.translationText}>{translationPopup?.translation ?? ""}</Text>
            <Pressable style={styles.translationCloseButton} onPress={() => setTranslationPopup(null)}>
              <Text style={styles.translationCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Themed styles factory ────────────────────────────────────────────────────
// Called from useMemo inside the component; defined at module scope so the
// StyleSheet.create call is not recreated on every render.

function makeThemedStyles(theme: MushafTheme) {
  return StyleSheet.create({
    pageCard: {
      width: "100%",
      backgroundColor: theme.page,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.pageBorder,
      overflow: "hidden",
    },
    pageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.pageBorder,
    },
    pageHeaderNames: {
      flex: 1,
      fontFamily: "AmiriQuran",
      fontSize: 13,
      color: theme.pageLabel,
    },
    pageHeaderJuz: {
      fontSize: 11,
      color: theme.pageLabel,
      letterSpacing: 2,
      fontWeight: "600",
      marginLeft: 8,
    },
    pageFooter: {
      borderTopWidth: 1,
      borderTopColor: theme.pageBorder,
      paddingVertical: 6,
      alignItems: "center",
    },
    pageFooterText: {
      fontSize: 11,
      color: theme.pageLabel,
      letterSpacing: 3,
    },
    surahBannerRule: {
      flex: 1,
      height: 1,
      backgroundColor: theme.pageRule,
    },
    surahBannerText: {
      fontFamily: "AmiriQuran",
      fontSize: 18,
      color: theme.pageLabel,
      fontWeight: "600",
    },
    mushafWord: {
      fontFamily: "AmiriQuran",
      fontSize: 20,
      lineHeight: 38,
      color: theme.pageText,
      marginHorizontal: 1,
    },
    mushafEndMarker: {
      fontFamily: "AmiriQuran",
      fontSize: 16,
      lineHeight: 38,
      color: theme.pageText,
      marginHorizontal: 4,
    },
    mushafWordDimmed: {
      color: theme.pageMuted,
    },
    mushafWordHighlighted: {
      backgroundColor: theme.activeHighlight,
      borderRadius: 3,
      paddingHorizontal: 2,
    },
  });
}

// ── Static styles (no theme references) ─────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  back: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "500",
    width: 60,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  headerButton: {
    width: 60,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerButtonIcon: {
    fontSize: 22,
    color: "#2563eb",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  togglePill: {
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  togglePillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  togglePillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  togglePillTextSelected: {
    color: "#ffffff",
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
    gap: 24,
    paddingBottom: 16,
  },
  // ── Ayah-by-Ayah card ────────────────────────────────────────────────────────
  verseCard: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 20,
    minHeight: 160,
    justifyContent: "center",
  },
  wordContainer: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  wordWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginHorizontal: 2,
    marginVertical: 4,
    borderRadius: 4,
  },
  wordHighlighted: {
    backgroundColor: "#dbeafe",
  },
  arabicWord: {
    fontFamily: "AmiriQuran",
    fontSize: 32,
    lineHeight: 60,
    color: "#111111",
  },
  // ── Parchment Mushaf page card (static parts) ────────────────────────────────
  pageBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // ── Surah banner (static parts) ─────────────────────────────────────────────
  surahBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  surahBannerLabel: {
    paddingHorizontal: 12,
  },
  // ── Mushaf line words (static parts) ────────────────────────────────────────
  mushafLine: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  mushafWordBlurred: {
    opacity: 0.35,
  },
  // ── Fixed controls island ────────────────────────────────────────────────────
  controlsIsland: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  modeButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  modeButton: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  navButton: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  playButton: {
    backgroundColor: "#2563eb",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 22,
  },
  completeButton: {
    width: "100%",
    backgroundColor: "#111111",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  completeButtonDisabled: {
    backgroundColor: "#555555",
  },
  completeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  // ── Settings sheet ───────────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  settingsSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: "#111111",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperButton: {
    width: 40,
    height: 40,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
    minWidth: 36,
    textAlign: "center",
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: "#2563eb",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  toggleKnobOn: {
    alignSelf: "flex-end",
  },
  sheetDoneButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  sheetDoneText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  // ── Theme + Reciter picker pills ─────────────────────────────────────────────
  themePill: {
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  themePillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  themePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111111",
  },
  themePillTextSelected: {
    color: "#ffffff",
  },
  reciterPill: {
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reciterPillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  reciterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111111",
  },
  reciterPillTextSelected: {
    color: "#ffffff",
  },
  ratePill: {
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 56,
    alignItems: "center",
  },
  ratePillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  ratePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111111",
  },
  ratePillTextSelected: {
    color: "#ffffff",
  },
  translationBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  translationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 16,
    minWidth: 240,
    maxWidth: "90%",
  },
  translationArabic: {
    fontFamily: "AmiriQuran",
    fontSize: 32,
    lineHeight: 56,
    color: "#111111",
    textAlign: "center",
  },
  translationText: {
    fontSize: 16,
    color: "#444444",
    textAlign: "center",
    lineHeight: 22,
  },
  translationCloseButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    marginTop: 4,
  },
  translationCloseText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
