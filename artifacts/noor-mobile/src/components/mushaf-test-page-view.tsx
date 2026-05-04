import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
} from "@/src/lib/quran-com-1405-ayah-coords";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
  TOTAL_QURAN_COM_1405_PAGES,
  getQuranCom1405PageImage,
} from "@/src/lib/quran-com-1405-page-images";

type MushafTestWordTarget = {
  surah: number;
  ayah: number;
  position: number;
};

type MushafTestPageViewProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  onWordPress?: (word: MushafTestWordTarget) => void;
  onWordLongPress?: (word: MushafTestWordTarget) => void;
};

type PageLayout = {
  width: number;
  height: number;
};

type WordOverlayRect = MushafTestWordTarget & {
  key: string;
  top: number;
  left: number;
  width: number;
  height: number;
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

function buildWordOverlayRects(pageNumber: number, layout: PageLayout): WordOverlayRect[] {
  if (layout.width <= 0 || layout.height <= 0) return [];

  const widthCoeff = layout.width / QURAN_COM_1405_NATIVE_WIDTH;
  const heightCoeff = layout.height / QURAN_COM_1405_NATIVE_HEIGHT;
  const rects: WordOverlayRect[] = [];

  getQuranCom1405WordRectsForPage(pageNumber).forEach(
    ([surah, ayah, position, line, minX, maxX, minY, maxY], index) => {
      const top = minY * heightCoeff;
      const left = minX * widthCoeff;
      const width = (maxX - minX) * widthCoeff;
      const height = (maxY - minY) * heightCoeff;
      if (top >= layout.height || top + height <= 0 || left >= layout.width || left + width <= 0) {
        return;
      }

      const clampedTop = Math.max(0, top);
      const clampedLeft = Math.max(0, left);
      const clampedWidth = Math.max(0, Math.min(width, layout.width - clampedLeft));
      const clampedHeight = Math.max(0, Math.min(height, layout.height - clampedTop));
      if (clampedWidth <= 0 || clampedHeight <= 0) return;

      rects.push({
        key: `${pageNumber}:${surah}:${ayah}:${position}:${line}:${index}`,
        surah,
        ayah,
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

function MushafTestPage({
  pageNumber,
  width,
  onWordPress,
  onWordLongPress,
}: {
  pageNumber: number;
  width: number;
  onWordPress?: (word: MushafTestWordTarget) => void;
  onWordLongPress?: (word: MushafTestWordTarget) => void;
}) {
  const [containerLayout, setContainerLayout] = useState<PageLayout>({ width: 0, height: 0 });
  const imageSource = getQuranCom1405PageImage(pageNumber);
  const imageLayout = useMemo(
    () => getContainedPageLayout(containerLayout),
    [containerLayout],
  );
  const overlayRects = useMemo(
    () => buildWordOverlayRects(pageNumber, imageLayout),
    [imageLayout, pageNumber],
  );

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
                {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                },
              ]}
              onPress={() => onWordPress?.(word)}
              onLongPress={() => onWordLongPress?.(word)}
            />
          );
        })}
      </View>
    </View>
  );
}

export function MushafTestPageView({
  currentPage,
  onPageChange,
  onWordPress,
  onWordLongPress,
}: MushafTestPageViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = Math.max(1, Math.round(screenWidth));
  const safeCurrentPage = clampPage(currentPage);
  const listRef = useRef<FlatList<number>>(null);
  const preloadedPagesRef = useRef<Set<number>>(new Set());

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

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.max(
      0,
      Math.min(
        TOTAL_QURAN_COM_1405_PAGES - 1,
        Math.round(event.nativeEvent.contentOffset.x / pageWidth),
      ),
    );
    onPageChange(index + 1);
  }

  return (
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
          onWordPress={onWordPress}
          onWordLongPress={onWordLongPress}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
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
