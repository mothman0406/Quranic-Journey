import React, { useEffect, useRef, useState } from "react";
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
import { matchesExpectedWord } from "@/src/lib/recite";
import {
  fetchDashboard,
  fetchQdcChapterTimings,
  submitMemorization,
  type Segment,
} from "@/src/lib/memorization";
import {
  fetchSurahVerses,
  fetchVersesByPage,
  fetchAllChapters,
  type ApiWord,
  type ApiPageVerse,
  type ApiChapter,
} from "@/src/lib/quran";
import { MUSHAF_PAGE_THEME as T, getJuzForPage } from "@/src/lib/mushaf-theme";

const HUSARY_QDC_ID = 6;

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
  const [segmentsMap, setSegmentsMap] = useState<Map<string, Segment[]>>(new Map());
  const [viewMode, setViewMode] = useState<"ayah" | "page">("ayah");
  const [pageWordsMap, setPageWordsMap] = useState<Map<number, ApiPageVerse[]>>(new Map());
  const [chaptersMap, setChaptersMap] = useState<Map<number, ApiChapter>>(new Map());

  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState(-1);
  const [highlightedPage, setHighlightedPage] = useState<{
    verseKey: string;
    position: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Practice settings (session-only; persistence in Slice 5)
  const [repeatCount, setRepeatCount] = useState(1);
  const [autoAdvanceDelayMs, setAutoAdvanceDelayMs] = useState(0);
  const [autoplayThroughRange, setAutoplayThroughRange] = useState(true);
  const [blindMode, setBlindMode] = useState(false);
  const [blurMode, setBlurMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revealedVerses, setRevealedVerses] = useState<Set<string>>(new Set());

  // Recite mode
  const [reciteMode, setReciteMode] = useState(false);
  const [reciteListening, setReciteListening] = useState(false);
  const [reciteError, setReciteError] = useState<string | null>(null);
  const [reciteExpectedIdx, setReciteExpectedIdx] = useState(0);

  // Audio + RAF refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const rafIdRef = useRef<number>(0);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const segsRef = useRef<Segment[]>([]);
  const autoPlayRef = useRef(false);

  // Refs readable inside async callbacks and RAF ticks (avoid stale closures)
  const viewModeRef = useRef<"ayah" | "page">(viewMode);
  const currentVerseRef = useRef<number>(currentVerse);
  const ayahEndRef = useRef<number | null>(ayahEnd);
  const isPlayingRef = useRef(false);
  const pendingSeekPositionRef = useRef<number | null>(null);

  // Refs for practice settings (audio callbacks close over stale state otherwise)
  const repeatCountRef = useRef(repeatCount);
  const autoAdvanceDelayRef = useRef(autoAdvanceDelayMs);
  const autoplayThroughRangeRef = useRef(autoplayThroughRange);
  const currentRepeatRef = useRef(1);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Layout refs for auto-scroll
  const scrollViewRef = useRef<ScrollView>(null);
  const lineLayoutMap = useRef<Map<string, number>>(new Map());
  const pageCardLayoutMap = useRef<Map<number, number>>(new Map());

  // Recite refs (callbacks read these; state isn't visible inside listeners)
  const reciteModeRef = useRef(false);
  const reciteExpectedIdxRef = useRef(0);
  const displayWordsMapRef = useRef<Map<number, ApiWord[]>>(new Map());
  const surahNumberRef = useRef<number | null>(null);

  // Keep callback-visible refs in sync with state
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { currentVerseRef.current = currentVerse; }, [currentVerse]);
  useEffect(() => { reciteModeRef.current = reciteMode; }, [reciteMode]);
  useEffect(() => { reciteExpectedIdxRef.current = reciteExpectedIdx; }, [reciteExpectedIdx]);
  useEffect(() => { displayWordsMapRef.current = displayWordsMap; }, [displayWordsMap]);
  useEffect(() => { surahNumberRef.current = surahNumber; }, [surahNumber]);

  // Clear reveals on context switches so old peeks don't bleed through
  useEffect(() => { setRevealedVerses(new Set()); }, [viewMode]);
  useEffect(() => { setRevealedVerses(new Set()); }, [blindMode]);
  useEffect(() => { ayahEndRef.current = ayahEnd; }, [ayahEnd]);
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
  useEffect(() => { autoAdvanceDelayRef.current = autoAdvanceDelayMs; }, [autoAdvanceDelayMs]);
  useEffect(() => { autoplayThroughRangeRef.current = autoplayThroughRange; }, [autoplayThroughRange]);

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

  // Step 2: once surahNumber is known, fetch verses + QDC timings in parallel
  useEffect(() => {
    if (surahNumber === null) return;
    let cancelled = false;
    (async () => {
      try {
        const [verses, timings] = await Promise.all([
          fetchSurahVerses(surahNumber),
          fetchQdcChapterTimings(HUSARY_QDC_ID, surahNumber),
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
        setSegmentsMap(timings);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load verses.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [surahNumber]);

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
    if (surahNumber !== null) {
      segsRef.current = segmentsMap.get(`${surahNumber}:${currentVerse}`) ?? [];
    }
  }, [segmentsMap, surahNumber, currentVerse]);

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
        if (vSurah !== surahNumber || vVerse !== currentVerse) continue;
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
  }, [currentVerse, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      soundRef.current?.unloadAsync();
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  // Cleanup + optional auto-play on verse change
  useEffect(() => {
    currentRepeatRef.current = 1;
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    cancelAnimationFrame(rafIdRef.current);
    setHighlightedWord(-1);
    setHighlightedPage(null);
    setReciteExpectedIdx(0);
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
        await playVerse(currentVerse);
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
  }, [currentVerse]); // eslint-disable-line react-hooks/exhaustive-deps

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
        for (const [wordIdx, start, end] of segs) {
          if (frac >= start && frac < end) {
            found = wordIdx - 1; // 0-based display index
            break;
          }
        }
        // Stick on last word after audio ends
        if (found === -1 && frac > 0 && segs.length > 0) {
          const last = segs[segs.length - 1];
          if (last && frac >= last[1]) found = last[0] - 1;
        }
        setHighlightedWord(found);
        // Page-mode highlight: 1-based position matches ApiWord.position
        if (sn !== null) {
          if (found === -1) {
            setHighlightedPage(null);
          } else {
            setHighlightedPage({
              verseKey: `${sn}:${currentVerseRef.current}`,
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

  async function playVerse(verseNum: number) {
    if (reciteModeRef.current) return;
    if (!surahNumber) return;
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    const url = ayahAudioUrl(surahNumber, verseNum);
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true },
      (status) => {
        if (!status.isLoaded) return;
        positionRef.current = status.positionMillis;
        if (status.durationMillis) durationRef.current = status.durationMillis;
        if (status.didJustFinish) {
          // Repeat logic: replay this verse without unloading if repeat count not reached
          if (currentRepeatRef.current < repeatCountRef.current) {
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
          // Page mode: auto-advance to next verse in scope (gated by autoplayThroughRange)
          const shouldAutoAdvance =
            viewModeRef.current === "page" &&
            autoplayThroughRangeRef.current &&
            ayahEndRef.current !== null &&
            currentVerseRef.current < ayahEndRef.current;
          if (shouldAutoAdvance) {
            const delay = autoAdvanceDelayRef.current;
            if (delay > 0) {
              advanceTimeoutRef.current = setTimeout(() => {
                advanceTimeoutRef.current = null;
                autoPlayRef.current = true;
                setCurrentVerse((v) => v + 1);
              }, delay);
            } else {
              autoPlayRef.current = true;
              setCurrentVerse((v) => v + 1);
            }
          }
        }
      },
    );
    soundRef.current = sound;
    isPlayingRef.current = true;
    setIsPlaying(true);
    startRAF();
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
      Alert.alert("Recite mode is on", "Turn off Recite mode to play Husary.");
      return;
    }
    if (isPlaying) {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
      cancelAnimationFrame(rafIdRef.current);
      await soundRef.current?.pauseAsync();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else if (soundRef.current) {
      await soundRef.current.playAsync();
      isPlayingRef.current = true;
      setIsPlaying(true);
      startRAF();
    } else {
      currentRepeatRef.current = 1;
      await playVerse(currentVerse);
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
    if (ayahStart === null || currentVerse <= ayahStart) return;
    autoPlayRef.current = true;
    setCurrentVerse((v) => v - 1);
  }

  function handleNext() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (ayahEnd === null || currentVerse >= ayahEnd) return;
    autoPlayRef.current = true;
    setCurrentVerse((v) => v + 1);
  }

  async function handleMarkComplete() {
    if (!surahNumber || ayahStart === null || ayahEnd === null) return;
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
      Alert.alert("Marked complete.", undefined, [{ text: "OK", onPress: () => router.back() }]);
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
    const transcript = event.results?.[0]?.transcript ?? "";
    if (!transcript) return;

    const verseWords = displayWordsMapRef.current.get(currentVerseRef.current);
    if (!verseWords) return;
    const expectedIdx = reciteExpectedIdxRef.current;
    const expectedWord = verseWords[expectedIdx]?.text_uthmani;
    if (!expectedWord) return;

    if (matchesExpectedWord(transcript, expectedWord)) {
      const nextIdx = expectedIdx + 1;
      if (nextIdx >= verseWords.length) {
        if (
          ayahEndRef.current !== null &&
          currentVerseRef.current < ayahEndRef.current
        ) {
          setReciteExpectedIdx(0);
          setCurrentVerse((v) => v + 1);
        } else {
          setReciteListening(false);
          ExpoSpeechRecognitionModule.stop();
          Alert.alert("MashaAllah!", "You recited the whole range.");
        }
      } else {
        setReciteExpectedIdx(nextIdx);
        setHighlightedWord(nextIdx);
        if (surahNumberRef.current !== null) {
          setHighlightedPage({
            verseKey: `${surahNumberRef.current}:${currentVerseRef.current}`,
            position: nextIdx + 1,
          });
        }
      }
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

  // ── Full Mushaf page renderer ────────────────────────────────────────────────

  function renderMushafPage(pageNum: number) {
    const verses = pageWordsMap.get(pageNum);

    if (!verses) {
      return (
        <View key={pageNum} style={[styles.pageCard, styles.centered, { minHeight: 200 }]}>
          <ActivityIndicator color={T.pageMuted} />
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
        style={styles.pageCard}
        onLayout={(e) => {
          pageCardLayoutMap.current.set(pageNum, e.nativeEvent.layout.y);
        }}
      >
        {/* Header bar: surah names (left) + Juz label (right) */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderNames} numberOfLines={1}>
            {surahNamesStr}
          </Text>
          <Text style={styles.pageHeaderJuz}>{`JUZ ${juz}`}</Text>
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
                    <View style={styles.surahBannerRule} />
                    <View style={styles.surahBannerLabel}>
                      <Text style={styles.surahBannerText}>{bannerName}</Text>
                    </View>
                    <View style={styles.surahBannerRule} />
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
                            styles.mushafEndMarker,
                            !inScope && styles.mushafWordDimmed,
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
                      isPlaying && item.verseKey === `${surahNumber}:${currentVerse}`;
                    const isBlurred =
                      blurMode && isPlaying && inScope && !isCurrentlyPlayingVerse;

                    return (
                      <Pressable
                        key={`${item.verseKey}-${item.word.position}-${idx}`}
                        style={isHighlighted ? styles.mushafWordHighlighted : undefined}
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
                      >
                        <Text
                          style={[
                            styles.mushafWord,
                            !inScope && styles.mushafWordDimmed,
                            isBlurred && styles.mushafWordBlurred,
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
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{pageNum}</Text>
        </View>
      </View>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const words = displayWordsMap.get(currentVerse) ?? [];
  const ayahVerseKey = surahNumber !== null ? `${surahNumber}:${currentVerse}` : "";
  const ayahVerseHidden = blindMode && !revealedVerses.has(ayahVerseKey);
  const verseIndex = ayahStart !== null ? currentVerse - ayahStart + 1 : 1;
  const totalVerses = ayahStart !== null && ayahEnd !== null ? ayahEnd - ayahStart + 1 : 0;
  const canPrev = ayahStart !== null && currentVerse > ayahStart;
  const canNext = ayahEnd !== null && currentVerse < ayahEnd;

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
          {reciteMode ? "Recite " : ""}Verse {verseIndex} of {totalVerses}
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
              {words.map((word, idx) => (
                <Pressable
                  key={`${currentVerse}-${idx}`}
                  onPress={() => {
                    if (blindMode) {
                      toggleVerseReveal(ayahVerseKey);
                      return;
                    }
                    handleWordTap(idx);
                  }}
                  style={[styles.wordWrapper, highlightedWord === idx && styles.wordHighlighted]}
                >
                  <Text style={styles.arabicWord}>
                    {ayahVerseHidden ? "••••" : word.text_uthmani}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : pageStart === null || pageEnd === null ? (
          <View style={[styles.pageCard, styles.centered, { minHeight: 200 }]}>
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
              if (isPlayingRef.current) {
                await soundRef.current?.pauseAsync();
                isPlayingRef.current = false;
                setIsPlaying(false);
                cancelAnimationFrame(rafIdRef.current);
              }
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

          <Pressable style={styles.sheetDoneButton} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

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
  // ── Parchment Mushaf page card ───────────────────────────────────────────────
  pageCard: {
    width: "100%",
    backgroundColor: T.page,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.pageBorder,
    overflow: "hidden",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.pageBorder,
  },
  pageHeaderNames: {
    flex: 1,
    fontFamily: "AmiriQuran",
    fontSize: 13,
    color: T.pageLabel,
  },
  pageHeaderJuz: {
    fontSize: 11,
    color: T.pageLabel,
    letterSpacing: 2,
    fontWeight: "600",
    marginLeft: 8,
  },
  pageBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pageFooter: {
    borderTopWidth: 1,
    borderTopColor: T.pageBorder,
    paddingVertical: 6,
    alignItems: "center",
  },
  pageFooterText: {
    fontSize: 11,
    color: T.pageLabel,
    letterSpacing: 3,
  },
  // ── Surah banner ─────────────────────────────────────────────────────────────
  surahBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  surahBannerRule: {
    flex: 1,
    height: 1,
    backgroundColor: T.pageRule,
  },
  surahBannerLabel: {
    paddingHorizontal: 12,
  },
  surahBannerText: {
    fontFamily: "AmiriQuran",
    fontSize: 18,
    color: T.pageLabel,
    fontWeight: "600",
  },
  // ── Mushaf line words ────────────────────────────────────────────────────────
  mushafLine: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  mushafWord: {
    fontFamily: "AmiriQuran",
    fontSize: 20,
    lineHeight: 38,
    color: T.pageText,
    marginHorizontal: 1,
  },
  mushafEndMarker: {
    fontFamily: "AmiriQuran",
    fontSize: 16,
    lineHeight: 38,
    color: T.pageText,
    marginHorizontal: 4,
  },
  mushafWordDimmed: {
    color: T.pageMuted,
  },
  mushafWordHighlighted: {
    backgroundColor: T.activeHighlight,
    borderRadius: 3,
    paddingHorizontal: 2,
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
});
