import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { Image } from "expo-image";
import {
  QURAN_COM_1405_NATIVE_HEIGHT,
  QURAN_COM_1405_NATIVE_WIDTH,
  getQuranCom1405WordRectsForPage,
  type QuranCom1405WordRect,
} from "@/src/lib/quran-com-1405-ayah-coords";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
  TOTAL_QURAN_COM_1405_PAGES,
  getQuranCom1405PageImage,
} from "@/src/lib/quran-com-1405-page-images";
import { getMushafPageForVerse } from "@/src/lib/mushaf";
import { fetchWordTranslation } from "@/src/lib/quran";

type MushafTestWordTarget = {
  surah: number;
  ayah: number;
  position: number;
};

// Audio word pointer passed in from the memorization engine.
// position is 1-based and matches QPC2 glyph position directly.
export type AudioWordPointer = {
  surah: number;
  ayah: number;
  position: number;
};

type FlashedWord = MushafTestWordTarget & {
  pageNumber: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type MushafTestPageViewProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  // Phase 1c: audio word highlighting props
  currentAudioWord?: AudioWordPointer | null;
  // true when audio is playing; false when paused or stopped.
  // Animation is driven by currentAudioWord changes; isAudioActive is available
  // for future slice use (e.g. recite overlays).
  isAudioActive?: boolean;
  onWordPress?: (word: MushafTestWordTarget) => void;
  // Phase 1d: called when user taps a word; should seek/start audio at that word.
  onWordSeek?: (word: MushafTestWordTarget) => void;
  onWordLongPress?: (word: MushafTestWordTarget) => void;
  actionSheetVisible?: boolean;
  onActionSheetBackdropPress?: () => void;
};

type PageLayout = {
  width: number;
  height: number;
};

type WordOverlayRect = MushafTestWordTarget & {
  key: string;
  wordRect: QuranCom1405WordRect;
  top: number;
  left: number;
  width: number;
  height: number;
};

type ScaledWordRect = Pick<WordOverlayRect, "top" | "left" | "width" | "height">;

type WordTranslationTarget = MushafTestWordTarget & {
  pageNumber: number;
  rect: ScaledWordRect;
};

const PAGE_NUMBERS = Array.from(
  { length: TOTAL_QURAN_COM_1405_PAGES },
  (_, index) => index + 1,
);
const QURAN_COM_1405_PAGE_ASPECT_RATIO =
  QURAN_COM_1405_PAGE_WIDTH / QURAN_COM_1405_PAGE_HEIGHT;

function clampPage(page: number) {
  return Math.max(1, Math.min(TOTAL_QURAN_COM_1405_PAGES, Math.round(page)));
}

function getContainedPageLayout(container: PageLayout): PageLayout {
  if (container.width <= 0) return { width: 0, height: 0 };
  if (container.height <= 0) {
    return {
      width: container.width,
      height: container.width / QURAN_COM_1405_PAGE_ASPECT_RATIO,
    };
  }

  const widthFromHeight = container.height * QURAN_COM_1405_PAGE_ASPECT_RATIO;
  if (widthFromHeight <= container.width) {
    return { width: widthFromHeight, height: container.height };
  }

  return {
    width: container.width,
    height: container.width / QURAN_COM_1405_PAGE_ASPECT_RATIO,
  };
}

function scaleNativeWordBounds(
  bounds: Pick<FlashedWord, "minX" | "maxX" | "minY" | "maxY">,
  layout: PageLayout,
): Pick<WordOverlayRect, "top" | "left" | "width" | "height"> | null {
  if (layout.width <= 0 || layout.height <= 0) return null;

  const widthCoeff = layout.width / QURAN_COM_1405_NATIVE_WIDTH;
  const heightCoeff = layout.height / QURAN_COM_1405_NATIVE_HEIGHT;
  const top = bounds.minY * heightCoeff;
  const left = bounds.minX * widthCoeff;
  const width = (bounds.maxX - bounds.minX) * widthCoeff;
  const height = (bounds.maxY - bounds.minY) * heightCoeff;
  if (top >= layout.height || top + height <= 0 || left >= layout.width || left + width <= 0) {
    return null;
  }

  const clampedTop = Math.max(0, top);
  const clampedLeft = Math.max(0, left);
  const clampedWidth = Math.max(0, Math.min(width, layout.width - clampedLeft));
  const clampedHeight = Math.max(0, Math.min(height, layout.height - clampedTop));
  if (clampedWidth <= 0 || clampedHeight <= 0) return null;

  return {
    top: clampedTop,
    left: clampedLeft,
    width: clampedWidth,
    height: clampedHeight,
  };
}

function buildWordOverlayRects(pageNumber: number, layout: PageLayout): WordOverlayRect[] {
  const rects: WordOverlayRect[] = [];

  getQuranCom1405WordRectsForPage(pageNumber).forEach((wordRect, index) => {
    const [surah, ayah, position, line, minX, maxX, minY, maxY] = wordRect;
    const scaledRect = scaleNativeWordBounds({ minX, maxX, minY, maxY }, layout);
    if (!scaledRect) return;

    rects.push({
      key: `${pageNumber}:${surah}:${ayah}:${position}:${line}:${index}`,
      wordRect,
      surah,
      ayah,
      position,
      ...scaledRect,
    });
  });

  return rects;
}

function MushafTestPage({
  pageNumber,
  width,
  flashedWord,
  flashOpacity,
  currentAudioWord,
  actionSheetVisible,
  wordTranslationTarget,
  wordTranslationText,
  wordTranslationLoading,
  onWordTap,
  onWordLongPress,
  onDismissWordTranslation,
  onActionSheetBackdropPress,
}: {
  pageNumber: number;
  width: number;
  flashedWord: FlashedWord | null;
  flashOpacity: Animated.Value;
  currentAudioWord?: AudioWordPointer | null;
  actionSheetVisible: boolean;
  wordTranslationTarget: WordTranslationTarget | null;
  wordTranslationText: string | null;
  wordTranslationLoading: boolean;
  onWordTap: (pageNumber: number, word: QuranCom1405WordRect, scaledRect: ScaledWordRect) => void;
  onWordLongPress?: (word: MushafTestWordTarget) => void;
  onDismissWordTranslation: () => void;
  onActionSheetBackdropPress?: () => void;
}) {
  const [containerLayout, setContainerLayout] = useState<PageLayout>({ width: 0, height: 0 });
  const suppressedLongPressKeyRef = useRef<string | null>(null);
  const imageSource = getQuranCom1405PageImage(pageNumber);
  const imageLayout = useMemo(
    () => getContainedPageLayout(containerLayout),
    [containerLayout],
  );
  const overlayRects = useMemo(
    () => buildWordOverlayRects(pageNumber, imageLayout),
    [imageLayout, pageNumber],
  );
  const flashedRect = useMemo(
    () =>
      flashedWord?.pageNumber === pageNumber
        ? scaleNativeWordBounds(flashedWord, imageLayout)
        : null,
    [flashedWord, imageLayout, pageNumber],
  );

  // Audio highlight: find the matching scaled rect for the current audio word on this page.
  // Returns null when the audio word is on a different page or no glyph matches.
  const audioHighlightRect = useMemo(() => {
    if (!currentAudioWord) return null;
    return (
      overlayRects.find(
        (r) =>
          r.surah === currentAudioWord.surah &&
          r.ayah === currentAudioWord.ayah &&
          r.position === currentAudioWord.position,
      ) ?? null
    );
  }, [currentAudioWord, overlayRects]);

  // Green highlight uses a different color than the amber tap-flash (Phase 1b)
  // to make audio-following distinct from user-initiated feedback.
  const audioHighlightOpacity = useRef(new Animated.Value(0)).current;
  const audioHighlightAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const activeWordTranslationTarget =
    wordTranslationTarget?.pageNumber === pageNumber ? wordTranslationTarget : null;
  const popoverLayout = useMemo(() => {
    if (!activeWordTranslationTarget) return null;
    const popoverWidth = Math.min(200, Math.max(140, imageLayout.width - 16));
    const left = Math.max(
      8,
      Math.min(
        activeWordTranslationTarget.rect.left +
          activeWordTranslationTarget.rect.width / 2 -
          popoverWidth / 2,
        Math.max(8, imageLayout.width - popoverWidth - 8),
      ),
    );
    const shouldRenderAbove = activeWordTranslationTarget.rect.top > 74;
    const top = shouldRenderAbove
      ? Math.max(8, activeWordTranslationTarget.rect.top - 62)
      : Math.min(
          Math.max(8, imageLayout.height - 70),
          activeWordTranslationTarget.rect.top +
            activeWordTranslationTarget.rect.height +
            8,
        );
    return { top, left, width: popoverWidth };
  }, [activeWordTranslationTarget, imageLayout.height, imageLayout.width]);

  useEffect(() => {
    audioHighlightAnimRef.current?.stop();
    audioHighlightAnimRef.current = null;

    if (!currentAudioWord) {
      // Audio stopped/ended: fade out over 250 ms
      const anim = Animated.timing(audioHighlightOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      });
      audioHighlightAnimRef.current = anim;
      anim.start(({ finished: done }) => {
        if (done && audioHighlightAnimRef.current === anim) audioHighlightAnimRef.current = null;
      });
      return;
    }

    // New word: snap to position with a quick fade-in (no fade-out).
    // The position changes through audioHighlightRect (driven by currentAudioWord),
    // so when this effect runs, the rect is already at the new word — we just
    // re-establish full opacity. This guarantees the highlight is visible
    // continuously during playback rather than flashing on/off.
    const anim = Animated.timing(audioHighlightOpacity, {
      toValue: 1,
      duration: 80,
      useNativeDriver: true,
    });
    audioHighlightAnimRef.current = anim;
    anim.start(({ finished: done }) => {
      if (done && audioHighlightAnimRef.current === anim) audioHighlightAnimRef.current = null;
    });
  }, [
    currentAudioWord?.surah,
    currentAudioWord?.ayah,
    currentAudioWord?.position,
    audioHighlightOpacity,
  ]);

  useEffect(() => {
    return () => {
      audioHighlightAnimRef.current?.stop();
      audioHighlightAnimRef.current = null;
      audioHighlightOpacity.stopAnimation();
    };
  }, [audioHighlightOpacity]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setContainerLayout((current) =>
      Math.abs(current.width - nextWidth) < 0.5 &&
      Math.abs(current.height - nextHeight) < 0.5
        ? current
        : { width: nextWidth, height: nextHeight },
    );
  }

  return (
    <View style={[styles.pageWrap, { width }]} onLayout={handleLayout}>
      <View
        style={[
          styles.pageImageShell,
          { width: imageLayout.width, height: imageLayout.height },
        ]}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.pageImage} contentFit="contain" />
        ) : (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Page image missing</Text>
            <Text style={styles.errorBody}>Page {pageNumber} could not be found.</Text>
          </View>
        )}

        {actionSheetVisible ? (
          <Pressable
            style={styles.sheetBackdropLayer}
            onPress={onActionSheetBackdropPress ?? onDismissWordTranslation}
            accessibilityRole="button"
            accessibilityLabel="Close ayah actions"
          />
        ) : null}

        {flashedRect ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flashHighlight,
              {
                top: flashedRect.top,
                left: flashedRect.left,
                width: flashedRect.width,
                height: flashedRect.height,
                opacity: flashOpacity,
              },
            ]}
          />
        ) : null}

        {overlayRects.map((rect) => {
          const word = {
            surah: rect.surah,
            ayah: rect.ayah,
            position: rect.position,
          };
          return (
            <Pressable
              key={rect.key}
              accessible={false}
              style={[
                styles.wordOverlay,
                actionSheetVisible && styles.wordOverlayAboveBackdrop,
                {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                },
              ]}
              onPress={() => {
                if (suppressedLongPressKeyRef.current === rect.key) {
                  suppressedLongPressKeyRef.current = null;
                  return;
                }
                onWordTap(pageNumber, rect.wordRect, {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                });
              }}
              onLongPress={() => {
                suppressedLongPressKeyRef.current = rect.key;
                setTimeout(() => {
                  if (suppressedLongPressKeyRef.current === rect.key) {
                    suppressedLongPressKeyRef.current = null;
                  }
                }, 1000);
                onWordLongPress?.(word);
              }}
            />
          );
        })}

        {audioHighlightRect ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.audioHighlight,
              {
                top: audioHighlightRect.top,
                left: audioHighlightRect.left,
                width: audioHighlightRect.width,
                height: audioHighlightRect.height,
                opacity: audioHighlightOpacity,
              },
            ]}
          />
        ) : null}

        {activeWordTranslationTarget && popoverLayout ? (
          <View
            pointerEvents="none"
            style={[
              styles.wordTranslationPopover,
              {
                top: popoverLayout.top,
                left: popoverLayout.left,
                width: popoverLayout.width,
              },
            ]}
          >
            <Text style={styles.wordTranslationMeta}>
              {activeWordTranslationTarget.surah}:{activeWordTranslationTarget.ayah} word{" "}
              {activeWordTranslationTarget.position}
            </Text>
            <Text style={styles.wordTranslationText}>
              {wordTranslationLoading
                ? "Loading..."
                : wordTranslationText ?? "Translation unavailable"}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function MushafTestPageView({
  currentPage,
  onPageChange,
  currentAudioWord,
  onWordPress,
  onWordSeek,
  onWordLongPress,
  actionSheetVisible = false,
  onActionSheetBackdropPress,
}: MushafTestPageViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = Math.max(1, Math.round(screenWidth));
  const safeCurrentPage = clampPage(currentPage);
  const listRef = useRef<FlatList<number>>(null);
  const preloadedPagesRef = useRef<Set<number>>(new Set());
  const [flashedWord, setFlashedWord] = useState<FlashedWord | null>(null);
  const [wordTranslationTarget, setWordTranslationTarget] =
    useState<WordTranslationTarget | null>(null);
  const [wordTranslationText, setWordTranslationText] = useState<string | null>(null);
  const [wordTranslationLoading, setWordTranslationLoading] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTranslationRequestRef = useRef(0);

  // Stable ref so the auto-paging effect doesn't need onPageChange in its deps.
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => { onPageChangeRef.current = onPageChange; }, [onPageChange]);

  // Auto-paging: when audio word moves to a different page, swipe Test Mushaf to follow.
  // lastAutoPagedRef avoids firing duplicate onPageChange calls for the same target page.
  const lastAutoPagedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentAudioWord) {
      lastAutoPagedRef.current = null;
      return;
    }
    const audioPage = getMushafPageForVerse(currentAudioWord.surah, currentAudioWord.ayah);
    if (audioPage === null) return;
    // Already on the correct page: clear the tracker so a future manual navigation
    // can re-trigger auto-paging back to this page.
    if (audioPage === safeCurrentPage) {
      lastAutoPagedRef.current = null;
      return;
    }
    // Avoid duplicate calls if we already fired for this target page.
    if (audioPage === lastAutoPagedRef.current) return;
    lastAutoPagedRef.current = audioPage;
    onPageChangeRef.current(audioPage);
  }, [currentAudioWord, safeCurrentPage]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<number> | null | undefined, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  useEffect(() => {
    const pagesToPreload = [
      safeCurrentPage,
      Math.max(safeCurrentPage - 1, 1),
      Math.min(safeCurrentPage + 1, TOTAL_QURAN_COM_1405_PAGES),
      Math.min(safeCurrentPage + 2, TOTAL_QURAN_COM_1405_PAGES),
    ];
    const newPagesToPreload = pagesToPreload.filter(
      (page) => !preloadedPagesRef.current.has(page),
    );
    if (newPagesToPreload.length === 0) return;

    let cancelled = false;
    async function preloadImages() {
      try {
        await Promise.all(
          newPagesToPreload.map(async (page) => {
            const image = getQuranCom1405PageImage(page);
            if (!image) return;
            await Image.loadAsync(image);
          }),
        );
        if (cancelled) return;
        newPagesToPreload.forEach((page) => preloadedPagesRef.current.add(page));
        const pagesToKeep = new Set(pagesToPreload);
        preloadedPagesRef.current = new Set(
          [...preloadedPagesRef.current].filter((page) => pagesToKeep.has(page)),
        );
      } catch {
        // Preloading is only a swipe performance optimization.
      }
    }

    void preloadImages();
    return () => {
      cancelled = true;
    };
  }, [safeCurrentPage]);

  useEffect(() => {
    const index = safeCurrentPage - 1;
    const timeout = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index, animated: false });
      } catch {
        try {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * pageWidth), animated: false });
        } catch {
          // The list may not be measured yet; onScrollToIndexFailed will retry.
        }
      }
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [pageWidth, safeCurrentPage]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashAnimationRef.current?.stop();
      flashAnimationRef.current = null;
      flashOpacity.stopAnimation();
    };
  }, [flashOpacity]);

  function clearWordTranslationPopover() {
    wordTranslationRequestRef.current += 1;
    setWordTranslationTarget(null);
    setWordTranslationText(null);
    setWordTranslationLoading(false);
  }

  useEffect(() => {
    if (!actionSheetVisible) clearWordTranslationPopover();
  }, [actionSheetVisible]);

  function handleWordTap(pageNumber: number, word: QuranCom1405WordRect, scaledRect: ScaledWordRect) {
    const [surah, ayah, position, _line, minX, maxX, minY, maxY] = word;
    const target = { surah, ayah, position };
    const next: FlashedWord = { pageNumber, surah, ayah, position, minX, maxX, minY, maxY };

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    flashAnimationRef.current?.stop();
    flashAnimationRef.current = null;
    flashOpacity.stopAnimation();
    flashOpacity.setValue(0);

    setFlashedWord(next);

    const animation = Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 0.45, duration: 250, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(flashOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]);
    flashAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (flashAnimationRef.current === animation) {
        flashAnimationRef.current = null;
      }
      if (finished) {
        setFlashedWord(null);
      }
    });

    onWordPress?.(target);
    if (actionSheetVisible) {
      const requestId = wordTranslationRequestRef.current + 1;
      wordTranslationRequestRef.current = requestId;
      setWordTranslationTarget({
        pageNumber,
        surah,
        ayah,
        position,
        rect: scaledRect,
      });
      setWordTranslationText(null);
      setWordTranslationLoading(true);
      fetchWordTranslation(surah, ayah, position)
        .then((translation) => {
          if (wordTranslationRequestRef.current !== requestId) return;
          setWordTranslationText(translation);
        })
        .catch(() => {
          if (wordTranslationRequestRef.current !== requestId) return;
          setWordTranslationText(null);
        })
        .finally(() => {
          if (wordTranslationRequestRef.current === requestId) {
            setWordTranslationLoading(false);
          }
        });
      return;
    }

    onWordSeek?.(target);
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.max(
      0,
      Math.min(
        TOTAL_QURAN_COM_1405_PAGES - 1,
        Math.round(event.nativeEvent.contentOffset.x / pageWidth),
      ),
    );
    const nextPage = index + 1;
    if (nextPage !== safeCurrentPage) {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
      flashAnimationRef.current?.stop();
      flashAnimationRef.current = null;
      flashOpacity.stopAnimation();
      flashOpacity.setValue(0);
      setFlashedWord(null);
      clearWordTranslationPopover();
    }
    onPageChange(nextPage);
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        style={styles.pageList}
        data={PAGE_NUMBERS}
        keyExtractor={(page) => String(page)}
        horizontal
        pagingEnabled
        inverted
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={safeCurrentPage - 1}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            try {
              listRef.current?.scrollToIndex({ index: info.index, animated: false });
            } catch {
              listRef.current?.scrollToOffset({
                offset: Math.max(0, info.index * pageWidth),
                animated: false,
              });
            }
          }, 80);
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        renderItem={({ item }) => (
          <MushafTestPage
            pageNumber={item}
            width={pageWidth}
            flashedWord={flashedWord}
            flashOpacity={flashOpacity}
            currentAudioWord={currentAudioWord}
            actionSheetVisible={actionSheetVisible}
            wordTranslationTarget={wordTranslationTarget}
            wordTranslationText={wordTranslationText}
            wordTranslationLoading={wordTranslationLoading}
            onWordTap={handleWordTap}
            onWordLongPress={onWordLongPress}
            onDismissWordTranslation={clearWordTranslationPopover}
            onActionSheetBackdropPress={onActionSheetBackdropPress}
          />
        )}
      />

      {flashedWord ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.debugToast, { opacity: flashOpacity }]}
        >
          <Text style={styles.debugToastText}>
            {flashedWord.surah}:{flashedWord.ayah} word {flashedWord.position}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  pageList: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  pageWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  pageImageShell: {
    backgroundColor: "#ffffff",
    overflow: "hidden",
    position: "relative",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  wordOverlay: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 2,
  },
  wordOverlayAboveBackdrop: {
    zIndex: 6,
  },
  sheetBackdropLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 4,
  },
  flashHighlight: {
    position: "absolute",
    // Amber (#fbbf24) is the user-initiated tap-flash from Phase 1b.
    backgroundColor: "#fbbf24",
    borderRadius: 4,
    zIndex: 1,
  },
  audioHighlight: {
    position: "absolute",
    // Green distinguishes audio-following highlight from the amber tap-flash.
    backgroundColor: "rgba(34, 197, 94, 0.35)",
    borderRadius: 4,
    zIndex: 3,
  },
  wordTranslationPopover: {
    position: "absolute",
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.92)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    zIndex: 7,
  },
  wordTranslationMeta: {
    marginBottom: 3,
    color: "#cbd5e1",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
  },
  wordTranslationText: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  debugToast: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  debugToastText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    padding: 24,
  },
  errorTitle: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorBody: {
    color: "#dc2626",
    fontSize: 11,
    textAlign: "center",
  },
});
