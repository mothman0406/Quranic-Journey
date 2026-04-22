import { useEffect, useMemo, useRef, useState } from "react";
import { CelebrationOverlay } from "@/components/celebration-overlay";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listReviews,
  completeReview,
  getSurah,
  getChildDashboard,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildNav } from "@/components/child-nav";
import {
  RECITERS,
  type Reciter,
  buildAudioUrl,
} from "@/components/verse-player";
import {
  ChevronLeft,
  Check,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Settings2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const QURAN_API = "https://api.quran.com/api/v4";

const QUALITY_LABELS = [
  "Forgot completely",
  "Serious errors",
  "Correct with difficulty",
  "Correct with hesitation",
  "Good",
  "Perfect",
];
const QUALITY_COLORS = [
  "bg-red-100 text-red-700",
  "bg-red-100 text-red-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-emerald-200 text-emerald-800",
];

type ApiWord = {
  position: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string | { text: string; language_name: string };
};

type PageVerseData = {
  verse_key: string;
  text_uthmani: string;
  text_uthmani_tajweed?: string;
  words?: ApiWord[];
};

type ChapterVerseData = {
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  text_uthmani_tajweed?: string;
  page_number?: number;
};

type LineWord = {
  verse_key: string;
  surahId: number;
  verseNum: number;
  position: number;
  wordIdxInVerse: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string;
};

type MushafChapter = {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name: { name: string };
  bismillah_pre: boolean;
};

type ReviewMushafItem = {
  surahId: number;
  surahNumber: number;
  surahName: string;
  reviewItemId: number;
};

type ReviewSessionItem = {
  id: number;
  surahId: number;
  surahNumber: number;
  surahName?: string | null;
  dueDate?: string;
  isOverdue?: boolean;
};

function sortReviewItemsForMushaf(items: ReviewSessionItem[]) {
  return [...items].sort((a, b) => a.surahNumber - b.surahNumber);
}

const BAYAAN_MUSHAF_TEXT =
  '"BayaanDigitalKhatt", "KFGQPC Hafs", "Amiri Quran", serif';
const BAYAAN_MUSHAF_HEADER =
  '"BayaanSurahQCF", "BayaanDigitalKhatt", "KFGQPC Hafs", serif';
const BAYAAN_MUSHAF_DIVIDER = '"BayaanQuranCommon", serif';
const BAYAAN_SURAH_DIVIDER_CHAR = "\uE000";
const BAYAAN_BASMALLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
const BAYAAN_PAGE_THEME = {
  screen: "#efe8da",
  screenTint: "#f7f2e7",
  screenText: "#1c1912",
  chromeBorder: "#d8cfbb",
  chromeMuted: "#7d7157",
  page: "#fffdf8",
  pageEdge: "#f5efe0",
  pageBorder: "#d7ccb2",
  pageRule: "#cdbb8b",
  pageLabel: "#8f7d56",
  pageText: "#1f1a13",
  pageMuted: "#b0a184",
  markerBorder: "#bea15c",
  markerText: "#866622",
  markerSurface: "#fffaf0",
  activeHighlight: "rgba(190, 161, 92, 0.18)",
  activeMarker: "#9c7b31",
  activeMarkerBg: "rgba(190, 161, 92, 0.24)",
} as const;

const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const;

const BAYAAN_QCF_SURAH_CODEPOINTS = [
  0xfc45, 0xfc46, 0xfc47, 0xfc4a, 0xfc4b, 0xfc4e, 0xfc4f, 0xfc51, 0xfc52,
  0xfc53, 0xfc55, 0xfc56, 0xfc58, 0xfc5a, 0xfc5b, 0xfc5c, 0xfc5d, 0xfc5e,
  0xfc61, 0xfc62, 0xfc64, 0xfb51, 0xfb52, 0xfb54, 0xfb55, 0xfb57, 0xfb58,
  0xfb5a, 0xfb5b, 0xfb5d, 0xfb5e, 0xfb60, 0xfb61, 0xfb63, 0xfb64, 0xfb66,
  0xfb67, 0xfb69, 0xfb6a, 0xfb6c, 0xfb6d, 0xfb6f, 0xfb70, 0xfb72, 0xfb73,
  0xfb75, 0xfb76, 0xfb78, 0xfb79, 0xfb7b, 0xfb7c, 0xfb7e, 0xfb7f, 0xfb81,
  0xfb82, 0xfb84, 0xfb85, 0xfb87, 0xfb88, 0xfb8a, 0xfb8b, 0xfb8d, 0xfb8e,
  0xfb90, 0xfb91, 0xfb93, 0xfb94, 0xfb96, 0xfb97, 0xfb99, 0xfb9a, 0xfb9c,
  0xfb9d, 0xfb9f, 0xfba0, 0xfba2, 0xfba3, 0xfba5, 0xfba6, 0xfba8, 0xfba9,
  0xfbab, 0xfbac, 0xfbae, 0xfbaf, 0xfbb1, 0xfbb2, 0xfbb4, 0xfbb5, 0xfbb7,
  0xfbb8, 0xfbba, 0xfbbb, 0xfbbd, 0xfbbe, 0xfbc0, 0xfbc1, 0xfbd3, 0xfbd4,
  0xfbd6, 0xfbd7, 0xfbd9, 0xfbda, 0xfbdc, 0xfbdd, 0xfbdf, 0xfbe0, 0xfbe2,
  0xfbe3, 0xfbe5, 0xfbe6, 0xfbe8, 0xfbe9, 0xfbeb,
] as const;

const TAJWEED_CSS = `
@font-face {
  font-family: "BayaanDigitalKhatt";
  src: url("/fonts/bayaan/digital-khatt.otf") format("opentype");
  font-display: swap;
}
@font-face {
  font-family: "BayaanQuranCommon";
  src: url("/fonts/bayaan/quran-common.ttf") format("truetype");
  font-display: swap;
}
@font-face {
  font-family: "BayaanSurahQCF";
  src: url("/fonts/bayaan/surah-name-qcf.ttf") format("truetype");
  font-display: swap;
}
.mushaf-page tajweed {
  color: inherit;
}
.mushaf-page .ham_wasl,
.mushaf-page .slnt,
.mushaf-page .lam_shamsiyya,
.mushaf-page .lam_shamsiyyah { color: #8f7d56; }
.mushaf-page .madda_normal { color: #c2410c; }
.mushaf-page .madda_permissible { color: #ea580c; }
.mushaf-page .madda_necessary,
.mushaf-page .madda_obligatory { color: #dc2626; }
.mushaf-page .qalaqah { color: #16a34a; }
.mushaf-page .ikhafa_shafawi,
.mushaf-page .ikhafa,
.mushaf-page .iqlab { color: #2563eb; }
.mushaf-page .idgham_ghunna,
.mushaf-page .idgham_ghunnah,
.mushaf-page .ghunna,
.mushaf-page .ghunnah { color: #7c3aed; }
.mushaf-page .idgham_wo_ghunna,
.mushaf-page .idgham_wo_ghunnah,
.mushaf-page .idgham_mutajanisayn,
.mushaf-page .idgham_mutaqaribain,
.mushaf-page .idgham_shafawi { color: #0f766e; }
`;

function getJuzForPage(pageNumber: number): number {
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i -= 1) {
    if (pageNumber >= JUZ_START_PAGES[i]) return i + 1;
  }
  return 1;
}

function getBayaanSurahGlyph(surahNumber: number): string {
  const codepoint = BAYAAN_QCF_SURAH_CODEPOINTS[surahNumber - 1];
  return codepoint ? String.fromCodePoint(codepoint) : "";
}

function getArabicSurahNamesForPage(
  verses: PageVerseData[],
  chapters: MushafChapter[],
): string {
  const surahIds = Array.from(
    new Set(verses.map((verse) => Number(verse.verse_key.split(":")[0]))),
  ).filter((surahId) => Number.isFinite(surahId));

  return surahIds
    .map(
      (surahId) =>
        chapters.find((chapter) => chapter.id === surahId)?.name_arabic ??
        `سُورَة ${surahId}`,
    )
    .join(" · ");
}

function BayaanSurahBanner({
  surahNumber,
  surahName,
}: {
  surahNumber: number;
  surahName: string;
}) {
  const surahGlyph = getBayaanSurahGlyph(surahNumber);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        margin: "0.28em 0 0.06em",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(100%, 13.8em)",
          minHeight: "1.72em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: BAYAAN_MUSHAF_DIVIDER,
            fontSize: "1.78em",
            lineHeight: 1,
            color: BAYAAN_PAGE_THEME.pageRule,
            pointerEvents: "none",
          }}
        >
          {BAYAAN_SURAH_DIVIDER_CHAR}
        </span>
        <span
          dir="rtl"
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: surahGlyph
              ? BAYAAN_MUSHAF_HEADER
              : '"Scheherazade New", "Amiri Quran", serif',
            fontSize: surahGlyph ? "1.02em" : "0.86em",
            lineHeight: 1,
            color: BAYAAN_PAGE_THEME.pageLabel,
            whiteSpace: "nowrap",
            letterSpacing: 0,
          }}
        >
          {surahGlyph || surahName}
        </span>
      </div>
    </div>
  );
}

function stripTashkeel(s: string): string {
  return (
    s
      .replace(/\u0670/g, "ا")
      .replace(
        /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g,
        "",
      )
      .replace(/[ـ]/g, "")
      .replace(/[أإآاٱ]/g, "ا")
      .trim() || s
  );
}

const stripVerseEndHtml = (html: string): string =>
  html
    .replace(/(<span[^>]*>[\u06DD\u0660-\u0669\s]+<\/span>\s*)+$/, "")
    .replace(/[\u06DD\u0660-\u0669\s]+$/, "")
    .trimEnd();

function splitTajweedIntoWords(html: string): string[] {
  if (!html) return [];

  const words: string[] = [];
  const openTags: Array<{ name: string; raw: string }> = [];
  const closeActiveTags = () =>
    openTags
      .slice()
      .reverse()
      .map((tag) => `</${tag.name}>`)
      .join("");
  const reopenActiveTags = () => openTags.map((tag) => tag.raw).join("");
  const hasTextContent = (chunk: string) =>
    chunk.replace(/<[^>]+>/g, "").trim().length > 0;
  const pushWord = (chunk: string) => {
    if (!hasTextContent(chunk)) return;
    words.push(`${chunk}${closeActiveTags()}`);
  };

  let current = "";
  let i = 0;
  while (i < html.length) {
    const char = html[i];

    if (char === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) {
        current += html.slice(i);
        break;
      }

      const rawTag = html.slice(i, tagEnd + 1);
      current += rawTag;

      const tagNameMatch = rawTag.match(/^<\s*\/?\s*([a-zA-Z0-9:-]+)/);
      const tagName = tagNameMatch?.[1];
      const isClosingTag = /^<\s*\//.test(rawTag);
      const isSelfClosingTag = /\/\s*>$/.test(rawTag);

      if (tagName && !isSelfClosingTag) {
        if (isClosingTag) {
          const tagIndex = openTags.map((tag) => tag.name).lastIndexOf(tagName);
          if (tagIndex >= 0) {
            openTags.splice(tagIndex, 1);
          }
        } else {
          openTags.push({ name: tagName, raw: rawTag });
        }
      }

      i = tagEnd + 1;
      continue;
    }

    if (/\s/.test(char)) {
      pushWord(current);
      current = reopenActiveTags();
      while (i < html.length && /\s/.test(html[i])) i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  pushWord(current);
  return words;
}

function buildLineGroups(
  verses: PageVerseData[],
): Array<{ lineNum: number; words: LineWord[] }> | null {
  const all: LineWord[] = [];
  for (const pv of verses) {
    if (!pv.words?.length) return null;
    const [surahStr, verseStr] = pv.verse_key.split(":");
    const surahId = parseInt(surahStr, 10);
    const verseNum = parseInt(verseStr, 10);
    const verseTokens = (pv.text_uthmani ?? "").split(/\s+/).filter(Boolean);
    let lastMatchedJ = -1;
    for (const w of pv.words) {
      let wordIdxInVerse: number;
      if (w.char_type_name === "end") {
        wordIdxInVerse = -1;
      } else {
        const target = stripTashkeel(w.text_uthmani);
        let found = -1;
        for (let j = lastMatchedJ + 1; j < verseTokens.length; j++) {
          if (stripTashkeel(verseTokens[j]) === target) {
            found = j;
            break;
          }
        }
        if (found !== -1) {
          lastMatchedJ = found;
          wordIdxInVerse = found;
        } else {
          wordIdxInVerse = w.position - 1;
        }
      }
      all.push({
        verse_key: pv.verse_key,
        surahId,
        verseNum,
        position: w.position,
        wordIdxInVerse,
        text_uthmani: w.text_uthmani,
        char_type_name: w.char_type_name,
        line_number: w.line_number,
        translation:
          typeof w.translation === "object" && w.translation !== null
            ? ((w.translation as { text?: string }).text ?? "")
            : w.translation,
      });
    }
  }

  if (all.length === 0) return null;
  const map = new Map<number, LineWord[]>();
  for (const word of all) {
    if (!map.has(word.line_number)) map.set(word.line_number, []);
    map.get(word.line_number)!.push(word);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lineNum, words]) => ({ lineNum, words }));
}

async function fetchVersesByPage(
  pageNumber: number,
): Promise<{ verses: PageVerseData[] }> {
  const r = await fetch(
    `${QURAN_API}/verses/by_page/${pageNumber}?words=true&fields=text_uthmani,text_uthmani_tajweed&word_fields=text_uthmani,line_number,char_type_name,translation&per_page=50`,
  );
  if (!r.ok) throw new Error(`Failed to fetch page ${pageNumber}`);
  return r.json();
}

async function fetchVersesBySurah(
  surahNumber: number,
): Promise<{ verses: ChapterVerseData[] }> {
  const r = await fetch(
    `${QURAN_API}/verses/by_chapter/${surahNumber}?fields=text_uthmani,text_uthmani_tajweed,page_number&per_page=300`,
  );
  if (!r.ok) throw new Error(`Failed to fetch surah ${surahNumber}`);
  return r.json();
}

async function fetchAllChapters(): Promise<{ chapters: MushafChapter[] }> {
  const r = await fetch(`${QURAN_API}/chapters?language=en`);
  if (!r.ok) throw new Error("Failed to fetch chapters");
  return r.json();
}

function MushafReviewView({
  childId,
  surahId,
  surahNumber,
  surahName,
  queuePosition,
  queueTotal,
  canSkipSurah,
  nextSurahName,
  sessionReciter,
  onSessionReciterChange,
  playbackRate,
  onPlaybackRateChange,
  onClose,
  onRated,
  onSkipSurah,
}: {
  childId: string;
  surahId: number;
  surahNumber: number;
  surahName: string;
  queuePosition?: number;
  queueTotal?: number;
  canSkipSurah?: boolean;
  nextSurahName?: string | null;
  sessionReciter: Reciter;
  onSessionReciterChange: (reciter: Reciter) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  onClose: () => void;
  onRated: (quality: number) => void;
  onSkipSurah?: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [blurDuringRecitation, setBlurDuringRecitation] = useState(false);
  const [showTajweed, setShowTajweed] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [activeVerseIndex, setActiveVerseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTokenRef = useRef(0);
  const loadedVerseIndexRef = useRef<number | null>(null);
  const playbackRateRef = useRef(playbackRate);
  const sessionReciterRef = useRef(sessionReciter);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const pageContentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const playerRef = useRef<HTMLDivElement | null>(null);
  const fittedMushafContentKeyRef = useRef<string | null>(null);
  const [visibleViewportHeight, setVisibleViewportHeight] = useState<number>(
    () => (typeof window !== "undefined" ? Math.round(window.innerHeight) : 0),
  );
  const [playerHeight, setPlayerHeight] = useState(0);
  const [lockedPlayerHeight, setLockedPlayerHeight] = useState<number | null>(
    null,
  );
  const [mushafFontsReady, setMushafFontsReady] = useState(() =>
    typeof document === "undefined" ? false : !("fonts" in document),
  );
  const [isMushafFitReady, setIsMushafFitReady] = useState(false);

  const { data: chapterVersesData, isLoading: chapterLoading } = useQuery({
    queryKey: ["review-mushaf-surah", surahNumber],
    queryFn: () => fetchVersesBySurah(surahNumber),
    staleTime: Infinity,
  });

  const { data: chaptersData } = useQuery({
    queryKey: ["review-chapters"],
    queryFn: fetchAllChapters,
    staleTime: Infinity,
  });

  const chapterVerses = chapterVersesData?.verses ?? [];
  const chapters = chaptersData?.chapters ?? [];

  const pageNumbers = useMemo(
    () =>
      Array.from(
        new Set(
          chapterVerses
            .map((v) => v.page_number)
            .filter((p): p is number => typeof p === "number"),
        ),
      ),
    [chapterVerses],
  );

  const { data: pageBundlesData, isLoading: pagesLoading } = useQuery({
    queryKey: ["review-mushaf-pages", surahNumber, pageNumbers.join(",")],
    queryFn: async () =>
      Promise.all(
        pageNumbers.map(async (pageNumber) => ({
          pageNumber,
          verses: (await fetchVersesByPage(pageNumber)).verses,
        })),
      ),
    enabled: pageNumbers.length > 0,
    staleTime: Infinity,
  });

  const verses = chapterVerses;
  const activeVerse = verses[activeVerseIndex] ?? null;
  const activeVerseNumber = activeVerse?.verse_number ?? 1;
  const activeVerseKey = activeVerse?.verse_key ?? `${surahNumber}:1`;
  const activePageNumber = activeVerse?.page_number ?? pageNumbers[0] ?? 0;
  const fontFamily = BAYAAN_MUSHAF_TEXT;
  const queueLabel =
    queueTotal && queueTotal > 1 && queuePosition
      ? `${queuePosition} of ${queueTotal}`
      : null;
  const shouldPromptRatingOnNext =
    !!canSkipSurah &&
    !!queueTotal &&
    queueTotal > 1 &&
    verses.length > 0 &&
    activeVerseIndex >= verses.length - 1;

  const tajweedWordsByVerse = useMemo(
    () =>
      new Map<string, string[]>(
        chapterVerses.map((verse) => [
          verse.verse_key,
          splitTajweedIntoWords(
            stripVerseEndHtml(verse.text_uthmani_tajweed ?? ""),
          ),
        ]),
      ),
    [chapterVerses],
  );

  const plainWordCountByVerse = useMemo(
    () =>
      new Map<string, number>(
        chapterVerses.map((verse) => [
          verse.verse_key,
          verse.text_uthmani.split(/\s+/).filter(Boolean).length,
        ]),
      ),
    [chapterVerses],
  );

  const verseIndexByNumber = useMemo(
    () =>
      new Map<number, number>(
        chapterVerses.map((verse, index) => [verse.verse_number, index]),
      ),
    [chapterVerses],
  );

  const pageBundles = useMemo(
    () =>
      (pageBundlesData ?? []).map((bundle) => ({
        pageNumber: bundle.pageNumber,
        verses: bundle.verses,
        lineGroups: buildLineGroups(bundle.verses),
      })),
    [pageBundlesData],
  );
  const mushafFitContentKey = useMemo(
    () =>
      [
        surahId,
        showTajweed ? "tajweed" : "plain",
        pageBundles
          .map((bundle) => `${bundle.pageNumber}:${bundle.verses.length}`)
          .join(","),
      ].join("|"),
    [surahId, showTajweed, pageBundles],
  );
  const isSinglePageLayout = pageBundles.length <= 1;
  const canRunStableMushafFit =
    mushafFontsReady && playerHeight > 0 && pageBundles.length > 0;
  const isMushafContentVisible = canRunStableMushafFit && isMushafFitReady;
  const effectivePlayerHeight = lockedPlayerHeight ?? playerHeight;
  const fallbackPlayerBottomOffset = 12;
  const fallbackBottomNavHeight = 0;
  const fallbackBottomChrome = 24;
  const reservedBottomSpace =
    effectivePlayerHeight > 0
      ? effectivePlayerHeight + fallbackPlayerBottomOffset + 8
      : effectivePlayerHeight +
        fallbackPlayerBottomOffset +
        fallbackBottomNavHeight +
        fallbackBottomChrome;
  const hasMeasuredPlayerFrame = effectivePlayerHeight > 0;
  const settingsSheetBottomSpace = reservedBottomSpace + 12;
  const settingsSheetMaxHeight =
    visibleViewportHeight > 0
      ? `${Math.max(260, visibleViewportHeight - settingsSheetBottomSpace - 16)}px`
      : "min(70vh, 520px)";
  const pageBottomPadding = hasMeasuredPlayerFrame
    ? `${reservedBottomSpace}px`
    : `calc(${reservedBottomSpace}px + env(safe-area-inset-bottom, 0px))`;
  const settingsSheetBottom = hasMeasuredPlayerFrame
    ? `${settingsSheetBottomSpace}px`
    : `calc(${settingsSheetBottomSpace}px + env(safe-area-inset-bottom, 0px))`;

  function clearAudio() {
    playbackTokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
    loadedVerseIndexRef.current = null;
    setIsPlaying(false);
    setIsLoadingAudio(false);
  }

  async function playFromIndex(index: number) {
    const verse = verses[index];
    if (!verse) return;

    playbackTokenRef.current += 1;
    const token = playbackTokenRef.current;
    const audio = audioRef.current ?? new Audio();
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.currentTime = 0;
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.src = buildAudioUrl(
      sessionReciterRef.current,
      surahNumber,
      verse.verse_number,
    );
    audio.load();
    audio.playbackRate = playbackRateRef.current;
    audioRef.current = audio;
    loadedVerseIndexRef.current = index;
    setActiveVerseIndex(index);
    setIsPlaying(false);
    setIsLoadingAudio(true);

    audio.onended = () => {
      if (playbackTokenRef.current !== token) return;
      if (index < verses.length - 1) {
        void playFromIndex(index + 1);
      } else {
        setIsPlaying(false);
        setIsLoadingAudio(false);
      }
    };

    audio.onerror = () => {
      if (playbackTokenRef.current !== token) return;
      setIsPlaying(false);
      setIsLoadingAudio(false);
    };

    try {
      await audio.play();
      if (playbackTokenRef.current !== token) {
        return;
      }
      setIsPlaying(true);
      setIsLoadingAudio(false);
    } catch {
      if (playbackTokenRef.current !== token) return;
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  }

  async function handlePlayPause() {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (
      audioRef.current &&
      loadedVerseIndexRef.current === activeVerseIndex &&
      (!Number.isFinite(audioRef.current.duration) ||
        audioRef.current.currentTime <
          Math.max(0, audioRef.current.duration - 0.05))
    ) {
      try {
        audioRef.current.playbackRate = playbackRateRef.current;
        setIsLoadingAudio(true);
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      } finally {
        setIsLoadingAudio(false);
      }
      return;
    }

    await playFromIndex(activeVerseIndex);
  }

  function handleJumpToIndex(index: number) {
    if (index < 0 || index >= verses.length) return;
    void playFromIndex(index);
  }

  useEffect(() => {
    return () => {
      clearAudio();
    };
  }, []);

  useEffect(() => {
    clearAudio();
    setActiveVerseIndex(0);
    setRating(null);
    setBlurDuringRecitation(false);
    setShowTajweed(false);
    setShowSettingsPanel(false);
    setShowRatingSheet(false);
  }, [surahId]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    sessionReciterRef.current = sessionReciter;
    clearAudio();
  }, [sessionReciter.id]);

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
    setLockedPlayerHeight(null);
    setIsMushafFitReady(false);
    for (const el of Object.values(pageContentRefs.current)) {
      if (!el) continue;
      el.style.fontSize = "";
    }
  }, [mushafFitContentKey]);

  useEffect(() => {
    if (isSinglePageLayout || !scrollRootRef.current) return;
    const node = scrollRootRef.current.querySelector<HTMLElement>(
      `[data-review-ayah="${activeVerseKey}"]`,
    );
    if (node) {
      node.scrollIntoView({
        behavior: isPlaying ? "smooth" : "auto",
        block: "center",
      });
    }
  }, [activeVerseKey, isPlaying, isSinglePageLayout]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewportMetrics = () => {
      setVisibleViewportHeight(Math.round(window.innerHeight));
      const playerRect = playerRef.current?.getBoundingClientRect();
      setPlayerHeight(playerRect ? Math.round(playerRect.height) : 0);
    };

    updateViewportMetrics();

    window.addEventListener("resize", updateViewportMetrics);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateViewportMetrics())
        : null;

    if (resizeObserver && playerRef.current) {
      resizeObserver.observe(playerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
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
      for (const bundle of pageBundles) {
        const el = pageContentRefs.current[bundle.pageNumber];
        if (!el) return null;
        const clientWidth = Math.round(el.clientWidth);
        const clientHeight = Math.round(el.clientHeight);
        const scrollWidth = Math.round(el.scrollWidth);
        const scrollHeight = Math.round(el.scrollHeight);
        if (clientWidth <= 0 || clientHeight <= 0) return null;
        parts.push(
          [
            bundle.pageNumber,
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
        for (const bundle of pageBundles) {
          const el = pageContentRefs.current[bundle.pageNumber];
          if (!el) continue;
          const availableHeight = Math.max(
            320,
            el.clientHeight - (isSinglePageLayout ? 8 : 4),
          );
          let lo = isSinglePageLayout ? 0.72 : 0.62;
          let hi = isSinglePageLayout ? 1.56 : 1.08;
          let best = lo;
          for (let i = 0; i < 28; i++) {
            const mid = (lo + hi) / 2;
            el.style.fontSize = mid + "em";
            const fitsHeight = el.scrollHeight <= availableHeight - 2;
            const fitsWidth = el.scrollWidth <= el.clientWidth + 2;
            if (fitsHeight && fitsWidth) {
              best = mid;
              lo = mid;
            } else {
              hi = mid;
            }
          }
          el.style.fontSize = best + "em";
        }
        if (!cancelled) {
          const measuredPlayerHeight = Math.round(
            playerRef.current?.getBoundingClientRect().height ?? playerHeight,
          );
          setLockedPlayerHeight((current) => {
            if (
              current !== null &&
              Math.abs(current - measuredPlayerHeight) <= 3
            ) {
              return current;
            }
            return measuredPlayerHeight > 0 ? measuredPlayerHeight : current;
          });
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
    pageBundles,
    isSinglePageLayout,
  ]);

  const isLoading = chapterLoading || pagesLoading;

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{
        background: `linear-gradient(to bottom, ${BAYAAN_PAGE_THEME.screenTint}, ${BAYAAN_PAGE_THEME.screen})`,
        color: BAYAAN_PAGE_THEME.screenText,
        overscrollBehavior: "none",
      }}
    >
      <style>{TAJWEED_CSS}</style>
      <div
        className="z-30 flex-none px-4 pt-2 pb-1.5"
        style={{
          background: `linear-gradient(to bottom, ${BAYAAN_PAGE_THEME.screenTint}, rgba(247, 242, 231, 0.64), transparent)`,
        }}
      >
        <div className="max-w-3xl mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full shadow-[0_10px_26px_rgba(89,72,32,0.12)]"
            style={{
              border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
              background: "rgba(255, 252, 245, 0.92)",
              color: BAYAAN_PAGE_THEME.screenText,
            }}
            aria-label="Back to review"
          >
            <ChevronLeft size={17} />
          </button>

          <div className="flex justify-center">
            <div className="px-2 text-center">
              <p
                className="truncate text-lg font-bold leading-none"
                style={{ color: BAYAAN_PAGE_THEME.screenText }}
              >
                {surahName}
              </p>
              {activePageNumber > 0 && (
                <p
                  className="mt-0.5 text-[11px]"
                  style={{ color: BAYAAN_PAGE_THEME.chromeMuted }}
                >
                  Page {activePageNumber}
                  {queueLabel ? ` • ${queueLabel}` : ""}
                </p>
              )}
              {activePageNumber <= 0 && queueLabel && (
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: BAYAAN_PAGE_THEME.chromeMuted }}
                >
                  {queueLabel}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsPanel(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full shadow-[0_10px_26px_rgba(89,72,32,0.12)]"
            style={{
              border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
              background: "rgba(255, 252, 245, 0.92)",
              color: BAYAAN_PAGE_THEME.screenText,
            }}
            aria-label="Open mushaf settings"
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div
          className="mx-auto flex h-full max-w-3xl flex-col px-4 pt-2"
          style={{
            paddingBottom: pageBottomPadding,
          }}
        >
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-5 space-y-3">
                    {Array.from({ length: 9 }, (_, idx) => (
                      <Skeleton key={idx} className="h-8 rounded-xl" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div
              ref={scrollRootRef}
              className={cn(
                "flex-1 min-h-0",
                isSinglePageLayout
                  ? "flex items-stretch justify-center overflow-hidden"
                  : "space-y-5 overflow-y-auto pr-1",
              )}
              style={
                !isSinglePageLayout
                  ? { WebkitOverflowScrolling: "touch" }
                  : undefined
              }
            >
              {pageBundles.map((bundle) => {
                const pageTargetVerses = bundle.verses.filter((verse) => {
                  const [verseSurah] = verse.verse_key.split(":").map(Number);
                  return verseSurah === surahNumber;
                });
                const pageSurahNames = getArabicSurahNamesForPage(
                  bundle.verses,
                  chapters,
                );
                const lineGroups = bundle.lineGroups;
                const surahsStartingOnPage = new Set<number>();
                for (const verse of bundle.verses) {
                  const [verseSurah, verseNum] = verse.verse_key
                    .split(":")
                    .map(Number);
                  if (verseNum === 1) surahsStartingOnPage.add(verseSurah);
                }

                return (
                  <div
                    key={bundle.pageNumber}
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
                          fontFamily:
                            '"Scheherazade New", "Amiri Quran", serif',
                          fontSize: "1.05em",
                          letterSpacing: 0,
                        }}
                      >
                        {pageSurahNames}
                      </span>
                      <span className="shrink-0 tracking-[0.22em]">
                        JUZ {getJuzForPage(bundle.pageNumber)}
                      </span>
                    </div>

                    <div
                      className="mushaf-page"
                      ref={(node) => {
                        pageContentRefs.current[bundle.pageNumber] = node;
                      }}
                      dir="rtl"
                      lang="ar"
                      style={{
                        fontFamily,
                        fontSize: "clamp(14px, 2.2vh, 28px)",
                        lineHeight: 1.98,
                        padding: isSinglePageLayout
                          ? "8px 10px 2px"
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
                        visibility: isMushafContentVisible
                          ? "visible"
                          : "hidden",
                      }}
                    >
                      {lineGroups ? (
                        (() => {
                          const nodes: React.ReactNode[] = [];
                          const seenSurahIds = new Set<number>();

                          for (const { lineNum, words: lws } of lineGroups) {
                            const newSurahs: number[] = [];
                            for (const lw of lws) {
                              if (!seenSurahIds.has(lw.surahId)) {
                                seenSurahIds.add(lw.surahId);
                                newSurahs.push(lw.surahId);
                              }
                            }

                            for (const sid of newSurahs) {
                              if (!surahsStartingOnPage.has(sid)) continue;
                              const chapter = chapters.find(
                                (c) => c.id === sid,
                              );
                              const isCurrentSurah = sid === surahNumber;
                              nodes.push(
                                <div
                                  key={`hdr-${bundle.pageNumber}-${sid}`}
                                  style={{
                                    textAlign: "center",
                                    margin: "0.1em 0 0.18em",
                                    direction: "rtl",
                                    opacity: isCurrentSurah ? 1 : 0.18,
                                  }}
                                >
                                  <BayaanSurahBanner
                                    surahNumber={sid}
                                    surahName={
                                      chapter?.name_arabic ?? `سُورَة ${sid}`
                                    }
                                  />
                                  {sid !== 9 && (
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "center",
                                        margin: "0.02em 0 0.18em",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontFamily: BAYAAN_MUSHAF_TEXT,
                                          fontSize: "1.16em",
                                          color: BAYAAN_PAGE_THEME.pageLabel,
                                          direction: "rtl",
                                          lineHeight: 1.2,
                                          fontFeatureSettings: '"basm" 1',
                                        }}
                                      >
                                        {BAYAAN_BASMALLAH}
                                      </span>
                                    </div>
                                  )}
                                </div>,
                              );
                            }

                            nodes.push(
                              <div
                                key={`ln-${bundle.pageNumber}-${lineNum}`}
                                style={{
                                  display: "flex",
                                  direction: "rtl",
                                  justifyContent: "center",
                                  alignItems: "center",
                                  flexWrap: "nowrap",
                                  lineHeight: 1.98,
                                  padding: isSinglePageLayout
                                    ? "0 0.5px"
                                    : "0 2px",
                                  width: "100%",
                                  gap: isSinglePageLayout ? "0.07em" : "0.18em",
                                }}
                              >
                                {lws.map((lw) => {
                                  const isTargetSurah =
                                    lw.surahId === surahNumber;
                                  const isActiveAyah =
                                    isTargetSurah &&
                                    lw.verseNum === activeVerseNumber;
                                  const shouldBlur = blurDuringRecitation
                                    ? isTargetSurah
                                      ? !isPlaying || !isActiveAyah
                                      : true
                                    : false;
                                  const verseOpacity = isTargetSurah
                                    ? shouldBlur
                                      ? 0.38
                                      : isActiveAyah
                                        ? 1
                                        : 0.97
                                    : shouldBlur
                                      ? 0.06
                                      : 0.16;
                                  const clickIndex = verseIndexByNumber.get(
                                    lw.verseNum,
                                  );
                                  const clickable =
                                    isTargetSurah && clickIndex !== undefined;

                                  if (lw.char_type_name === "end") {
                                    return (
                                      <span
                                        key={`${lw.verse_key}:${lw.position}`}
                                        data-review-ayah={lw.verse_key}
                                        onClick={() =>
                                          clickable &&
                                          handleJumpToIndex(clickIndex)
                                        }
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: "1.84em",
                                          height: "1.84em",
                                          borderRadius: "50%",
                                          border: `1.5px solid ${isActiveAyah ? BAYAAN_PAGE_THEME.activeMarker : BAYAAN_PAGE_THEME.markerBorder}`,
                                          background: isActiveAyah
                                            ? BAYAAN_PAGE_THEME.activeMarkerBg
                                            : BAYAAN_PAGE_THEME.markerSurface,
                                          flexShrink: 0,
                                          userSelect: "none",
                                          direction: "ltr",
                                          cursor: clickable
                                            ? "pointer"
                                            : "default",
                                          opacity: verseOpacity,
                                          filter: shouldBlur
                                            ? "blur(4px)"
                                            : "none",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "0.58em",
                                            color: isActiveAyah
                                              ? BAYAAN_PAGE_THEME.activeMarker
                                              : BAYAAN_PAGE_THEME.markerText,
                                            fontFamily: "Georgia, serif",
                                            lineHeight: 1,
                                          }}
                                        >
                                          {lw.verseNum}
                                        </span>
                                      </span>
                                    );
                                  }

                                  const tajweedWords =
                                    tajweedWordsByVerse.get(lw.verse_key) ?? [];
                                  const hasValidTajweed =
                                    showTajweed &&
                                    tajweedWords.length ===
                                      (plainWordCountByVerse.get(
                                        lw.verse_key,
                                      ) ?? 0);
                                  const wordMarkup =
                                    hasValidTajweed &&
                                    lw.wordIdxInVerse >= 0 ? (
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html:
                                            tajweedWords[lw.wordIdxInVerse] ??
                                            lw.text_uthmani,
                                        }}
                                      />
                                    ) : (
                                      <>{lw.text_uthmani}</>
                                    );

                                  return (
                                    <span
                                      key={`${lw.verse_key}:${lw.position}`}
                                      data-review-ayah={lw.verse_key}
                                      onClick={() =>
                                        clickable &&
                                        handleJumpToIndex(clickIndex)
                                      }
                                      className={cn(
                                        "inline-block rounded-sm transition-all duration-150",
                                        clickable && "cursor-pointer",
                                      )}
                                      style={{
                                        opacity: verseOpacity,
                                        filter: shouldBlur
                                          ? "blur(6px)"
                                          : "none",
                                        userSelect: shouldBlur
                                          ? "none"
                                          : "text",
                                        padding: "0 0.03em",
                                        background: isActiveAyah
                                          ? BAYAAN_PAGE_THEME.activeHighlight
                                          : "transparent",
                                        color: isActiveAyah
                                          ? BAYAAN_PAGE_THEME.pageText
                                          : undefined,
                                      }}
                                    >
                                      {wordMarkup}
                                    </span>
                                  );
                                })}
                              </div>,
                            );
                          }
                          return nodes;
                        })()
                      ) : (
                        <div className="space-y-4 py-4">
                          {pageTargetVerses.map((verse) => {
                            const verseNum = parseInt(
                              verse.verse_key.split(":")[1],
                              10,
                            );
                            const isActiveAyah = verseNum === activeVerseNumber;
                            const clickIndex = verseIndexByNumber.get(verseNum);
                            const shouldBlur =
                              blurDuringRecitation &&
                              (!isPlaying || !isActiveAyah);
                            return (
                              <div
                                key={verse.verse_key}
                                data-review-ayah={verse.verse_key}
                                onClick={() =>
                                  clickIndex !== undefined &&
                                  handleJumpToIndex(clickIndex)
                                }
                                className="rounded-2xl px-4 py-3"
                                style={{
                                  cursor:
                                    clickIndex !== undefined
                                      ? "pointer"
                                      : "default",
                                  background: isActiveAyah
                                    ? BAYAAN_PAGE_THEME.activeHighlight
                                    : "transparent",
                                }}
                              >
                                <p
                                  style={{
                                    filter: shouldBlur ? "blur(6px)" : "none",
                                    opacity: shouldBlur ? 0.5 : 1,
                                  }}
                                >
                                  {verse.text_uthmani}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div
                      className="py-1.5 text-center text-[11px] tracking-[0.24em]"
                      style={{
                        borderTop: `1px solid ${BAYAAN_PAGE_THEME.pageBorder}`,
                        color: BAYAAN_PAGE_THEME.pageLabel,
                      }}
                    >
                      {bundle.pageNumber}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed inset-x-0 z-[60] px-4 pointer-events-none"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
        }}
      >
        <div
          ref={playerRef}
          className="mx-auto w-full max-w-md pointer-events-auto"
        >
          <Card className="border-white/10 bg-[#0d1016]/92 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full px-3 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setShowSettingsPanel(true)}
                >
                  <Settings2 size={14} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full px-3 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  disabled={activeVerseIndex <= 0 || verses.length === 0}
                  onClick={() => handleJumpToIndex(activeVerseIndex - 1)}
                >
                  <SkipBack size={14} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={verses.length === 0 || isLoadingAudio}
                  onClick={() => void handlePlayPause()}
                >
                  {isPlaying ? (
                    <Pause size={14} className="mr-1" />
                  ) : (
                    <Play size={14} className="mr-1" />
                  )}
                  {isPlaying ? "Pause" : isLoadingAudio ? "Loading..." : "Play"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full px-3 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  disabled={
                    (!shouldPromptRatingOnNext &&
                      activeVerseIndex >= verses.length - 1) ||
                    verses.length === 0
                  }
                  onClick={() =>
                    shouldPromptRatingOnNext
                      ? setShowRatingSheet(true)
                      : handleJumpToIndex(activeVerseIndex + 1)
                  }
                >
                  <SkipForward size={14} />
                </Button>
              </div>
              <div className="mt-1 flex flex-col items-center gap-1 text-center">
                <p className="text-[11px] text-white/74">
                  When you finish reciting, tap Finish &amp; Rate.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 w-full max-w-[240px] rounded-full bg-white px-4 text-[12px] font-semibold text-[#0d1016] shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:bg-white/90"
                  onClick={() => setShowRatingSheet(true)}
                >
                  <CheckCircle size={14} className="mr-1.5" />
                  Finish &amp; Rate
                </Button>
                <span className="block text-[10px] font-medium text-white/45">
                  {activePageNumber > 0 ? `${activePageNumber}` : "Ready"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showSettingsPanel && (
        <div
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal="true"
          aria-label="Mushaf settings"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSettingsPanel(false)}
          />
          <div
            className="absolute inset-x-0 flex justify-center px-3 pointer-events-none"
            style={{
              bottom: settingsSheetBottom,
            }}
          >
            <div
              className="pointer-events-auto mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl"
              style={{ maxHeight: settingsSheetMaxHeight }}
            >
              <div className="flex-none px-4 pb-3 pt-4 text-foreground">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      Mushaf Settings
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Keep the reading surface calm and uncluttered.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSettingsPanel(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div
                className="space-y-3 overflow-y-auto px-4 pb-6"
                style={{
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  paddingBottom:
                    "calc(24px + env(safe-area-inset-bottom, 0px))",
                }}
              >
                <label className="space-y-1 block">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Reciter
                  </span>
                  <select
                    value={sessionReciter.id}
                    onChange={(e) =>
                      onSessionReciterChange(
                        RECITERS.find((r) => r.id === e.target.value)!,
                      )
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground"
                  >
                    {RECITERS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Speed
                  </span>
                  <select
                    value={String(playbackRate)}
                    onChange={(e) =>
                      onPlaybackRateChange(parseFloat(e.target.value))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground"
                  >
                    <option value="1">1.0x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="1.75">1.75x</option>
                    <option value="2">2.0x</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Text
                  </span>
                  <select
                    value={showTajweed ? "tajweed" : "plain"}
                    onChange={(e) =>
                      setShowTajweed(e.target.value === "tajweed")
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground"
                  >
                    <option value="plain">Plain</option>
                    <option value="tajweed">Tajweed</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-border/80 bg-muted/25 px-3 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Layout
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Bayaan-style mushaf
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Digital Khatt text with QCF surah headers is fixed in review
                    mode.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <Button
                    type="button"
                    variant={blurDuringRecitation ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setBlurDuringRecitation((prev) => !prev)}
                  >
                    {blurDuringRecitation ? (
                      <EyeOff size={14} className="mr-1" />
                    ) : (
                      <Eye size={14} className="mr-1" />
                    )}
                    {blurDuringRecitation ? "Blur On" : "Blur Off"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRatingSheet && (
        <div
          className="fixed inset-0 z-[80]"
          role="dialog"
          aria-modal="true"
          aria-label="Review rating"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowRatingSheet(false)}
          />
          <div
            className="absolute inset-x-0 flex justify-center px-3 pointer-events-none"
            style={{
              bottom: settingsSheetBottom,
            }}
          >
            <div
              className="pointer-events-auto mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl"
              style={{ maxHeight: settingsSheetMaxHeight }}
            >
              <div className="flex-none px-4 pb-3 pt-4 text-foreground">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      How did you do?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rate the recitation without leaving the mushaf.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRatingSheet(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div
                className="overflow-y-auto px-4 pb-6"
                style={{
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  paddingBottom:
                    "calc(24px + env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="mb-4 space-y-2">
                  {[0, 1, 2, 3, 4, 5].map((q) => (
                    <button
                      key={q}
                      onClick={() => setRating(q)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border ${
                        rating === q
                          ? "border-primary bg-primary/5 scale-[1.01]"
                          : "border-transparent hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          rating === q
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {q}
                      </div>
                      <span
                        className={`text-xs ${QUALITY_COLORS[q]} px-2 py-0.5 rounded-full`}
                      >
                        {QUALITY_LABELS[q]}
                      </span>
                    </button>
                  ))}
                </div>

                {canSkipSurah && onSkipSurah && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="mb-2 w-full rounded-full"
                      onClick={() => {
                        setShowRatingSheet(false);
                        setRating(null);
                        onSkipSurah();
                      }}
                    >
                      <SkipForward size={14} className="mr-1" />
                      Skip This Surah
                    </Button>
                    {nextSurahName && (
                      <p className="mb-3 text-center text-[11px] text-muted-foreground">
                        This keeps {surahName} pending and moves on to{" "}
                        {nextSurahName}.
                      </p>
                    )}
                  </>
                )}

                <Button
                  className="w-full rounded-full"
                  disabled={rating === null}
                  onClick={() => {
                    if (rating === null) return;
                    setShowRatingSheet(false);
                    onRated(rating);
                  }}
                >
                  <CheckCircle size={14} className="mr-1" /> Submit Review
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Review page ─────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { childId } = useParams<{ childId: string }>();

  const getTodayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const SESSION_KEY = `child-${childId}-review-session`;

  const loadSession = () => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed.date !== getTodayLocal()) return null;
      return parsed;
    } catch {
      return null;
    }
  };
  const storedSession = loadSession();

  const [mushafItem, setMushafItem] = useState<ReviewMushafItem | null>(null);
  const [mushafBatch, setMushafBatch] = useState<ReviewMushafItem[]>([]);
  const [mushafBatchIndex, setMushafBatchIndex] = useState<number | null>(null);
  const [selectedMushafSurahIds, setSelectedMushafSurahIds] = useState<
    number[]
  >([]);
  const [flashcardIndex, setFlashcardIndex] = useState<number | null>(null);
  const [flashcardRating, setFlashcardRating] = useState<number | null>(null);
  const [flashcardShowVerses, setFlashcardShowVerses] = useState(false);
  const [sessionDone, setSessionDone] = useState<boolean>(
    storedSession?.sessionDone ?? false,
  );
  const [showReviewCelebration, setShowReviewCelebration] = useState(false);
  const [completedCount, setCompletedCount] = useState<number>(
    storedSession?.completedItemsData?.length ?? 0,
  );
  const [completedSurahIds, setCompletedSurahIds] = useState<Set<number>>(
    new Set(
      storedSession?.completedItemsData?.map((i: any) => i.surahId) ?? [],
    ),
  );
  const [sessionReciter, setSessionReciter] = useState<Reciter>(
    () => RECITERS.find((r) => r.id === "husary")!,
  );
  const [sessionPlaybackRate, setSessionPlaybackRate] = useState(1);
  const [completedItemsData, setCompletedItemsData] = useState<
    Array<{ surahId: number; surahName?: string | null; surahNumber: number }>
  >(storedSession?.completedItemsData ?? []);
  const sessionTotalRef = useRef<number>(storedSession?.sessionTotal ?? 0);
  const sessionSurahsRef = useRef<typeof dueToday | null>(
    storedSession?.sessionSurahs ?? null,
  );
  const dueTodayRef = useRef<
    { surahId: number; surahName?: string | null; surahNumber: number }[]
  >([]);
  const qc = useQueryClient();

  const saveSession = (updates: {
    sessionDone?: boolean;
    completedItemsData?: Array<{
      surahId: number;
      surahName?: string | null;
      surahNumber: number;
    }>;
    sessionSurahs?: typeof dueToday;
    sessionTotal?: number;
  }) => {
    try {
      const current = (() => {
        try {
          return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
        } catch {
          return {};
        }
      })();
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...current,
          date: getTodayLocal(),
          ...updates,
        }),
      );
    } catch {}
  };

  const syncReviewDailyProgress = (body: {
    reviewStatus?: "not_started" | "in_progress" | "completed";
    reviewCompletedCount?: number;
    reviewTargetCount?: number;
  }) => {
    fetch(`/api/children/${childId}/daily-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(() => qc.invalidateQueries({ queryKey: ["dashboard", childId] }))
      .catch(() => {});
  };

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", childId],
    queryFn: () => listReviews(parseInt(childId)),
  });

  const { data: dashData } = useQuery({
    queryKey: ["dashboard", childId],
    queryFn: () => getChildDashboard(parseInt(childId)),
    staleTime: 30_000,
  });
  const todayProgress = (dashData as any)?.todayProgress;

  const dueToday = data?.dueToday ?? [];
  dueTodayRef.current = dueToday;

  // Freeze session list on first load — never changes during the session regardless of refetches
  if (data && sessionSurahsRef.current === null && dueToday.length > 0) {
    sessionSurahsRef.current = dueToday;
    sessionTotalRef.current = dueToday.length;
    saveSession({ sessionSurahs: dueToday, sessionTotal: dueToday.length });
  }
  const sessionSurahs = sessionSurahsRef.current ?? dueToday;

  useEffect(() => {
    if (!data) return;
    const sessionTotal = sessionTotalRef.current;
    if (sessionTotal <= 0) return;
    const reviewStatus =
      sessionDone || completedCount >= sessionTotal
        ? "completed"
        : completedCount > 0
          ? "in_progress"
          : "not_started";
    syncReviewDailyProgress({
      reviewStatus,
      reviewCompletedCount: completedCount,
      reviewTargetCount: sessionTotal,
    });
  }, [data, completedCount, sessionDone]);

  // Fetch current flashcard surah if in flashcard mode
  const flashcardItem =
    flashcardIndex !== null ? sessionSurahs[flashcardIndex] : null;
  const { data: flashcardSurahData } = useQuery({
    queryKey: ["surah", flashcardItem?.surahId],
    queryFn: () => getSurah(flashcardItem!.surahId),
    enabled: !!flashcardItem,
  });
  const pendingItems: ReviewSessionItem[] = useMemo(
    () =>
      sessionSurahs.filter(
        (item: ReviewSessionItem) => !completedSurahIds.has(item.surahId),
      ),
    [sessionSurahs, completedSurahIds],
  );
  const hasMushafBatchSelection = selectedMushafSurahIds.length > 0;
  const selectedMushafPendingIndices = useMemo(
    () =>
      pendingItems.reduce<number[]>((acc, item, index) => {
        if (selectedMushafSurahIds.includes(item.surahId)) {
          acc.push(index);
        }
        return acc;
      }, []),
    [pendingItems, selectedMushafSurahIds],
  );
  const selectedMushafBatchStartIndex = selectedMushafPendingIndices[0] ?? null;
  const selectedMushafBatchEndIndex =
    selectedMushafPendingIndices[selectedMushafPendingIndices.length - 1] ??
    null;
  const selectedMushafBatchItems = useMemo(
    () =>
      sortReviewItemsForMushaf(
        pendingItems.filter((item: ReviewSessionItem) =>
          selectedMushafSurahIds.includes(item.surahId),
        ),
      ),
    [pendingItems, selectedMushafSurahIds],
  );
  const selectedMushafBatchStartItem = selectedMushafBatchItems[0] ?? null;
  const mushafBatchNeighborIndices = useMemo(() => {
    const indices = new Set<number>();
    if (
      selectedMushafBatchStartIndex === null ||
      selectedMushafBatchEndIndex === null
    ) {
      return indices;
    }
    if (selectedMushafBatchStartIndex > 0) {
      indices.add(selectedMushafBatchStartIndex - 1);
    }
    if (selectedMushafBatchEndIndex < pendingItems.length - 1) {
      indices.add(selectedMushafBatchEndIndex + 1);
    }
    return indices;
  }, [
    pendingItems.length,
    selectedMushafBatchEndIndex,
    selectedMushafBatchStartIndex,
  ]);
  const currentMushafItem =
    mushafBatchIndex !== null
      ? (mushafBatch[mushafBatchIndex] ?? null)
      : mushafItem;
  const currentMushafNextItem =
    mushafBatchIndex !== null
      ? (mushafBatch[mushafBatchIndex + 1] ?? null)
      : null;
  const currentMushafQueueTotal =
    mushafBatchIndex !== null ? mushafBatch.length : undefined;
  const currentMushafQueuePosition =
    mushafBatchIndex !== null ? mushafBatchIndex + 1 : undefined;

  const buildMushafItem = (item: ReviewSessionItem): ReviewMushafItem => ({
    surahId: item.surahId,
    surahNumber: item.surahNumber,
    surahName: item.surahName ?? "",
    reviewItemId: item.id,
  });

  const closeMushafView = () => {
    setMushafItem(null);
    setMushafBatch([]);
    setMushafBatchIndex(null);
  };

  const startSingleMushaf = (item: ReviewSessionItem) => {
    setSelectedMushafSurahIds([]);
    setMushafBatch([]);
    setMushafBatchIndex(null);
    setMushafItem(buildMushafItem(item));
  };

  const toggleMushafBatchSelection = (itemIndex: number) => {
    const item = pendingItems[itemIndex];
    if (!item) return;

    setSelectedMushafSurahIds((prev) => {
      const orderedSelectedIndices = pendingItems.reduce<number[]>(
        (acc, pendingItem, pendingIndex) => {
          if (prev.includes(pendingItem.surahId)) {
            acc.push(pendingIndex);
          }
          return acc;
        },
        [],
      );
      const isSelected = prev.includes(item.surahId);

      if (orderedSelectedIndices.length === 0) {
        return [item.surahId];
      }

      const firstIndex = orderedSelectedIndices[0];
      const lastIndex =
        orderedSelectedIndices[orderedSelectedIndices.length - 1];

      if (isSelected) {
        if (orderedSelectedIndices.length === 1) {
          return [];
        }
        if (itemIndex === firstIndex) {
          return pendingItems
            .slice(firstIndex + 1, lastIndex + 1)
            .map((pendingItem) => pendingItem.surahId);
        }
        if (itemIndex === lastIndex) {
          return pendingItems
            .slice(firstIndex, lastIndex)
            .map((pendingItem) => pendingItem.surahId);
        }
        return prev;
      }

      if (itemIndex === firstIndex - 1 || itemIndex === lastIndex + 1) {
        return pendingItems
          .slice(
            Math.min(itemIndex, firstIndex),
            Math.max(itemIndex, lastIndex) + 1,
          )
          .map((pendingItem) => pendingItem.surahId);
      }

      return prev;
    });
  };

  const startMushafBatch = (items: ReviewSessionItem[]) => {
    const queue = sortReviewItemsForMushaf(items).map(buildMushafItem);
    if (queue.length === 0) return;
    setMushafItem(null);
    setMushafBatch(queue);
    setMushafBatchIndex(0);
    setSelectedMushafSurahIds([]);
  };

  const advanceMushafBatch = () => {
    if (mushafBatchIndex === null) {
      closeMushafView();
      return;
    }
    if (mushafBatchIndex >= mushafBatch.length - 1) {
      closeMushafView();
      return;
    }
    setMushafBatchIndex((index) => (index ?? 0) + 1);
  };

  useEffect(() => {
    const pendingIds = new Set(
      pendingItems.map((item: ReviewSessionItem) => item.surahId),
    );
    setSelectedMushafSurahIds((prev) => {
      const next =
        pendingIds.size < 2
          ? []
          : pendingItems
              .map((item: ReviewSessionItem) => item.surahId)
              .filter((id) => prev.includes(id) && pendingIds.has(id));
      return next.length === prev.length &&
        next.every((id, index) => id === prev[index])
        ? prev
        : next;
    });
  }, [pendingItems]);

  const reviewMutation = useMutation({
    mutationFn: ({ surahId, quality }: { surahId: number; quality: number }) =>
      completeReview(parseInt(childId), {
        surahId,
        qualityRating: quality,
        durationMinutes: 5,
      }),
    onSuccess: (_, variables) => {
      const completedItem = dueTodayRef.current.find(
        (i) => i.surahId === variables.surahId,
      );
      if (completedItem) {
        const newItemsData = completedItemsData.some(
          (i) => i.surahId === completedItem.surahId,
        )
          ? completedItemsData
          : [
              ...completedItemsData,
              {
                surahId: completedItem.surahId,
                surahName: completedItem.surahName,
                surahNumber: completedItem.surahNumber,
              },
            ];
        setCompletedItemsData(newItemsData);
        saveSession({ completedItemsData: newItemsData });
      }
      setCompletedSurahIds((prev) => new Set([...prev, variables.surahId]));
      qc.invalidateQueries({ queryKey: ["reviews", childId] });
      const newCount = completedCount + 1;
      setCompletedCount(newCount);
      const sessionTotal = sessionTotalRef.current;
      // Advance or finish — use sessionTotal (stable) not dueToday.length (shrinks on refetch)
      if (flashcardIndex !== null) {
        setFlashcardRating(null);
        setFlashcardShowVerses(false);
        if (newCount >= sessionTotal) {
          setSessionDone(true);
          saveSession({ sessionDone: true });
          setShowReviewCelebration(true);
          setFlashcardIndex(null);
        } else {
          setFlashcardIndex((i) => (i ?? 0) + 1);
        }
      } else if (currentMushafItem) {
        if (mushafBatchIndex !== null) {
          advanceMushafBatch();
        } else {
          setMushafItem(null);
        }
        if (newCount >= sessionTotal) {
          setSessionDone(true);
          saveSession({ sessionDone: true });
          setShowReviewCelebration(true);
        }
      }
    },
  });

  // ── Mushaf self-test view ──
  if (currentMushafItem) {
    return (
      <MushafReviewView
        childId={childId}
        surahId={currentMushafItem.surahId}
        surahNumber={currentMushafItem.surahNumber}
        surahName={currentMushafItem.surahName}
        queuePosition={currentMushafQueuePosition}
        queueTotal={currentMushafQueueTotal}
        canSkipSurah={!!currentMushafNextItem}
        nextSurahName={currentMushafNextItem?.surahName ?? null}
        sessionReciter={sessionReciter}
        onSessionReciterChange={setSessionReciter}
        playbackRate={sessionPlaybackRate}
        onPlaybackRateChange={setSessionPlaybackRate}
        onClose={closeMushafView}
        onRated={(quality) =>
          reviewMutation.mutate({ surahId: currentMushafItem.surahId, quality })
        }
        onSkipSurah={currentMushafNextItem ? advanceMushafBatch : undefined}
      />
    );
  }

  // ── Flashcard view (single surah) ──
  if (flashcardIndex !== null && flashcardItem) {
    const verses = flashcardSurahData?.verses ?? [];
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg text-white px-4 pt-8 pb-12">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => {
                setFlashcardIndex(null);
                setFlashcardRating(null);
                setFlashcardShowVerses(false);
              }}
              className="flex items-center gap-1 text-emerald-200 text-sm mb-4"
            >
              <ChevronLeft size={16} /> Back to Review List
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Flashcard Review</h1>
                <p className="text-emerald-200 text-sm mt-1">
                  {flashcardIndex + 1} of {sessionTotalRef.current} ·{" "}
                  {sessionTotalRef.current - flashcardIndex - 1} remaining
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
                <RefreshCw size={24} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">
          {flashcardItem.isOverdue && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-orange-600" />
                <p className="text-xs text-orange-700">
                  This surah was due on {flashcardItem.dueDate} — let's catch
                  up!
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="verse-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-lg text-foreground">
                    {flashcardItem.surahName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Surah {flashcardItem.surahNumber} · Due{" "}
                    {flashcardItem.dueDate}
                  </p>
                </div>
                <p className="arabic-text text-3xl text-primary">
                  {flashcardSurahData?.nameArabic}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 mb-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Recite this surah from memory, then rate yourself below
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full mb-3"
                onClick={() => setFlashcardShowVerses(!flashcardShowVerses)}
              >
                {flashcardShowVerses
                  ? "Hide Verses"
                  : "Show Verses (if needed)"}
              </Button>
              {flashcardShowVerses &&
                verses.map((verse) => (
                  <div
                    key={verse.number}
                    className="mb-3 pb-3 border-b border-border last:border-0"
                  >
                    <p
                      className="arabic-text text-xl text-foreground text-right mb-1"
                      dir="rtl"
                    >
                      {verse.arabic}
                    </p>
                    <p className="text-xs text-primary italic">
                      {verse.transliteration}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      "{verse.translation}"
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                How was your recitation?
              </p>
              <div className="space-y-2 mb-4">
                {[0, 1, 2, 3, 4, 5].map((q) => (
                  <button
                    key={q}
                    onClick={() => setFlashcardRating(q)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border ${
                      flashcardRating === q
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        flashcardRating === q
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {q}
                    </div>
                    <span
                      className={`text-xs ${QUALITY_COLORS[q]} px-2 py-0.5 rounded-full`}
                    >
                      {QUALITY_LABELS[q]}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={flashcardRating === null || reviewMutation.isPending}
                onClick={() =>
                  flashcardRating !== null &&
                  reviewMutation.mutate({
                    surahId: flashcardItem.surahId,
                    quality: flashcardRating,
                  })
                }
              >
                <CheckCircle size={14} className="mr-1" />
                {reviewMutation.isPending ? "Saving..." : "Submit Review"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <ChildNav childId={childId} />
      </div>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg h-40" />
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Genuinely no reviews today (not just all completed this session) ──
  if (
    !sessionDone &&
    data !== undefined &&
    sessionSurahs.length === 0 &&
    completedItemsData.length === 0
  ) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            All Caught Up!
          </h2>
          <p className="text-muted-foreground mb-2">
            No surahs due for review today. Keep memorizing!
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Consistent review is the key to strong memorization.
          </p>
          <Link href={`/child/${childId}`}>
            <Button className="w-full rounded-full">Back to Dashboard</Button>
          </Link>
        </div>
        <ChildNav childId={childId} />
      </div>
    );
  }

  // ── Default: surah card grid (also shown when sessionDone — completed rows stay visible) ──
  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="pattern-bg text-white px-4 pt-8 pb-12">
          <div className="max-w-lg mx-auto">
            <Link href={`/child/${childId}`}>
              <button className="flex items-center gap-1 text-emerald-200 text-sm mb-4">
                <ChevronLeft size={16} /> Dashboard
              </button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Review Session</h1>
                <p className="text-emerald-200 text-sm mt-1">
                  {completedCount > 0 || sessionDone
                    ? `${completedCount}/${sessionTotalRef.current} surahs done`
                    : `${sessionSurahs.length} surah${sessionSurahs.length !== 1 ? "s" : ""} due today`}
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
                <RefreshCw size={24} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-3">
          {/* Due today cards */}
          {(() => {
            return (
              <>
                {sessionDone && (
                  <Card className="border-emerald-300 bg-emerald-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl mb-1">🏆</p>
                      <p className="font-bold text-emerald-800">
                        All done for today!
                      </p>
                      <p className="text-xs text-emerald-700 mt-1">
                        Great job! Come back tomorrow for your next review.
                      </p>
                    </CardContent>
                  </Card>
                )}
                {!sessionDone && pendingItems.length > 1 && (
                  <Card className="border-border/80 bg-card shadow-sm">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            Review A Few Together
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Use the corner circles to build one connected mushaf
                            run.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 rounded-full px-3 text-xs"
                          onClick={() =>
                            setSelectedMushafSurahIds(
                              selectedMushafSurahIds.length ===
                                pendingItems.length
                                ? []
                                : pendingItems.map(
                                    (item: ReviewSessionItem) => item.surahId,
                                  ),
                            )
                          }
                        >
                          {selectedMushafSurahIds.length === pendingItems.length
                            ? "Clear All"
                            : "Select All"}
                        </Button>
                      </div>

                      {hasMushafBatchSelection ? (
                        <div className="rounded-2xl border border-primary/25 bg-primary/5 px-3 py-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">
                                {selectedMushafSurahIds.length} selected
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {selectedMushafBatchStartItem
                                  ? `Starts with ${selectedMushafBatchStartItem.surahName} and moves forward.`
                                  : "Choose at least one surah to start."}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="rounded-full"
                                onClick={() =>
                                  startMushafBatch(selectedMushafBatchItems)
                                }
                              >
                                Start Mushaf
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-full"
                                onClick={() => setSelectedMushafSurahIds([])}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground">
                          Choose the first surah, then expand the selection with
                          the neighboring cards.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {!sessionDone &&
                  pendingItems.map((item: ReviewSessionItem, pendingIndex) => {
                    const sessionIndex = sessionSurahs.indexOf(item);
                    const isSelectedForBatch = selectedMushafSurahIds.includes(
                      item.surahId,
                    );
                    const isNeighborForBatch =
                      hasMushafBatchSelection &&
                      mushafBatchNeighborIndices.has(pendingIndex);
                    const canToggleForBatch =
                      !hasMushafBatchSelection ||
                      isSelectedForBatch ||
                      isNeighborForBatch;
                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          "border-border",
                          item.isOverdue && "border-orange-200",
                          isSelectedForBatch &&
                            "border-primary bg-primary/5 shadow-sm",
                          isNeighborForBatch &&
                            "border-primary/25 bg-primary/[0.03]",
                          hasMushafBatchSelection &&
                            !canToggleForBatch &&
                            "opacity-80",
                        )}
                      >
                        <CardContent
                          className={cn(
                            "p-4",
                            hasMushafBatchSelection &&
                              canToggleForBatch &&
                              "cursor-pointer transition-colors",
                          )}
                          onClick={
                            hasMushafBatchSelection && canToggleForBatch
                              ? () => toggleMushafBatchSelection(pendingIndex)
                              : undefined
                          }
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground">
                                  {item.surahName}
                                </p>
                                {isSelectedForBatch && (
                                  <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">
                                    Selected
                                  </Badge>
                                )}
                                {isNeighborForBatch && (
                                  <Badge
                                    variant="secondary"
                                    className="border-0 text-[10px]"
                                  >
                                    Next to Select
                                  </Badge>
                                )}
                                {item.isOverdue && (
                                  <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Surah {item.surahNumber} · Due {item.dueDate}
                              </p>
                            </div>
                            <div className="flex items-start gap-2">
                              {pendingItems.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={
                                    isSelectedForBatch
                                      ? `Remove ${item.surahName} from batch`
                                      : `Add ${item.surahName} to batch`
                                  }
                                  disabled={!canToggleForBatch}
                                  className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                                    isSelectedForBatch
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : canToggleForBatch
                                        ? "border-primary/35 bg-background text-primary"
                                        : "border-border bg-muted/40 text-muted-foreground/60",
                                  )}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleMushafBatchSelection(pendingIndex);
                                  }}
                                >
                                  {isSelectedForBatch ? (
                                    <Check size={14} />
                                  ) : (
                                    <span className="h-2.5 w-2.5 rounded-full border border-current/60" />
                                  )}
                                </button>
                              )}
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                                {item.surahNumber}
                              </div>
                            </div>
                          </div>
                          {hasMushafBatchSelection ? (
                            <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                              {isSelectedForBatch
                                ? "Included in this mushaf run. Tap the edge of the selection to shrink it."
                                : isNeighborForBatch
                                  ? "Tap this card to extend the connected batch."
                                  : "Only the cards touching your current batch can be added next."}
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 text-xs"
                                onClick={() => startSingleMushaf(item)}
                              >
                                Mushaf View
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                onClick={() => setFlashcardIndex(sessionIndex)}
                              >
                                Flashcard
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                {completedItemsData.map((item) => (
                  <div
                    key={`done-${item.surahId}`}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200"
                  >
                    <CheckCircle
                      size={16}
                      className="text-emerald-500 flex-shrink-0"
                    />
                    <p className="text-sm font-medium text-emerald-800 flex-1">
                      {item.surahName}
                    </p>
                    <span className="text-xs text-emerald-600 font-medium">
                      Reviewed ✓
                    </span>
                  </div>
                ))}
              </>
            );
          })()}

          {/* Upcoming */}
          {!sessionDone && (data?.upcoming ?? []).length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-3">
                  Upcoming Reviews
                </p>
                <div className="space-y-2">
                  {(data?.upcoming ?? []).slice(0, 5).map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-foreground font-medium">
                        {item.surahName}
                      </span>
                      <Badge variant="secondary">{item.dueDate}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {sessionDone && (
            <div className="pb-2 space-y-2">
              <Button
                className="w-full rounded-full"
                variant="outline"
                onClick={() => {
                  localStorage.removeItem(SESSION_KEY);
                  setSessionDone(false);
                  setCompletedCount(0);
                  setCompletedSurahIds(new Set());
                  setCompletedItemsData([]);
                  sessionTotalRef.current = 0;
                  sessionSurahsRef.current = null;
                  qc.invalidateQueries({ queryKey: ["reviews", childId] });
                  qc.invalidateQueries({ queryKey: ["dashboard", childId] });
                }}
              >
                Next Day's Review →
              </Button>
              <Link href={`/child/${childId}`}>
                <Button className="w-full rounded-full" variant="ghost">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          )}
        </div>

        <ChildNav childId={childId} />
      </div>
      <CelebrationOverlay
        show={showReviewCelebration}
        onDone={() => setShowReviewCelebration(false)}
        message="Review Complete!"
        subMessage="Excellent revision!"
      />
    </>
  );
}
