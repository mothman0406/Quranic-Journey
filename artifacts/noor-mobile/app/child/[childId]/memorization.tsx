import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { ayahAudioUrl } from "@/src/lib/audio";
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
  const [submitting, setSubmitting] = useState(false);

  // Audio + RAF refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const rafIdRef = useRef<number>(0);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  // Segments for the currently-playing verse (updated in effects)
  const segsRef = useRef<Segment[]>([]);
  // Whether prev/next navigation should auto-play the new verse
  const autoPlayRef = useRef(false);

  // Load chapter metadata once for surah name lookups (header + banners)
  useEffect(() => {
    fetchAllChapters()
      .then((chapters) => {
        const map = new Map<number, ApiChapter>();
        for (const ch of chapters) map.set(ch.id, ch);
        setChaptersMap(map);
      })
      .catch(() => {
        // fail silently — header and banners show empty names until loaded
      });
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
    return () => {
      cancelled = true;
    };
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
        // fail silently; page card continues showing loading indicator
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewMode, pageStart, pageEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep segsRef up-to-date for the RAF tick
  useEffect(() => {
    if (surahNumber !== null) {
      segsRef.current = segmentsMap.get(`${surahNumber}:${currentVerse}`) ?? [];
    }
  }, [segmentsMap, surahNumber, currentVerse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Cleanup + optional auto-play on verse change
  useEffect(() => {
    cancelAnimationFrame(rafIdRef.current);
    setHighlightedWord(-1);
    positionRef.current = 0;
    durationRef.current = 0;

    let cancelled = false;
    const doChange = async () => {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (cancelled) return;
      setIsPlaying(false);
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        await playVerse(currentVerse);
      }
    };
    doChange();
    return () => {
      cancelled = true;
    };
  }, [currentVerse]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RAF highlight loop ───────────────────────────────────────────────────────

  function startRAF() {
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
        // stick on last word after audio ends
        if (found === -1 && frac > 0 && segs.length > 0) {
          const last = segs[segs.length - 1];
          if (last && frac >= last[1]) found = last[0] - 1;
        }
        setHighlightedWord(found);
      }
      rafIdRef.current = requestAnimationFrame(tick);
    }
    rafIdRef.current = requestAnimationFrame(tick);
  }

  // ── Audio helpers ────────────────────────────────────────────────────────────

  async function playVerse(verseNum: number) {
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
          cancelAnimationFrame(rafIdRef.current);
          setIsPlaying(false);
          setHighlightedWord(-1);
        }
      },
    );
    soundRef.current = sound;
    setIsPlaying(true);
    startRAF();
  }

  async function handlePlayPause() {
    if (isPlaying) {
      cancelAnimationFrame(rafIdRef.current);
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
    } else if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      startRAF();
    } else {
      await playVerse(currentVerse);
    }
  }

  async function handleWordTap(displayIdx: number) {
    const seg = segsRef.current.find((s) => s[0] - 1 === displayIdx);
    if (!seg) return;
    const dur = durationRef.current;
    if (soundRef.current && dur > 0) {
      await soundRef.current.setPositionAsync(Math.floor(seg[1] * dur));
      if (!isPlaying) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        startRAF();
      }
    }
  }

  function handlePrev() {
    if (ayahStart === null || currentVerse <= ayahStart) return;
    autoPlayRef.current = true;
    setCurrentVerse((v) => v - 1);
  }

  function handleNext() {
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

    // Group all words (including end markers) by line_number, preserving order
    const lineMap = new Map<number, Array<{ word: ApiWord; verseKey: string }>>();
    for (const verse of verses) {
      for (const word of verse.words) {
        const ln = word.line_number;
        if (!lineMap.has(ln)) lineMap.set(ln, []);
        lineMap.get(ln)!.push({ word, verseKey: verse.verse_key });
      }
    }

    // Determine where surah banners should be injected.
    // A banner is inserted before the first line of each new surah on the page.
    // When a surah transition happens mid-line, the banner still appears before
    // that line — accepted compromise for mobile wrap-aware rendering.
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
        // Page starts at beginning of a surah → show its banner
        bannerBeforeLine.set(firstWord.line_number, vSurah);
      } else if (prevSurah !== null && vSurah !== prevSurah) {
        // Surah transition → inject banner before this surah's first line
        bannerBeforeLine.set(firstWord.line_number, vSurah);
      }
      prevSurah = vSurah;
    }

    // Build surah names string for the page header bar
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
      <View key={pageNum} style={styles.pageCard}>
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
                 * Accepted compromise: one canonical Mushaf line may wrap to
                 * 2+ visual lines on phones due to fontSize + screen width.
                 * Real fix is per-page native typography in a later phase.
                 */}
                <View style={styles.mushafLine}>
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

                    // Pressable wrapper left intentionally without onPress —
                    // tap-to-seek within page mode is wired in Slice 2b.
                    return (
                      <Pressable
                        key={`${item.verseKey}-${item.word.position}-${idx}`}
                      >
                        <Text
                          style={[
                            styles.mushafWord,
                            !inScope && styles.mushafWordDimmed,
                          ]}
                        >
                          {item.word.text_uthmani}
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          Verse {verseIndex} of {totalVerses}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {viewMode === "ayah" ? (
          <View style={styles.verseCard}>
            <View style={styles.wordContainer}>
              {words.map((word, idx) => (
                <Pressable
                  key={`${currentVerse}-${idx}`}
                  onPress={() => handleWordTap(idx)}
                  style={[styles.wordWrapper, highlightedWord === idx && styles.wordHighlighted]}
                >
                  <Text style={styles.arabicWord}>{word.text_uthmani}</Text>
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
      </ScrollView>
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
  headerSpacer: {
    width: 60,
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
  scrollContent: {
    padding: 16,
    alignItems: "center",
    gap: 24,
    paddingBottom: 48,
  },
  // ── Ayah-by-Ayah card (unchanged) ───────────────────────────────────────────
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
  // ── Audio controls (unchanged) ───────────────────────────────────────────────
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
});
