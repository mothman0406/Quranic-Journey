import { useCallback, useEffect, useRef, useState } from "react";

import {
  BAYAAN_BASMALLAH,
  BAYAAN_SURAH_DIVIDER_CHAR,
  getBayaanSurahGlyph,
} from "@/components/mushaf/bayaan/bayaan-constants";

const bayaanMushafScaleCache = new Map<string, number>();

function getBayaanScaleCacheKey(
  mushafFitContentKey: string,
  pageNumber: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return [
    mushafFitContentKey,
    pageNumber,
    viewportWidth,
    viewportHeight,
  ].join("|");
}

export function useBayaanMushafFit({
  surahNumber,
  surahName,
  mushafFitContentKey,
  pageNumbers,
  isSinglePageLayout,
}: {
  surahNumber: number;
  surahName: string;
  mushafFitContentKey: string;
  pageNumbers: number[];
  isSinglePageLayout: boolean;
}) {
  const pageContentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pageMeasureRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fittedMushafContentKeyRef = useRef<string | null>(null);
  const viewportWidthRef = useRef<number>(
    typeof window !== "undefined" ? Math.round(window.innerWidth) : 0,
  );
  const [visibleViewportHeight, setVisibleViewportHeight] = useState<number>(
    () => (typeof window !== "undefined" ? Math.round(window.innerHeight) : 0),
  );
  const [mushafFontsReady, setMushafFontsReady] = useState(() =>
    typeof document === "undefined" ? false : !("fonts" in document),
  );
  const [isMushafFitReady, setIsMushafFitReady] = useState(false);

  const canRunStableMushafFit = mushafFontsReady && pageNumbers.length > 0;
  const isMushafContentVisible = canRunStableMushafFit && isMushafFitReady;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!("fonts" in document)) {
      setMushafFontsReady(true);
      return;
    }

    let cancelled = false;
    setMushafFontsReady(false);

    Promise.all([
      document.fonts.load('1em "BayaanDigitalKhatt"', BAYAAN_BASMALLAH),
      document.fonts.load('1em "BayaanQuranCommon"', BAYAAN_SURAH_DIVIDER_CHAR),
      document.fonts.load(
        '1em "BayaanSurahQCF"',
        getBayaanSurahGlyph(surahNumber) || surahName,
      ),
      document.fonts.ready,
    ])
      .catch(() => {})
      .then(() => {
        if (!cancelled) {
          setMushafFontsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [surahNumber, surahName]);

  useEffect(() => {
    fittedMushafContentKeyRef.current = null;
    setIsMushafFitReady(false);
    for (const el of Object.values(pageContentRefs.current)) {
      if (!el) continue;
      el.style.fontSize = "";
    }
  }, [mushafFitContentKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewportMetrics = () => {
      viewportWidthRef.current = Math.round(window.innerWidth);
      setVisibleViewportHeight(Math.round(window.innerHeight));
    };

    updateViewportMetrics();
    window.addEventListener("resize", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
    };
  }, []);

  useEffect(() => {
    if (!canRunStableMushafFit) return;
    if (fittedMushafContentKeyRef.current === mushafFitContentKey) return;

    let cancelled = false;
    let rafId = 0;
    let stableFrameCount = 0;
    let lastSignature = "";

    const captureLayoutSignature = () => {
      const parts: string[] = [];
      for (const pageNumber of pageNumbers) {
        const el = pageContentRefs.current[pageNumber];
        const measureEl = pageMeasureRefs.current[pageNumber] ?? el;
        if (!el) return null;
        const clientWidth = Math.round(el.clientWidth);
        const clientHeight = Math.round(el.clientHeight);
        const scrollWidth = Math.round(measureEl?.scrollWidth ?? 0);
        const scrollHeight = Math.round(measureEl?.scrollHeight ?? 0);
        if (clientWidth <= 0 || clientHeight <= 0) return null;
        parts.push(
          [
            pageNumber,
            clientWidth,
            clientHeight,
            scrollWidth,
            scrollHeight,
          ].join(":"),
        );
      }
      return parts.join("|");
    };

    const fitWhenStable = () => {
      if (cancelled) return;

      const signature = captureLayoutSignature();
      if (!signature) {
        rafId = requestAnimationFrame(fitWhenStable);
        return;
      }

      if (signature === lastSignature) {
        stableFrameCount += 1;
      } else {
        lastSignature = signature;
        stableFrameCount = 0;
      }

      if (stableFrameCount < 2) {
        rafId = requestAnimationFrame(fitWhenStable);
        return;
      }

      requestAnimationFrame(() => {
        if (cancelled) return;
        for (const pageNumber of pageNumbers) {
          const el = pageContentRefs.current[pageNumber];
          const measureEl = pageMeasureRefs.current[pageNumber] ?? el;
          if (!el) continue;
          const layoutStyles = getComputedStyle(el);
          const paddingX =
            parseFloat(layoutStyles.paddingLeft) +
            parseFloat(layoutStyles.paddingRight);
          const paddingY =
            parseFloat(layoutStyles.paddingTop) +
            parseFloat(layoutStyles.paddingBottom);
          const availableWidth = Math.max(0, el.clientWidth - paddingX);
          const availableHeight = Math.max(0, el.clientHeight - paddingY);
          let lo = isSinglePageLayout ? 0.72 : 0.62;
          let hi = isSinglePageLayout ? 1.72 : 1.16;
          let best = lo;
          const scaleCacheKey = getBayaanScaleCacheKey(
            mushafFitContentKey,
            pageNumber,
            viewportWidthRef.current,
            visibleViewportHeight,
          );
          const cachedScale = bayaanMushafScaleCache.get(scaleCacheKey) ?? null;
          const parentFontSize = parseFloat(
            getComputedStyle(el.parentElement ?? el).fontSize,
          );
          const currentFontSize = parseFloat(getComputedStyle(el).fontSize);
          const currentScale =
            Number.isFinite(parentFontSize) &&
            parentFontSize > 0 &&
            Number.isFinite(currentFontSize) &&
            currentFontSize > 0
              ? currentFontSize / parentFontSize
              : null;

          if (
            cachedScale !== null &&
            cachedScale >= lo &&
            cachedScale <= hi
          ) {
            el.style.fontSize = `${cachedScale}em`;
            const cachedFitsHeight =
              (measureEl?.scrollHeight ?? 0) <= availableHeight + 1;
            const cachedFitsWidth =
              (measureEl?.scrollWidth ?? 0) <= availableWidth + 1;
            if (cachedFitsHeight && cachedFitsWidth) {
              best = cachedScale;
              bayaanMushafScaleCache.set(scaleCacheKey, cachedScale);
              continue;
            }
          }

          if (
            currentScale !== null &&
            currentScale >= lo &&
            currentScale <= hi
          ) {
            el.style.fontSize = `${currentScale}em`;
            const currentFitsHeight =
              (measureEl?.scrollHeight ?? 0) <= availableHeight + 1;
            const currentFitsWidth =
              (measureEl?.scrollWidth ?? 0) <= availableWidth + 1;
            if (currentFitsHeight && currentFitsWidth) {
              continue;
            }
          }

          for (let i = 0; i < 28; i += 1) {
            const mid = (lo + hi) / 2;
            el.style.fontSize = `${mid}em`;
            const fitsHeight = (measureEl?.scrollHeight ?? 0) <= availableHeight + 1;
            const fitsWidth = (measureEl?.scrollWidth ?? 0) <= availableWidth + 1;
            if (fitsHeight && fitsWidth) {
              best = mid;
              lo = mid;
            } else {
              hi = mid;
            }
          }
          el.style.fontSize = `${best}em`;
          bayaanMushafScaleCache.set(scaleCacheKey, best);
        }
        if (!cancelled) {
          fittedMushafContentKeyRef.current = mushafFitContentKey;
          setIsMushafFitReady(true);
        }
      });
    };

    rafId = requestAnimationFrame(fitWhenStable);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [
    canRunStableMushafFit,
    mushafFitContentKey,
    pageNumbers,
    isSinglePageLayout,
  ]);

  const getCachedScale = useCallback(
    (pageNumber: number) =>
      bayaanMushafScaleCache.get(
        getBayaanScaleCacheKey(
          mushafFitContentKey,
          pageNumber,
          viewportWidthRef.current,
          visibleViewportHeight,
        ),
      ),
    [mushafFitContentKey, visibleViewportHeight],
  );

  return {
    pageContentRefs,
    pageMeasureRefs,
    visibleViewportHeight,
    isMushafContentVisible,
    scaleCacheViewportWidth: viewportWidthRef.current,
    getCachedScale,
  };
}
