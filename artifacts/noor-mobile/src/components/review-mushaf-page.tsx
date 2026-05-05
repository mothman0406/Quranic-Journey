import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import {
  QURAN_COM_1405_NATIVE_HEIGHT,
  QURAN_COM_1405_NATIVE_WIDTH,
  getQuranCom1405AyahRectsForPage,
  getQuranCom1405WordRectsForPage,
} from "@/src/lib/quran-com-1405-ayah-coords";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
  getQuranCom1405PageImage,
} from "@/src/lib/quran-com-1405-page-images";
import type { ApiPageVerse } from "@/src/lib/quran";

const QURAN_COM_1405_PAGE_ASPECT_RATIO =
  QURAN_COM_1405_PAGE_WIDTH / QURAN_COM_1405_PAGE_HEIGHT;

export type ReviewMushafPageAyahTarget = {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  textUthmani: string;
};

type PageImageLayout = {
  width: number;
  height: number;
};

type PageOverlayRect = {
  key: string;
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  top: number;
  left: number;
  width: number;
  height: number;
};

type PageWordMaskRect = PageOverlayRect & {
  position: number;
};

function verseKeyFor(surahNumber: number, ayahNumber: number) {
  return `${surahNumber}:${ayahNumber}`;
}

function getContainedQuranCom1405PageLayout(container: PageImageLayout): PageImageLayout {
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

function pushOverlayRect(
  rects: PageOverlayRect[],
  {
    pageNumber,
    surahNumber,
    ayahNumber,
    top,
    left,
    width,
    height,
    layout,
    suffix,
  }: {
    pageNumber: number;
    surahNumber: number;
    ayahNumber: number;
    top: number;
    left: number;
    width: number;
    height: number;
    layout: PageImageLayout;
    suffix: string;
  },
) {
  if (top >= layout.height || top + height <= 0 || left >= layout.width || left + width <= 0) {
    return;
  }

  const clampedTop = Math.max(0, top);
  const clampedLeft = Math.max(0, left);
  const clampedHeight = Math.max(0, Math.min(height, layout.height - clampedTop));
  const clampedWidth = Math.max(0, Math.min(width, layout.width - clampedLeft));
  if (clampedHeight < 6 || clampedWidth < 8) return;

  rects.push({
    key: `${pageNumber}:${surahNumber}:${ayahNumber}:${suffix}:${Math.round(clampedTop)}:${Math.round(clampedLeft)}`,
    verseKey: verseKeyFor(surahNumber, ayahNumber),
    surahNumber,
    ayahNumber,
    top: clampedTop,
    left: clampedLeft,
    width: clampedWidth,
    height: clampedHeight,
  });
}

function buildQuranCom1405OverlayRects(
  pageNumber: number,
  layout: PageImageLayout,
): PageOverlayRect[] {
  if (layout.width <= 0 || layout.height <= 0) return [];

  const ayahRects = getQuranCom1405AyahRectsForPage(pageNumber);
  if (ayahRects.length === 0) return [];

  const widthCoeff = layout.width / QURAN_COM_1405_NATIVE_WIDTH;
  const heightCoeff = layout.height / QURAN_COM_1405_NATIVE_HEIGHT;
  const rects: PageOverlayRect[] = [];

  ayahRects.forEach(
    ([surahNumber, ayahNumber, lineNumber, minX, maxX, minY, maxY], index) => {
      pushOverlayRect(rects, {
        pageNumber,
        surahNumber,
        ayahNumber,
        top: minY * heightCoeff,
        left: minX * widthCoeff,
        width: (maxX - minX) * widthCoeff,
        height: (maxY - minY) * heightCoeff,
        layout,
        suffix: `line-${lineNumber}-${index}`,
      });
    },
  );

  return rects;
}

function buildQuranCom1405WordMaskRects(
  pageNumber: number,
  layout: PageImageLayout,
): PageWordMaskRect[] {
  if (layout.width <= 0 || layout.height <= 0) return [];

  const wordRects = getQuranCom1405WordRectsForPage(pageNumber);
  if (wordRects.length === 0) return [];

  const widthCoeff = layout.width / QURAN_COM_1405_NATIVE_WIDTH;
  const heightCoeff = layout.height / QURAN_COM_1405_NATIVE_HEIGHT;
  const rects: PageWordMaskRect[] = [];

  wordRects.forEach(
    ([surahNumber, ayahNumber, position, lineNumber, minX, maxX, minY, maxY], index) => {
      const top = minY * heightCoeff;
      const left = minX * widthCoeff;
      const width = (maxX - minX) * widthCoeff;
      const height = (maxY - minY) * heightCoeff;
      if (top >= layout.height || top + height <= 0 || left >= layout.width || left + width <= 0) {
        return;
      }

      const clampedTop = Math.max(0, top);
      const clampedLeft = Math.max(0, left);
      const clampedHeight = Math.max(0, Math.min(height, layout.height - clampedTop));
      const clampedWidth = Math.max(0, Math.min(width, layout.width - clampedLeft));
      if (clampedHeight < 6 || clampedWidth < 8) return;

      rects.push({
        key: `${pageNumber}:${surahNumber}:${ayahNumber}:${position}:${lineNumber}:${index}`,
        verseKey: verseKeyFor(surahNumber, ayahNumber),
        surahNumber,
        ayahNumber,
        position,
        top: clampedTop,
        left: clampedLeft,
        width: clampedWidth,
        height: clampedHeight,
      });
    },
  );

  return rects;
}

export function ReviewMushafPage({
  pageNumber,
  verses,
  width,
  height,
  loading,
  error,
  activeVerseKey,
  blindMode = false,
  revealedAyahKeys,
  blurActiveSurahNumber,
  onToggleAyahReveal,
  onLongPressAyah,
  onPressEndMarker,
}: {
  pageNumber: number;
  verses: ApiPageVerse[];
  width: number;
  height: number;
  loading?: boolean;
  error?: string | null;
  activeVerseKey?: string | null;
  blindMode?: boolean;
  revealedAyahKeys?: Set<string>;
  blurActiveSurahNumber?: number | null;
  onToggleAyahReveal?: (verseKey: string) => void;
  onLongPressAyah?: (target: ReviewMushafPageAyahTarget) => void;
  onPressEndMarker?: (target: ReviewMushafPageAyahTarget) => void;
}) {
  const imageSource = getQuranCom1405PageImage(pageNumber);
  const suppressedLongPressKeyRef = useRef<string | null>(null);
  const imageLayout = useMemo(
    () => getContainedQuranCom1405PageLayout({ width, height }),
    [height, width],
  );
  const verseByKey = useMemo(() => {
    const map = new Map<string, ApiPageVerse>();
    for (const verse of verses) map.set(verse.verse_key, verse);
    return map;
  }, [verses]);
  const overlayRects = useMemo(
    () => buildQuranCom1405OverlayRects(pageNumber, imageLayout),
    [imageLayout, pageNumber],
  );
  const wordMaskRects = useMemo(
    () => buildQuranCom1405WordMaskRects(pageNumber, imageLayout),
    [imageLayout, pageNumber],
  );
  const verseMarkerKeys = useMemo(() => {
    const maxPositionByAyah = new Map<string, number>();

    wordMaskRects.forEach((rect) => {
      const current = maxPositionByAyah.get(rect.verseKey) ?? -Infinity;
      if (rect.position > current) maxPositionByAyah.set(rect.verseKey, rect.position);
    });

    const markers = new Set<string>();
    wordMaskRects.forEach((rect) => {
      if (maxPositionByAyah.get(rect.verseKey) === rect.position) {
        markers.add(rect.key);
      }
    });

    return markers;
  }, [wordMaskRects]);
  const blindMaskRects = useMemo(() => {
    if (!blindMode) return [];
    return wordMaskRects.filter((rect) => {
      if (verseMarkerKeys.has(rect.key)) return false;
      if (revealedAyahKeys?.has(rect.verseKey)) return false;
      return true;
    });
  }, [blindMode, revealedAyahKeys, verseMarkerKeys, wordMaskRects]);

  function targetFromRect(rect: PageOverlayRect): ReviewMushafPageAyahTarget {
    const verse = verseByKey.get(rect.verseKey);
    return {
      verseKey: rect.verseKey,
      surahNumber: rect.surahNumber,
      ayahNumber: rect.ayahNumber,
      pageNumber,
      textUthmani: verse?.text_uthmani ?? "",
    };
  }

  return (
    <View style={[styles.shell, { width, height }]}>
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
            <Ionicons name="cloud-offline-outline" size={24} color="#b91c1c" />
            <Text style={styles.errorTitle}>Page image missing</Text>
            <Text style={styles.errorBody}>Page {pageNumber} could not be found.</Text>
          </View>
        )}

        {imageSource && blindMode
          ? blindMaskRects.map((rect) => (
              <View
                key={`blind-mask-${rect.key}`}
                pointerEvents="none"
                style={[
                  styles.ayahOverlayBlindMask,
                  {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  },
                ]}
              />
            ))
          : null}

        {imageSource
          ? overlayRects.map((rect) => {
              const active = activeVerseKey === rect.verseKey;
              const hiddenByBlind =
                blindMode && !(revealedAyahKeys?.has(rect.verseKey) ?? false);
              const dimmedByBlur =
                !blindMode &&
                blurActiveSurahNumber !== null &&
                blurActiveSurahNumber !== undefined &&
                rect.surahNumber !== blurActiveSurahNumber;
              const disabled = blindMode
                ? !onToggleAyahReveal && !onLongPressAyah
                : !onPressEndMarker && !onLongPressAyah;
              return (
                <Pressable
                  key={rect.key}
                  accessible
                  accessibilityLabel={`Quran ${rect.verseKey}`}
                  accessibilityRole={!disabled ? "button" : undefined}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.ayahOverlay,
                    {
                      top: rect.top,
                      left: rect.left,
                      width: rect.width,
                      height: rect.height,
                    },
                    active && !hiddenByBlind && styles.ayahOverlayActive,
                    dimmedByBlur && styles.ayahOverlayBlurDim,
                    pressed && !hiddenByBlind && styles.ayahOverlayPressed,
                  ]}
                  onPress={() => {
                    if (suppressedLongPressKeyRef.current === rect.key) {
                      suppressedLongPressKeyRef.current = null;
                      return;
                    }
                    if (blindMode) {
                      onToggleAyahReveal?.(rect.verseKey);
                      return;
                    }
                    onPressEndMarker?.(targetFromRect(rect));
                  }}
                  onLongPress={
                    onLongPressAyah
                      ? () => {
                          suppressedLongPressKeyRef.current = rect.key;
                          setTimeout(() => {
                            if (suppressedLongPressKeyRef.current === rect.key) {
                              suppressedLongPressKeyRef.current = null;
                            }
                          }, 1000);
                          onLongPressAyah(targetFromRect(rect));
                        }
                      : undefined
                  }
                  delayLongPress={420}
                />
              );
            })
          : null}

        {loading ? (
          <View pointerEvents="none" style={styles.pageDataBadge}>
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        ) : error ? (
          <View pointerEvents="none" style={styles.pageDataBadge}>
            <Ionicons name="cloud-offline-outline" size={14} color="#dc2626" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d7ccb2",
    backgroundColor: "#fffdf8",
    shadowColor: "#785c22",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
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
  ayahOverlay: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 4,
  },
  ayahOverlayActive: {
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.48)",
  },
  ayahOverlayBlurDim: {
    backgroundColor: "rgba(15, 23, 42, 0.32)",
    borderRadius: 3,
  },
  ayahOverlayBlindMask: {
    position: "absolute",
    backgroundColor: "#fffbeb",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#fef3c7",
    zIndex: 4,
  },
  ayahOverlayPressed: {
    backgroundColor: "rgba(37, 99, 235, 0.24)",
  },
  pageDataBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    zIndex: 8,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 20,
    gap: 6,
  },
  errorTitle: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  errorBody: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
