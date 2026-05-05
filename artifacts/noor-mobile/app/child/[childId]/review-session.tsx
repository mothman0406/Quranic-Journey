import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import {
  ReviewActionSheet,
  type ReviewActionSheetAyahTarget,
} from "@/src/components/review-action-sheet";
import { ReviewMushafPage } from "@/src/components/review-mushaf-page";
import { ayahAudioUrl } from "@/src/lib/audio";
import { DEFAULT_RECITER_ID, findReciter, RECITERS } from "@/src/lib/reciters";
import { submitReview } from "@/src/lib/reviews";
import {
  fetchAyahTranslation,
  fetchSurahVerses,
  fetchVersesByPage,
  type ApiPageVerse,
  type ApiVerse,
} from "@/src/lib/quran";
import {
  DEFAULT_PROFILE_SETTINGS,
  loadProfileSettings,
  saveProfileSettings,
  type MushafViewMode,
  type ProfileSettings,
} from "@/src/lib/settings";
import { saveMushafAyahBookmark } from "@/src/lib/mushaf-annotations";

const PAGE_ASPECT_RATIO = 1.45;
const PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5] as const;

const QUALITY_OPTIONS: { rating: number; label: string; color: string }[] = [
  { rating: 0, label: "Forgot completely", color: "#dc2626" },
  { rating: 1, label: "Serious errors", color: "#dc2626" },
  { rating: 2, label: "Correct with difficulty", color: "#ea580c" },
  { rating: 3, label: "Correct with hesitation", color: "#ea580c" },
  { rating: 4, label: "Good", color: "#16a34a" },
  { rating: 5, label: "Excellent", color: "#16a34a" },
];

type ReviewSessionQueueItem = {
  id: number;
  surahId: number;
  surahName: string | null;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  pageStart: number;
  pageEnd: number;
  chunkIndex: number;
  chunkCount: number;
};

type ReviewTranslationPopup = {
  verseKey: string;
  ayahNumber: number;
  arabic: string;
  translation: string;
  loading: boolean;
};

function finiteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeQueueItem(value: unknown): ReviewSessionQueueItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const surahId = finiteNumber(record.surahId, 0);
  const surahNumber = finiteNumber(record.surahNumber, 0);
  const ayahStart = finiteNumber(record.ayahStart, 1);
  const ayahEnd = finiteNumber(record.ayahEnd, ayahStart);
  const pageStart = finiteNumber(record.pageStart, 1);
  const pageEnd = finiteNumber(record.pageEnd, pageStart);

  if (!surahId || !surahNumber) return null;

  return {
    id: finiteNumber(record.id, surahId),
    surahId,
    surahName: typeof record.surahName === "string" ? record.surahName : null,
    surahNumber,
    ayahStart,
    ayahEnd,
    pageStart,
    pageEnd,
    chunkIndex: finiteNumber(record.chunkIndex, 1),
    chunkCount: finiteNumber(record.chunkCount, 1),
  };
}

function parseReviewBatchQueue(
  batchQueue: string | undefined,
  fallbackItem: ReviewSessionQueueItem,
) {
  if (!batchQueue) return [fallbackItem];
  try {
    const parsed = JSON.parse(batchQueue) as unknown;
    if (!Array.isArray(parsed)) return [fallbackItem];
    const queue = parsed
      .map((item) => normalizeQueueItem(item))
      .filter((item): item is ReviewSessionQueueItem => !!item);
    return queue.length > 0 ? queue : [fallbackItem];
  } catch {
    return [fallbackItem];
  }
}

function queueKey(queue: ReviewSessionQueueItem[]) {
  return queue
    .map((item) => `${item.surahId}:${item.ayahStart}:${item.ayahEnd}:${item.pageStart}`)
    .join("|");
}

function formatRate(rate: number) {
  return rate === 1 ? "1x" : `${rate}x`;
}

function reciterShortName(fullName: string) {
  const parts = fullName.split(" ").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : fullName;
}

function buildNumberRange(start: number, end: number) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export default function ReviewSession() {
  const router = useRouter();
  const {
    childId,
    surahId,
    surahNumber,
    surahName,
    ayahStart,
    ayahEnd,
    pageStart,
    pageEnd,
    reviewDate,
    batchQueue,
    isAdHoc,
  } = useLocalSearchParams<{
    childId: string;
    surahId: string;
    surahNumber: string;
    surahName: string;
    ayahStart: string;
    ayahEnd: string;
    pageStart: string;
    pageEnd: string;
    chunkIndex: string;
    chunkCount: string;
    reviewDate?: string;
    batchQueue?: string;
    isAdHoc?: string;
  }>();

  const fallbackQueueItem = useMemo<ReviewSessionQueueItem>(
    () => ({
      id: finiteNumber(surahId, 0),
      surahId: finiteNumber(surahId, 0),
      surahName: surahName || null,
      surahNumber: finiteNumber(surahNumber, 0),
      ayahStart: finiteNumber(ayahStart, 1),
      ayahEnd: finiteNumber(ayahEnd, finiteNumber(ayahStart, 1)),
      pageStart: finiteNumber(pageStart, 1),
      pageEnd: finiteNumber(pageEnd, finiteNumber(pageStart, 1)),
      chunkIndex: 1,
      chunkCount: 1,
    }),
    [ayahEnd, ayahStart, pageEnd, pageStart, surahId, surahName, surahNumber],
  );
  const routeQueue = useMemo(
    () => parseReviewBatchQueue(batchQueue, fallbackQueueItem),
    [batchQueue, fallbackQueueItem],
  );
  const routeQueueKey = useMemo(() => queueKey(routeQueue), [routeQueue]);
  const [sessionQueue, setSessionQueue] = useState(routeQueue);
  const [queueIndex, setQueueIndex] = useState(0);
  const currentQueueItem = sessionQueue[queueIndex] ?? sessionQueue[0] ?? fallbackQueueItem;

  const ayahStartN = currentQueueItem.ayahStart;
  const ayahEndN = currentQueueItem.ayahEnd;
  const pageStartN = currentQueueItem.pageStart;
  const pageEndN = currentQueueItem.pageEnd;
  const surahNumberN = currentQueueItem.surahNumber;
  const surahIdN = currentQueueItem.surahId;
  const totalAyahs = ayahEndN - ayahStartN + 1;
  const isBatchSession = sessionQueue.length > 1;
  const queuePosition = queueIndex + 1;
  const queueTotal = sessionQueue.length;
  const nextQueueItem = sessionQueue[queueIndex + 1] ?? null;
  const hasNextQueueItem = !!nextQueueItem;

  const screenW = Dimensions.get("window").width;
  const imageWidth = screenW - 32;
  const imageHeight = imageWidth * PAGE_ASPECT_RATIO;
  const pageSlideWidth = screenW;

  const soundRef = useRef<Audio.Sound | null>(null);
  const pageListRef = useRef<FlatList<number>>(null);
  const currentAyahRef = useRef(ayahStartN);
  const playbackRateRef = useRef<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentAyah, setCurrentAyah] = useState(ayahStartN);
  const [reciterId, setReciterId] = useState(DEFAULT_RECITER_ID);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [profileSettings, setProfileSettings] =
    useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  const [mushafViewMode, setMushafViewMode] =
    useState<MushafViewMode>(DEFAULT_PROFILE_SETTINGS.mushafViewMode);
  const [mushafDefaultSaved, setMushafDefaultSaved] = useState(false);
  const [blindMode, setBlindMode] = useState(false);
  const [revealedAyahKeys, setRevealedAyahKeys] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewVerses, setReviewVerses] = useState<ApiVerse[]>([]);
  const [pageVersesByPage, setPageVersesByPage] = useState<Record<number, ApiPageVerse[]>>({});
  const [pageVerseErrors, setPageVerseErrors] = useState<Record<number, string>>({});
  const [translationPopup, setTranslationPopup] = useState<ReviewTranslationPopup | null>(null);
  const [reviewActionTarget, setReviewActionTarget] =
    useState<ReviewActionSheetAyahTarget | null>(null);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedReciter = findReciter(reciterId);
  const mushafPages = useMemo(
    () => buildNumberRange(pageStartN, pageEndN),
    [pageStartN, pageEndN],
  );
  const activeVerseKey = `${surahNumberN}:${currentAyah}`;
  const ayahTextMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const verse of reviewVerses) {
      map.set(verse.verse_number, verse.text_uthmani);
    }
    return map;
  }, [reviewVerses]);
  const ayahPageMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const verse of reviewVerses) {
      if (typeof verse.page_number === "number") {
        map.set(verse.verse_number, verse.page_number);
      }
    }
    return map;
  }, [reviewVerses]);
  const activePage = useMemo(() => {
    const mapped = ayahPageMap.get(currentAyah);
    if (mapped !== undefined && mapped >= pageStartN && mapped <= pageEndN) return mapped;
    if (pageStartN === pageEndN) return pageStartN;
    if (currentAyah >= ayahEndN) return pageEndN;
    return pageStartN;
  }, [ayahEndN, ayahPageMap, currentAyah, pageEndN, pageStartN]);

  console.log("[noor-review] session-render", {
    childId,
    route: {
      surahNumber,
      ayahStart,
      ayahEnd,
      pageStart,
      pageEnd,
      reviewDate,
      hasBatchQueue: !!batchQueue,
    },
    surahNumberN,
    ayahStartN,
    ayahEndN,
    pageStartN,
    pageEndN,
    sessionQueueLength: sessionQueue.length,
    queueIndex,
    isBatchSession,
    mushafViewMode,
  });

  useEffect(() => {
    setSessionQueue(routeQueue);
    setQueueIndex(0);
  }, [routeQueue, routeQueueKey]);

  useEffect(() => {
    currentAyahRef.current = currentAyah;
  }, [currentAyah]);

  useEffect(() => {
    currentAyahRef.current = ayahStartN;
    setCurrentAyah(ayahStartN);
    setAudioError(null);
    setSubmitError(null);
    setSelectedRating(null);
    setRatingModalVisible(false);
    setTranslationPopup(null);
    setReviewActionTarget(null);
    void stopAudio();
  }, [ayahStartN, ayahEndN, pageStartN, pageEndN, surahIdN]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    soundRef.current?.setRateAsync(playbackRate, true).catch(() => {
      // Best-effort; some unloaded sound states reject rate updates.
    });
  }, [playbackRate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileSettings = await loadProfileSettings(childId);
      if (!cancelled) {
        setProfileSettings(profileSettings);
        setReciterId(profileSettings.reciterId);
        setMushafViewMode(profileSettings.mushafViewMode);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId]);

  useEffect(() => {
    setMushafDefaultSaved(false);
  }, [mushafViewMode]);

  useEffect(() => {
    if (!blindMode) setRevealedAyahKeys(new Set());
  }, [blindMode]);

  useEffect(() => {
    let cancelled = false;
    setReviewVerses([]);
    (async () => {
      try {
        const verses = await fetchSurahVerses(surahNumberN);
        if (!cancelled) {
          setReviewVerses(
            verses.filter(
              (verse) =>
                verse.verse_number >= ayahStartN && verse.verse_number <= ayahEndN,
            ),
          );
        }
      } catch {
        if (!cancelled) setReviewVerses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ayahEndN, ayahStartN, surahNumberN]);

  useEffect(() => {
    let cancelled = false;
    setPageVersesByPage({});
    setPageVerseErrors({});

    mushafPages.forEach((pageNumber) => {
      fetchVersesByPage(pageNumber)
        .then((verses) => {
          if (cancelled) return;
          setPageVersesByPage((current) => ({
            ...current,
            [pageNumber]: verses,
          }));
        })
        .catch((error) => {
          if (cancelled) return;
          setPageVerseErrors((current) => ({
            ...current,
            [pageNumber]: error instanceof Error ? error.message : "Page could not load.",
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [mushafPages]);

  useEffect(() => {
    if (mushafViewMode !== "swipe") return;
    const index = mushafPages.indexOf(activePage);
    if (index < 0) return;
    try {
      pageListRef.current?.scrollToIndex({ index, animated: true });
    } catch {
      try {
        pageListRef.current?.scrollToOffset({
          offset: Math.max(0, index * pageSlideWidth),
          animated: true,
        });
      } catch {
        // Best-effort while the page list is measuring.
      }
    }
  }, [activePage, mushafPages, mushafViewMode, pageSlideWidth]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {
      // Non-fatal on simulator or when the audio session is temporarily busy.
    });
  }, []);

  useEffect(() => {
    if (soundRef.current) {
      void stopAudio();
    }
  }, [reciterId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  async function stopAudio() {
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      await sound.unloadAsync().catch(() => {});
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
  }

  async function playAyah(ayahNumber: number) {
    console.log("[noor-review] play-ayah-entry", {
      ayahNumber,
      surahNumberN,
      currentReciter: reciterId,
      ayahStartN,
      ayahEndN,
    });
    setAudioError(null);
    setIsAudioLoading(true);
    setCurrentAyah(ayahNumber);
    currentAyahRef.current = ayahNumber;

    const previousSound = soundRef.current;
    soundRef.current = null;
    if (previousSound) {
      await previousSound.unloadAsync().catch(() => {});
    }

    try {
      const url = ayahAudioUrl(findReciter(reciterId), surahNumberN, ayahNumber);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false, volume: 1.0 },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            const next = currentAyahRef.current + 1;
            if (next > ayahEndN) {
              void stopAudio();
              setCurrentAyah(ayahStartN);
              currentAyahRef.current = ayahStartN;
            } else {
              setCurrentAyah(next);
              currentAyahRef.current = next;
              void playAyah(next);
            }
          }
        },
      );
      soundRef.current = sound;
      await sound.setRateAsync(playbackRateRef.current, true).catch(() => {});
      await sound.playAsync();
      setIsPlaying(true);
      console.log("[noor-review] play-ayah-started", {
        ayahNumber,
        soundCreated: true,
      });
    } catch (e) {
      console.log("[noor-review] play-ayah-error", {
        message: e instanceof Error ? e.message : "Audio could not start",
      });
      setAudioError(e instanceof Error ? e.message : "Audio could not start");
      setIsPlaying(false);
    } finally {
      setIsAudioLoading(false);
    }
  }

  async function handleSeekAyah(ayahNumber: number) {
    console.log("[noor-review] handle-seek-entry", {
      ayahNumber,
      currentAyah,
      currentAyahRef: currentAyahRef.current,
      isAudioLoading,
    });
    if (isAudioLoading) return;
    await playAyah(ayahNumber);
  }

  function withResolvedAyahText(
    target: ReviewActionSheetAyahTarget,
  ): ReviewActionSheetAyahTarget {
    if (target.textUthmani || target.surahNumber !== surahNumberN) return target;
    return {
      ...target,
      textUthmani: ayahTextMap.get(target.ayahNumber) ?? "",
    };
  }

  function openTranslationForTarget(rawTarget: ReviewActionSheetAyahTarget) {
    const target = withResolvedAyahText(rawTarget);
    const verseKey = target.verseKey;
    console.log("[noor-review] open-translation-entry", {
      ayahNumber: target.ayahNumber,
      verseKey,
      hasAyahText: !!target.textUthmani,
    });
    setTranslationPopup({
      verseKey,
      ayahNumber: target.ayahNumber,
      arabic: target.textUthmani,
      translation: "Loading translation...",
      loading: true,
    });
    fetchAyahTranslation(verseKey, 20)
      .then((translation) => {
        setTranslationPopup((current) =>
          current?.verseKey === verseKey
            ? {
                ...current,
                translation,
                loading: false,
              }
            : current,
        );
      })
      .catch(() => {
        setTranslationPopup((current) =>
          current?.verseKey === verseKey
            ? {
                ...current,
                translation: "Translation could not load.",
                loading: false,
              }
            : current,
        );
      });
  }

  async function saveMushafViewAsDefault() {
    const next = { ...profileSettings, mushafViewMode };
    setProfileSettings(next);
    await saveProfileSettings(childId, next);
    setMushafDefaultSaved(true);
  }

  function toggleBlindMode() {
    setBlindMode((current) => !current);
  }

  function toggleAyahReveal(verseKey: string) {
    setRevealedAyahKeys((current) => {
      const next = new Set(current);
      if (next.has(verseKey)) {
        next.delete(verseKey);
      } else {
        next.add(verseKey);
      }
      return next;
    });
  }

  function openReviewActionSheet(target: ReviewActionSheetAyahTarget) {
    setReviewActionTarget(withResolvedAyahText(target));
  }

  function handleActionSheetTranslation() {
    const target = reviewActionTarget;
    if (!target) return;
    setReviewActionTarget(null);
    openTranslationForTarget(target);
  }

  async function openFullMushafForTarget(target: ReviewActionSheetAyahTarget) {
    await stopAudio();
    setSettingsOpen(false);
    setTranslationPopup(null);
    router.push({
      pathname: "/child/[childId]/mushaf",
      params: {
        childId,
        page: String(target.pageNumber),
        surahNumber: String(target.surahNumber),
        ayahNumber: String(target.ayahNumber),
      },
    });
  }

  function confirmViewInFullMushaf() {
    const target = reviewActionTarget;
    if (!target) return;
    setReviewActionTarget(null);
    Alert.alert(
      "Open Full Mushaf?",
      `Open Quran ${target.verseKey} on page ${target.pageNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open",
          onPress: () => {
            void openFullMushafForTarget(target);
          },
        },
      ],
    );
  }

  async function bookmarkReviewAyah() {
    const target = reviewActionTarget ? withResolvedAyahText(reviewActionTarget) : null;
    if (!target) return;
    if (!target.textUthmani) {
      Alert.alert("Bookmark unavailable", "Ayah text is still loading.");
      return;
    }

    try {
      await saveMushafAyahBookmark(childId, target);
      setReviewActionTarget(null);
      Alert.alert("Bookmarked", `Bookmarked Quran ${target.verseKey}.`);
    } catch {
      Alert.alert("Bookmark unavailable", "Try bookmarking this ayah again in a moment.");
    }
  }

  function copyReviewAyah() {
    const target = reviewActionTarget ? withResolvedAyahText(reviewActionTarget) : null;
    if (!target) return;
    if (!target.textUthmani) {
      Alert.alert("Copy unavailable", "Ayah text is still loading.");
      return;
    }

    Clipboard.setString(`${target.textUthmani}\n- Quran ${target.verseKey}`);
    setReviewActionTarget(null);
    Alert.alert("Copied", `Copied Quran ${target.verseKey}.`);
  }

  async function handlePlayPause() {
    if (isAudioLoading) return;
    if (isPlaying) {
      await soundRef.current?.pauseAsync().catch(() => {});
      setIsPlaying(false);
    } else {
      await playAyah(currentAyah);
    }
  }

  function openRatingModal() {
    void stopAudio();
    setSubmitError(null);
    setSelectedRating(null);
    setRatingModalVisible(true);
  }

  async function advanceQueue() {
    await stopAudio();
    setSelectedRating(null);
    setSubmitError(null);
    setRatingModalVisible(false);
    setQueueIndex((index) => Math.min(index + 1, sessionQueue.length - 1));
  }

  async function handleSkipSurah() {
    if (!hasNextQueueItem) return;
    await advanceQueue();
  }

  async function handleSubmit() {
    if (selectedRating === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview(
        childId,
        surahIdN,
        selectedRating,
        reviewDate,
        isAdHoc === "true" ? { ayahStart: ayahStartN, ayahEnd: ayahEndN } : {},
      );
      await stopAudio();
      setRatingModalVisible(false);
      setSelectedRating(null);
      if (hasNextQueueItem) {
        setQueueIndex((index) => Math.min(index + 1, sessionQueue.length - 1));
      } else {
        Alert.alert(
          isBatchSession ? "Review batch saved!" : "Review saved!",
          undefined,
          [{ text: "OK", onPress: () => router.back() }],
        );
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  function renderMushafPage(pageNumber: number) {
    const pageVerses = pageVersesByPage[pageNumber] ?? [];
    const pageError = pageVerseErrors[pageNumber] ?? null;
    const pageIsLoading = !pageError && !pageVersesByPage[pageNumber];

    return (
      <ReviewMushafPage
        pageNumber={pageNumber}
        verses={pageVerses}
        width={imageWidth}
        height={imageHeight}
        loading={pageIsLoading}
        error={pageError}
        activeVerseKey={activeVerseKey}
        blindMode={blindMode}
        revealedAyahKeys={revealedAyahKeys}
        blurActiveSurahNumber={surahNumberN}
        onToggleAyahReveal={toggleAyahReveal}
        onLongPressAyah={openReviewActionSheet}
        onPressEndMarker={(target) => {
          if (
            target.surahNumber !== surahNumberN ||
            target.ayahNumber < ayahStartN ||
            target.ayahNumber > ayahEndN
          ) {
            return;
          }
          void handleSeekAyah(target.ayahNumber);
        }}
      />
    );
  }

  const currentSurahName = currentQueueItem.surahName || `Surah ${surahNumberN}`;
  const pageLabel =
    pageStartN === pageEndN ? `Page ${pageStartN}` : `Pages ${pageStartN}-${pageEndN}`;
  const headerDetail = `Ayahs ${ayahStartN}-${ayahEndN} · ${pageLabel}`;
  const actionSheetTranslation =
    reviewActionTarget &&
    translationPopup?.verseKey === reviewActionTarget.verseKey &&
    !translationPopup.loading
      ? translationPopup.translation
      : null;
  const currentAyahIndex = Math.max(1, currentAyah - ayahStartN + 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentSurahName}
          </Text>
          <Text style={styles.headerDetail} numberOfLines={1}>
            {headerDetail}
          </Text>
        </View>
        {isBatchSession ? (
          <Text style={styles.headerQueue}>
            {queuePosition}/{queueTotal}
          </Text>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {nextQueueItem || audioError ? (
        <View style={styles.sessionTopPanel}>
          {nextQueueItem ? (
            <View style={styles.nextQueueCard}>
              <Ionicons name="arrow-forward-circle-outline" size={18} color="#2563eb" />
              <Text style={styles.nextQueueText} numberOfLines={1}>
                Next: {nextQueueItem.surahName || `Surah ${nextQueueItem.surahNumber}`}
              </Text>
            </View>
          ) : null}

          {audioError ? (
            <View style={styles.audioError}>
              <Ionicons name="alert-circle-outline" size={17} color="#dc2626" />
              <Text style={styles.audioErrorText}>{audioError}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.pageArea}>
        {mushafViewMode === "swipe" ? (
          <FlatList
            key={`review-pages-swipe-${pageStartN}-${pageEndN}-${pageSlideWidth}`}
            ref={pageListRef}
            data={mushafPages}
            keyExtractor={(item) => String(item)}
            horizontal
            pagingEnabled
            inverted
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.max(0, mushafPages.indexOf(activePage))}
            getItemLayout={(_data, index) => ({
              length: pageSlideWidth,
              offset: pageSlideWidth * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              pageListRef.current?.scrollToOffset({
                offset: Math.max(0, info.index * pageSlideWidth),
                animated: true,
              });
            }}
            renderItem={({ item }) => (
              <View style={[styles.pageSlide, { width: pageSlideWidth }]}>
                <ScrollView
                  style={styles.pageSlideScroll}
                  contentContainerStyle={styles.pageSlideContent}
                  showsVerticalScrollIndicator={false}
                >
                  {renderMushafPage(item)}
                </ScrollView>
              </View>
            )}
          />
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {mushafPages.map((pageNumber) => (
              <View key={pageNumber}>{renderMushafPage(pageNumber)}</View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.stickyControls}>
        <View style={styles.controlStatus}>
          <View>
            <Text style={styles.verseCounter}>
              {isBatchSession ? `Queue ${queuePosition}/${queueTotal} · ` : ""}
              Verse {currentAyahIndex} of {totalAyahs}
            </Text>
            <Text style={styles.audioMeta} numberOfLines={1}>
              {reciterShortName(selectedReciter.fullName)} · {formatRate(playbackRate)}
            </Text>
          </View>
          <Pressable style={styles.settingsButton} onPress={() => setSettingsOpen(true)}>
            <Ionicons name="options-outline" size={20} color="#2563eb" />
          </Pressable>
        </View>
        <View style={styles.controlButtons}>
          <Pressable
            style={[styles.playButton, isAudioLoading && styles.playButtonDisabled]}
            onPress={handlePlayPause}
            disabled={isAudioLoading}
          >
            {isAudioLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.playButtonText}>{isPlaying ? "Pause" : "Play"}</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.finishButton} onPress={openRatingModal}>
            <Text style={styles.finishButtonText}>Rate</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Review Audio</Text>

          <Text style={styles.settingLabel}>Mushaf view</Text>
          <View style={styles.viewModeSegment}>
            {(["swipe", "scroll"] as const).map((mode) => {
              const active = mushafViewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setMushafViewMode(mode)}
                  style={[
                    styles.viewModePill,
                    active && styles.viewModePillSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.viewModePillText,
                      active && styles.viewModePillTextSelected,
                    ]}
                  >
                    {mode === "swipe" ? "Swipe" : "Scroll"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={styles.saveDefaultButton}
            onPress={() => {
              void saveMushafViewAsDefault();
            }}
          >
            <Text style={styles.saveDefaultText}>
              {mushafDefaultSaved ? "Saved as default" : "Save as default"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.toggleSettingRow}
            onPress={toggleBlindMode}
            accessibilityRole="switch"
            accessibilityState={{ checked: blindMode }}
            accessibilityLabel="Blind mode"
          >
            <View style={styles.toggleSettingTextBlock}>
              <Text style={styles.toggleSettingTitle}>Blind mode</Text>
              <Text style={styles.toggleSettingDetail}>
                {blindMode ? "Tap ayahs to reveal or hide." : "Ayahs are visible."}
              </Text>
            </View>
            <View style={[styles.toggleSwitch, blindMode && styles.toggleSwitchOn]}>
              <View style={[styles.toggleKnob, blindMode && styles.toggleKnobOn]} />
            </View>
          </Pressable>

          <Text style={styles.settingLabel}>Playback speed</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillScroller}
          >
            {PLAYBACK_RATES.map((rate) => (
              <Pressable
                key={rate}
                onPress={() => setPlaybackRate(rate)}
                style={[
                  styles.ratePill,
                  playbackRate === rate && styles.ratePillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.ratePillText,
                    playbackRate === rate && styles.ratePillTextSelected,
                  ]}
                >
                  {formatRate(rate)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.settingLabel}>Reciter</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillScroller}
          >
            {RECITERS.map((reciter) => (
              <Pressable
                key={reciter.id}
                onPress={() => setReciterId(reciter.id)}
                style={[
                  styles.reciterPill,
                  reciterId === reciter.id && styles.reciterPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.reciterPillText,
                    reciterId === reciter.id && styles.reciterPillTextSelected,
                  ]}
                >
                  {reciterShortName(reciter.fullName)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.sheetDoneButton} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>

      <ReviewActionSheet
        target={reviewActionTarget}
        translation={actionSheetTranslation}
        onClose={() => setReviewActionTarget(null)}
        onTranslation={handleActionSheetTranslation}
        onViewInFullMushaf={confirmViewInFullMushaf}
        onBookmark={() => {
          void bookmarkReviewAyah();
        }}
        onCopy={copyReviewAyah}
      />

      <Modal
        visible={translationPopup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTranslationPopup(null)}
      >
        <Pressable
          style={styles.translationBackdrop}
          onPress={() => setTranslationPopup(null)}
        >
          <Pressable style={styles.translationCard} onPress={() => {}}>
            <Text style={styles.translationKicker}>
              Ayah {translationPopup?.ayahNumber}
            </Text>
            {translationPopup?.arabic ? (
              <Text style={styles.translationArabic}>{translationPopup.arabic}</Text>
            ) : null}
            {translationPopup?.loading ? (
              <View style={styles.translationLoadingRow}>
                <ActivityIndicator color="#2563eb" />
                <Text style={styles.translationText}>{translationPopup.translation}</Text>
              </View>
            ) : (
              <Text style={styles.translationText}>
                {translationPopup?.translation ?? ""}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setRatingModalVisible(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>How did it go?</Text>
          {isBatchSession && (
            <Text style={styles.sheetDetail}>
              {hasNextQueueItem
                ? `Next up: ${
                    nextQueueItem.surahName || `Surah ${nextQueueItem.surahNumber}`
                  }`
                : "Last surah in this run"}
            </Text>
          )}
          {QUALITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.rating}
              style={[
                styles.ratingRow,
                selectedRating === opt.rating && styles.ratingRowSelected,
              ]}
              onPress={() => setSelectedRating(opt.rating)}
            >
              <Text style={[styles.ratingNumber, { color: opt.color }]}>{opt.rating}</Text>
              <Text style={styles.ratingLabel}>{opt.label}</Text>
              {selectedRating === opt.rating && (
                <Text style={styles.ratingCheck}>✓</Text>
              )}
            </Pressable>
          ))}
          {submitError && (
            <Text style={styles.submitError}>{submitError}</Text>
          )}
          {hasNextQueueItem && (
            <Pressable
              style={[styles.skipButton, submitting && styles.skipButtonDisabled]}
              onPress={handleSkipSurah}
              disabled={submitting}
            >
              <Text style={styles.skipButtonText}>Skip This Surah</Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.submitButton,
              (selectedRating === null || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={selectedRating === null || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  back: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "500",
    width: 60,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    minWidth: 0,
  },
  headerTitle: {
    textAlign: "center",
    fontSize: 19,
    fontWeight: "900",
    color: "#111827",
  },
  headerDetail: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#64748b",
  },
  headerQueue: {
    width: 60,
    minHeight: 28,
    textAlign: "right",
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#eff6ff",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerSpacer: {
    width: 60,
  },
  sessionTopPanel: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
    gap: 14,
    paddingBottom: 20,
  },
  nextQueueCard: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nextQueueText: {
    flex: 1,
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  audioError: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  audioErrorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
  },
  pageArea: {
    flex: 1,
  },
  pageSlide: {
    flex: 1,
  },
  pageSlideScroll: {
    flex: 1,
  },
  pageSlideContent: {
    flexGrow: 1,
    alignItems: "center",
    padding: 16,
  },
  pageImageFrame: {
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  ayahImageHotspot: {
    position: "absolute",
    borderRadius: 999,
  },
  ayahImageHotspotActive: {
    backgroundColor: "rgba(37, 99, 235, 0.22)",
    borderWidth: 2,
    borderColor: "rgba(37, 99, 235, 0.52)",
  },
  ayahImageHotspotPressed: {
    backgroundColor: "rgba(37, 99, 235, 0.28)",
  },
  stickyControls: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  controlStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  verseCounter: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
  },
  audioMeta: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtons: {
    flexDirection: "row",
    gap: 10,
  },
  playButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#2563eb",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  finishButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#111827",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  finishButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 24,
    paddingBottom: 40,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
    textAlign: "center",
  },
  sheetDetail: {
    color: "#555555",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 2,
  },
  settingLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "900",
    marginTop: 4,
  },
  viewModeSegment: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 4,
  },
  viewModePill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  viewModePillSelected: {
    backgroundColor: "#2563eb",
  },
  viewModePillText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#475569",
  },
  viewModePillTextSelected: {
    color: "#ffffff",
  },
  saveDefaultButton: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  saveDefaultText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
  },
  toggleSettingRow: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleSettingTextBlock: {
    flex: 1,
    gap: 2,
  },
  toggleSettingTitle: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },
  toggleSettingDetail: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
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
  pillScroller: {
    gap: 8,
    paddingVertical: 4,
  },
  ratePill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    fontWeight: "800",
    color: "#111827",
  },
  ratePillTextSelected: {
    color: "#ffffff",
  },
  reciterPill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reciterPillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  reciterPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  reciterPillTextSelected: {
    color: "#ffffff",
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
  translationBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  translationCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  translationKicker: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  translationArabic: {
    fontSize: 26,
    lineHeight: 42,
    color: "#111827",
    fontFamily: "AmiriQuran",
    textAlign: "right",
  },
  translationText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
    fontWeight: "600",
  },
  translationLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  ratingRowSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  ratingNumber: {
    fontSize: 18,
    fontWeight: "800",
    width: 24,
    textAlign: "center",
  },
  ratingLabel: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  ratingCheck: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "700",
  },
  submitError: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  skipButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 2,
  },
  skipButtonDisabled: {
    opacity: 0.5,
  },
  skipButtonText: {
    color: "#555555",
    fontSize: 15,
    fontWeight: "800",
  },
  submitButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
