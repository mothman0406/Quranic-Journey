import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  BAYAAN_MUSHAF_TEXT,
  BAYAAN_PAGE_THEME,
  getJuzForPage,
} from "@/components/mushaf/bayaan/bayaan-constants";

export function BayaanMushafPageCard({
  pageNumber,
  pageSurahNames,
  isSinglePageLayout,
  cachedScale,
  isContentVisible,
  pageContentRef,
  pageMeasureRef,
  children,
}: {
  pageNumber: number;
  pageSurahNames: string;
  isSinglePageLayout: boolean;
  cachedScale?: number;
  isContentVisible: boolean;
  pageContentRef?: (node: HTMLDivElement | null) => void;
  pageMeasureRef?: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto overflow-hidden rounded-[24px] shadow-[0_18px_42px_rgba(120,92,34,0.14)]",
        isSinglePageLayout && "h-full",
      )}
      style={{
        width: isSinglePageLayout ? "100%" : "min(680px, 100%)",
        height: isSinglePageLayout ? "100%" : "min(70vh, 760px)",
        background: `linear-gradient(to bottom, ${BAYAAN_PAGE_THEME.page}, ${BAYAAN_PAGE_THEME.pageEdge})`,
        border: `1px solid ${BAYAAN_PAGE_THEME.pageBorder}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-2 text-[11px]"
        style={{
          borderBottom: `1px solid ${BAYAAN_PAGE_THEME.pageBorder}`,
          color: BAYAAN_PAGE_THEME.pageLabel,
        }}
      >
        <span
          dir="rtl"
          className="truncate"
          style={{
            fontFamily: '"Scheherazade New", "Amiri Quran", serif',
            fontSize: "1.05em",
            letterSpacing: 0,
          }}
        >
          {pageSurahNames}
        </span>
        <span className="shrink-0 tracking-[0.22em]">
          JUZ {getJuzForPage(pageNumber)}
        </span>
      </div>

      <div
        className="mushaf-page"
        ref={pageContentRef}
        dir="rtl"
        lang="ar"
        style={{
          fontFamily: BAYAAN_MUSHAF_TEXT,
          fontSize:
            cachedScale !== undefined
              ? `${cachedScale}em`
              : "clamp(14px, 2.2vh, 28px)",
          lineHeight: 1.98,
          padding: isSinglePageLayout
            ? "6px 1px 2px"
            : "14px 22px 6px",
          color: BAYAAN_PAGE_THEME.pageText,
          textAlign: "justify",
          textAlignLast: "right",
          textJustify: "inter-word",
          fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
          overflowX: "hidden",
          overflowY: "hidden",
          flex: 1,
          minHeight: 0,
          visibility: isContentVisible ? "visible" : "hidden",
        }}
      >
        <div
          ref={pageMeasureRef}
          style={{
            width: "100%",
          }}
        >
          {children}
        </div>
      </div>

      <div
        className="py-1.5 text-center text-[11px] tracking-[0.24em]"
        style={{
          borderTop: `1px solid ${BAYAAN_PAGE_THEME.pageBorder}`,
          color: BAYAAN_PAGE_THEME.pageLabel,
        }}
      >
        {pageNumber}
      </div>
    </div>
  );
}
