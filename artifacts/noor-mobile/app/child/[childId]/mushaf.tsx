import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/src/lib/api";
import { ayahAudioUrl } from "@/src/lib/audio";
import {
  QURAN_COM_1405_NATIVE_HEIGHT,
  QURAN_COM_1405_NATIVE_WIDTH,
  getQuranCom1405AyahRectsForPage,
} from "@/src/lib/quran-com-1405-ayah-coords";
import {
  QURAN_COM_1405_PAGE_HEIGHT,
  QURAN_COM_1405_PAGE_WIDTH,
  getQuranCom1405PageImage,
} from "@/src/lib/quran-com-1405-page-images";
import {
  cleanTranslationHtml,
  fetchAyahTranslation,
  fetchVersesByPage,
  type ApiPageVerse,
} from "@/src/lib/quran";
import { DEFAULT_RECITER_ID, RECITERS, findReciter } from "@/src/lib/reciters";
import {
  MUSHAF_JUZS,
  MUSHAF_SURAHS,
  clampMushafPage,
  getJuzForMushafPage,
  getMushafPageForVerse,
  getMushafSurahForPage,
  searchMushafSurahs,
  TOTAL_MUSHAF_PAGES,
  type MushafJuz,
  type MushafSurah,
} from "@/src/lib/mushaf";
import {
  emptyMushafAnnotations,
  mushafAnnotationRecordFromTarget,
  mushafAnnotationStorageKey,
  normalizeMushafAnnotations,
  type MushafAnnotations,
  type MushafAyahTarget as PageAyahTarget,
  type MushafHighlightColor as HighlightColor,
} from "@/src/lib/mushaf-annotations";
import {
  DEFAULT_PROFILE_SETTINGS,
  loadProfileSettings,
  saveProfileSettings,
  type MushafViewMode,
} from "@/src/lib/settings";

const BOOKMARK_LIMIT = 12;
const RECENT_READ_LIMIT = 5;
const QURAN_API = "https://api.quran.com/api/v4";
const QURAN_COM_1405_PAGE_ASPECT_RATIO =
  QURAN_COM_1405_PAGE_WIDTH / QURAN_COM_1405_PAGE_HEIGHT;
const MUSHAF_AUDIO_SPEEDS = [0.75, 0.85, 1, 1.15, 1.25, 1.5] as const;
const MUSHAF_AUDIO_AYAH_REPEATS = [1, 2, 3, 5] as const;
const MUSHAF_AUDIO_RANGE_REPEATS = [1, 2, 3] as const;
const MUSHAF_CONTROL_SLOT_HEIGHT = 170;

type ReadingStatus = "not_started" | "in_progress" | "completed";
type ToolMode = "none" | "blind" | "recite";
type AyahSheetView = "main" | "highlight" | "note" | "translation" | "tafseer" | "wbw";

type ReadingGoal = {
  lastPage: number | null;
  status: ReadingStatus;
  completedPages: number;
  targetPages: number;
  isEnabled: boolean;
};

type DashboardResponse = {
  readingGoal: ReadingGoal | null;
};

type ReadingProgressResponse = {
  readingStatus: ReadingStatus;
  readingCompletedPages: number;
  readingLastPage: number | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SearchParamValue = string | string[] | undefined;
type AudioPlayerStatus = "loading" | "playing" | "paused";

type RecentRead = {
  page: number;
  surahNumber: number;
  surahName: string;
  timestamp: number;
};

type WBWWord = {
  position: number;
  text_uthmani: string;
  char_type_name: string;
  transliteration?: { text?: string } | string;
  translation?: { text?: string; language_name?: string } | string;
};

type LoadState<T> = {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
};

type MushafAudioSettings = {
  reciterId: string;
  speed: number;
  ayahRepeat: number;
  rangeRepeat: number;
};

type MushafAudioPlayer = {
  status: AudioPlayerStatus;
  queue: PageAyahTarget[];
  index: number;
  ayahRepeatPass: number;
  rangeRepeatPass: number;
  sourceLabel: string;
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

const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; dot: string; label: string }> = {
  yellow: { bg: "rgba(250, 204, 21, 0.26)", dot: "#f59e0b", label: "Yellow" },
  green: { bg: "rgba(34, 197, 94, 0.22)", dot: "#16a34a", label: "Green" },
  blue: { bg: "rgba(59, 130, 246, 0.2)", dot: "#2563eb", label: "Blue" },
  pink: { bg: "rgba(236, 72, 153, 0.2)", dot: "#db2777", label: "Pink" },
};

function bookmarkStorageKey(childId: string | undefined) {
  return `noorpath:mushaf:bookmarks:${childId ?? "unknown"}`;
}

function recentReadStorageKey(childId: string | undefined) {
  return `noorpath:mushaf:recent:${childId ?? "unknown"}`;
}

function audioSettingsStorageKey(childId: string | undefined) {
  return `noorpath:mushaf:audio-settings:${childId ?? "unknown"}`;
}

const DEFAULT_MUSHAF_AUDIO_SETTINGS: MushafAudioSettings = {
  reciterId: DEFAULT_RECITER_ID,
  speed: 1,
  ayahRepeat: 1,
  rangeRepeat: 1,
};

function nearestOption(value: number, options: readonly number[]) {
  return options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best,
  options[0] ?? value);
}

function normalizeAudioSettings(raw: string | null): MushafAudioSettings {
  if (!raw) return DEFAULT_MUSHAF_AUDIO_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<MushafAudioSettings>;
    const reciterId =
      typeof parsed.reciterId === "string" && RECITERS.some((reciter) => reciter.id === parsed.reciterId)
        ? parsed.reciterId
        : DEFAULT_MUSHAF_AUDIO_SETTINGS.reciterId;
    const speed =
      typeof parsed.speed === "number"
        ? nearestOption(parsed.speed, MUSHAF_AUDIO_SPEEDS)
        : DEFAULT_MUSHAF_AUDIO_SETTINGS.speed;
    const ayahRepeat =
      typeof parsed.ayahRepeat === "number"
        ? nearestOption(parsed.ayahRepeat, MUSHAF_AUDIO_AYAH_REPEATS)
        : DEFAULT_MUSHAF_AUDIO_SETTINGS.ayahRepeat;
    const rangeRepeat =
      typeof parsed.rangeRepeat === "number"
        ? nearestOption(parsed.rangeRepeat, MUSHAF_AUDIO_RANGE_REPEATS)
        : DEFAULT_MUSHAF_AUDIO_SETTINGS.rangeRepeat;
    return { reciterId, speed, ayahRepeat, rangeRepeat };
  } catch {
    return DEFAULT_MUSHAF_AUDIO_SETTINGS;
  }
}

function parsePositiveInteger(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function singleParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageParam(value: SearchParamValue) {
  const page = singleParam(value);
  if (!page) return null;
  const parsed = parsePositiveInteger(page);
  return parsed === null ? null : clampMushafPage(parsed);
}

function parseVerseKey(verseKey: string) {
  const [surahRaw, ayahRaw] = verseKey.split(":");
  const surahNumber = Number(surahRaw);
  const ayahNumber = Number(ayahRaw);
  if (!Number.isInteger(surahNumber) || !Number.isInteger(ayahNumber)) return null;
  return { surahNumber, ayahNumber };
}

function pageVerseToTarget(verse: ApiPageVerse, pageNumber: number): PageAyahTarget | null {
  const parsed = parseVerseKey(verse.verse_key);
  if (!parsed) return null;
  return {
    verseKey: verse.verse_key,
    surahNumber: parsed.surahNumber,
    ayahNumber: parsed.ayahNumber,
    pageNumber,
    textUthmani: verse.text_uthmani,
  };
}

function verseKeyFor(surahNumber: number, ayahNumber: number) {
  return `${surahNumber}:${ayahNumber}`;
}

function getPageForVerseKey(surahNumber: number, ayahNumber: number) {
  return (
    getMushafPageForVerse(surahNumber, ayahNumber) ??
    MUSHAF_SURAHS[surahNumber - 1]?.startPage ??
    1
  );
}

function buildPageAyahTarget(
  surahNumber: number,
  ayahNumber: number,
  pageAyahs: PageAyahTarget[],
): PageAyahTarget | null {
  const surah = MUSHAF_SURAHS[surahNumber - 1];
  if (!surah || ayahNumber < 1 || ayahNumber > surah.verseCount) return null;

  const verseKey = verseKeyFor(surahNumber, ayahNumber);
  const existing = pageAyahs.find((ayah) => ayah.verseKey === verseKey);
  return {
    verseKey,
    surahNumber,
    ayahNumber,
    pageNumber: existing?.pageNumber ?? getPageForVerseKey(surahNumber, ayahNumber),
    textUthmani: existing?.textUthmani ?? "",
  };
}

function buildSurahPlaybackQueue(start: PageAyahTarget, pageAyahs: PageAyahTarget[]) {
  const surah = MUSHAF_SURAHS[start.surahNumber - 1];
  if (!surah) return [start];

  const queue: PageAyahTarget[] = [];
  for (let ayah = start.ayahNumber; ayah <= surah.verseCount; ayah += 1) {
    const target = buildPageAyahTarget(start.surahNumber, ayah, pageAyahs);
    if (target) queue.push(target);
  }

  return queue.length > 0 ? queue : [start];
}

function isKnownAyah(surahNumber: number, ayahNumber: number) {
  const surah = MUSHAF_SURAHS[surahNumber - 1];
  return !!surah && ayahNumber >= 1 && ayahNumber <= surah.verseCount;
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
  if (!isKnownAyah(surahNumber, ayahNumber)) return;
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

function buildQuranCom1405OverlayRects(pageNumber: number, layout: PageImageLayout): PageOverlayRect[] {
  if (layout.width <= 0 || layout.height <= 0) return [];

  const ayahRects = getQuranCom1405AyahRectsForPage(pageNumber);
  if (ayahRects.length === 0) return [];

  const widthCoeff = layout.width / QURAN_COM_1405_NATIVE_WIDTH;
  const heightCoeff = layout.height / QURAN_COM_1405_NATIVE_HEIGHT;
  const rects: PageOverlayRect[] = [];

  ayahRects.forEach(([
    surahNumber,
    ayahNumber,
    lineNumber,
    minX,
    maxX,
    minY,
    maxY,
  ], index) => {
    const top = minY * heightCoeff;
    const left = minX * widthCoeff;

    pushOverlayRect(rects, {
      pageNumber,
      surahNumber,
      ayahNumber,
      top,
      left,
      width: (maxX - minX) * widthCoeff,
      height: (maxY - minY) * heightCoeff,
      layout,
      suffix: `line-${lineNumber}-${index}`,
    });
  });

  return rects;
}

function sortAyahTargets(targets: PageAyahTarget[]) {
  return [...targets].sort((a, b) => {
    if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
    return a.ayahNumber - b.ayahNumber;
  });
}

function formatTargetRange(targets: PageAyahTarget[]) {
  if (targets.length === 0) return "No ayahs";
  const sorted = sortAyahTargets(targets);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (first.surahNumber === last.surahNumber && first.ayahNumber === last.ayahNumber) {
    return `Quran ${formatVerseLabel(first)}`;
  }
  if (first.surahNumber === last.surahNumber) {
    return `Quran ${first.surahNumber}:${first.ayahNumber}-${last.ayahNumber}`;
  }
  return `Quran ${formatVerseLabel(first)}-${formatVerseLabel(last)}`;
}

function formatVerseLabel(target: Pick<PageAyahTarget, "surahNumber" | "ayahNumber">) {
  return `${target.surahNumber}:${target.ayahNumber}`;
}

async function fetchAyahTafseer(surahNumber: number, ayahNumber: number): Promise<string> {
  const res = await fetch(`${QURAN_API}/tafsirs/169/by_ayah/${surahNumber}:${ayahNumber}`);
  if (!res.ok) throw new Error(`Tafseer unavailable (${res.status})`);
  const data = (await res.json()) as { tafsir?: { text?: string } };
  const text = cleanTranslationHtml(data.tafsir?.text ?? "");
  if (!text) throw new Error("Tafseer unavailable");
  return text;
}

async function fetchAyahWbw(verseKey: string): Promise<WBWWord[]> {
  const res = await fetch(
    `${QURAN_API}/verses/by_key/${verseKey}?word_fields=text_uthmani,transliteration,translation`,
  );
  if (!res.ok) throw new Error(`Word-by-word unavailable (${res.status})`);
  const data = (await res.json()) as { verse?: { words?: WBWWord[] } };
  return (data.verse?.words ?? []).filter((word) => word.char_type_name !== "end");
}

function translationText(value: WBWWord["translation"]) {
  if (!value) return "";
  return typeof value === "string" ? value : value.text ?? "";
}

function transliterationText(value: WBWWord["transliteration"]) {
  if (!value) return "";
  return typeof value === "string" ? value : value.text ?? "";
}

function normalizeRecentReads(raw: string | null): RecentRead[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const page = Number(record.page);
        const surahNumber = Number(record.surahNumber);
        const surahName = typeof record.surahName === "string" ? record.surahName : "";
        const timestamp = Number(record.timestamp);
        if (
          !Number.isInteger(page) ||
          page < 1 ||
          page > TOTAL_MUSHAF_PAGES ||
          !Number.isInteger(surahNumber) ||
          surahNumber < 1 ||
          surahNumber > MUSHAF_SURAHS.length ||
          !surahName
        ) {
          return null;
        }
        return {
          page,
          surahNumber,
          surahName,
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
        };
      })
      .filter((item): item is RecentRead => item !== null)
      .slice(0, RECENT_READ_LIMIT);
  } catch {
    return [];
  }
}

function PageView({
  pageNumber,
  width,
  toolMode,
  blindRevealed,
  highlightedVerseKeys,
  activeVerseKey,
  onRevealBlindPage,
  onOpenAyah,
  onStartRecite,
}: {
  pageNumber: number;
  width: number;
  toolMode: ToolMode;
  blindRevealed: boolean;
  highlightedVerseKeys: Set<string>;
  activeVerseKey: string | null;
  onRevealBlindPage: () => void;
  onOpenAyah: (target: PageAyahTarget) => void;
  onStartRecite: (target: PageAyahTarget) => void;
}) {
  const [pageVerses, setPageVerses] = useState<ApiPageVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLayout, setImageLayout] = useState<PageImageLayout>({ width: 0, height: 0 });
  const imageSource = getQuranCom1405PageImage(pageNumber);
  const isBlindHidden = toolMode === "blind" && !blindRevealed;
  const verseByKey = useMemo(() => {
    const map = new Map<string, ApiPageVerse>();
    for (const verse of pageVerses) map.set(verse.verse_key, verse);
    return map;
  }, [pageVerses]);
  const overlayRects = useMemo(
    () => buildQuranCom1405OverlayRects(pageNumber, imageLayout),
    [imageLayout, pageNumber],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageVerses([]);

    fetchVersesByPage(pageNumber)
      .then((verses) => {
        if (cancelled) return;
        setPageVerses(verses);
        setLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Page could not load.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  function handleImageLayout(event: LayoutChangeEvent) {
    const { width: renderedWidth, height: renderedHeight } = event.nativeEvent.layout;
    setImageLayout((current) =>
      Math.abs(current.width - renderedWidth) < 0.5 &&
      Math.abs(current.height - renderedHeight) < 0.5
        ? current
        : { width: renderedWidth, height: renderedHeight },
    );
  }

  function targetFromRect(rect: PageOverlayRect): PageAyahTarget {
    const verse = verseByKey.get(rect.verseKey);
    return {
      verseKey: rect.verseKey,
      surahNumber: rect.surahNumber,
      ayahNumber: rect.ayahNumber,
      pageNumber,
      textUthmani: verse?.text_uthmani ?? "",
    };
  }

  function handleAyahPress(rect: PageOverlayRect) {
    const target = targetFromRect(rect);
    if (toolMode === "recite") {
      onStartRecite(target);
      return;
    }
    onOpenAyah(target);
  }

  function handlePagePress() {
    if (isBlindHidden) onRevealBlindPage();
  }

  return (
    <View style={[styles.pageWrap, { width }]}>
      <View
        style={[styles.pageImageShell, styles.quranCom1405ImageShell]}
        onLayout={handleImageLayout}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.pageImage}
            contentFit="contain"
          />
        ) : (
          <View style={styles.errorOverlay}>
            <Ionicons name="cloud-offline-outline" size={24} color="#b91c1c" />
            <Text style={styles.errorTitle}>Page image missing</Text>
            <Text style={styles.errorBody}>Page {pageNumber} could not be found.</Text>
          </View>
        )}

        {isBlindHidden ? (
          <Pressable
            style={styles.pageBackgroundPressable}
            onPress={handlePagePress}
            accessibilityRole="button"
            accessibilityLabel="Reveal hidden mushaf page"
          />
        ) : null}

        {!isBlindHidden
          ? overlayRects.map((rect) => {
              const highlighted = highlightedVerseKeys.has(rect.verseKey);
              const active = activeVerseKey === rect.verseKey;
              return (
                <Pressable
                  key={rect.key}
                  accessible
                  accessibilityLabel={`Quran ${rect.verseKey}`}
                  accessibilityRole="button"
                  style={[
                    styles.ayahTapOverlay,
                    {
                      top: rect.top,
                      left: rect.left,
                      width: rect.width,
                      height: rect.height,
                    },
                    highlighted && styles.ayahTapOverlayHighlighted,
                    active && styles.ayahTapOverlayActive,
                  ]}
                  onPress={() => handleAyahPress(rect)}
                  onLongPress={() => onOpenAyah(targetFromRect(rect))}
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

        {isBlindHidden ? (
          <View pointerEvents="none" style={styles.blindOverlay}>
            <Ionicons name="eye-off-outline" size={30} color="#ffffff" />
            <Text style={styles.blindOverlayTitle}>Blind practice</Text>
            <Text style={styles.blindOverlayText}>Tap to reveal this page.</Text>
          </View>
        ) : null}

        {toolMode === "recite" && !isBlindHidden ? (
          <View pointerEvents="none" style={styles.modeOverlayHint}>
            <Ionicons name="mic-outline" size={15} color="#be123c" />
            <Text style={[styles.modeOverlayHintText, styles.modeOverlayHintTextRecite]}>
              Tap ayah to recite
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ToolButton({
  label,
  iconName,
  active,
  color,
  onPress,
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.toolButton, active && { borderColor: color, backgroundColor: `${color}12` }]}
      onPress={onPress}
    >
      <Ionicons name={iconName} size={18} color={active ? color : "#374151"} />
      <Text style={[styles.toolButtonText, active && { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function JumpRow({
  title,
  detail,
  iconName,
  color,
  onPress,
  trailing,
}: {
  title: string;
  detail: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  trailing?: string;
}) {
  return (
    <Pressable style={styles.jumpRow} onPress={onPress}>
      <View style={[styles.jumpIcon, { backgroundColor: `${color}16` }]}>
        <Ionicons name={iconName} size={19} color={color} />
      </View>
      <View style={styles.jumpTextBlock}>
        <Text style={styles.jumpTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.jumpDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {trailing ? <Text style={styles.jumpTrailing}>{trailing}</Text> : null}
    </Pressable>
  );
}

function JuzChip({ item, onPress }: { item: MushafJuz; onPress: () => void }) {
  return (
    <Pressable style={styles.juzChip} onPress={onPress}>
      <Text style={styles.juzChipTitle}>Juz {item.number}</Text>
      <Text style={styles.juzChipDetail}>p. {item.startPage}</Text>
    </Pressable>
  );
}

function MushafAudioBar({
  player,
  settings,
  onToggle,
  onStop,
  onPrevious,
  onNext,
  onOpenSettings,
}: {
  player: MushafAudioPlayer;
  settings: MushafAudioSettings;
  onToggle: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
}) {
  const activeTarget = player.queue[player.index];
  const reciter = findReciter(settings.reciterId);
  const canPrevious = player.index > 0 || player.rangeRepeatPass > 1;
  const canNext =
    player.index < player.queue.length - 1 || player.rangeRepeatPass < settings.rangeRepeat;

  if (!activeTarget) return null;

  return (
    <View style={styles.audioBar}>
      <View style={styles.audioBarTop}>
        <View style={styles.audioNowPlaying}>
          <Text style={styles.audioKicker} numberOfLines={1}>
            {player.sourceLabel}
          </Text>
          <Text style={styles.audioTitle} numberOfLines={1}>
            {formatTargetRange([activeTarget])}
          </Text>
          <Text style={styles.audioMeta} numberOfLines={1}>
            {reciter.fullName} · {settings.speed}x · ayah {player.ayahRepeatPass}/{settings.ayahRepeat} · range {player.rangeRepeatPass}/{settings.rangeRepeat}
          </Text>
        </View>
        <Pressable style={styles.audioIconButton} onPress={onOpenSettings}>
          <Ionicons name="options-outline" size={18} color="#2563eb" />
        </Pressable>
      </View>
      <View style={styles.audioControls}>
        <Pressable
          style={[styles.audioRoundButton, !canPrevious && styles.audioRoundButtonDisabled]}
          disabled={!canPrevious}
          onPress={onPrevious}
        >
          <Ionicons name="play-skip-back" size={17} color={canPrevious ? "#374151" : "#9ca3af"} />
        </Pressable>
        <Pressable style={styles.audioPrimaryRoundButton} onPress={onToggle}>
          <Ionicons
            name={
              player.status === "loading"
                ? "hourglass-outline"
                : player.status === "playing"
                  ? "pause"
                  : "play"
            }
            size={20}
            color="#ffffff"
          />
        </Pressable>
        <Pressable
          style={[styles.audioRoundButton, !canNext && styles.audioRoundButtonDisabled]}
          disabled={!canNext}
          onPress={onNext}
        >
          <Ionicons name="play-skip-forward" size={17} color={canNext ? "#374151" : "#9ca3af"} />
        </Pressable>
        <Pressable style={styles.audioStopButton} onPress={onStop}>
          <Ionicons name="square" size={14} color="#dc2626" />
          <Text style={styles.audioStopButtonText}>Stop</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MushafAudioSettingsModal({
  visible,
  settings,
  onChange,
  onClose,
}: {
  visible: boolean;
  settings: MushafAudioSettings;
  onChange: (next: MushafAudioSettings) => void;
  onClose: () => void;
}) {
  function patchSettings(patch: Partial<MushafAudioSettings>) {
    onChange({ ...settings, ...patch });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Pressable style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="chevron-down" size={22} color="#2563eb" />
          </Pressable>
          <View style={styles.sheetTitleBlock}>
            <Text style={styles.sheetTitle}>Audio settings</Text>
            <Text style={styles.sheetSubtitle}>Reciter, speed, and repeat controls</Text>
          </View>
          <View style={styles.sheetHeaderSpacer} />
        </View>

        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.audioSettingsContent}>
          <View style={styles.audioSettingsGroup}>
            <Text style={styles.sectionLabel}>Reciter</Text>
            {RECITERS.map((reciter) => {
              const selected = settings.reciterId === reciter.id;
              return (
                <Pressable
                  key={reciter.id}
                  style={[styles.reciterRow, selected && styles.reciterRowSelected]}
                  onPress={() => patchSettings({ reciterId: reciter.id })}
                >
                  <View style={styles.reciterTextBlock}>
                    <Text style={[styles.reciterName, selected && styles.reciterNameSelected]}>
                      {reciter.fullName}
                    </Text>
                    <Text style={styles.reciterStyle}>{reciter.style}</Text>
                  </View>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={selected ? "#2563eb" : "#9ca3af"}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.audioSettingsGroup}>
            <Text style={styles.sectionLabel}>Speed</Text>
            <View style={styles.optionChipRow}>
              {MUSHAF_AUDIO_SPEEDS.map((speed) => (
                <Pressable
                  key={speed}
                  style={[styles.optionChip, settings.speed === speed && styles.optionChipSelected]}
                  onPress={() => patchSettings({ speed })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      settings.speed === speed && styles.optionChipTextSelected,
                    ]}
                  >
                    {speed}x
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.audioSettingsGroup}>
            <Text style={styles.sectionLabel}>Ayah repeat</Text>
            <View style={styles.optionChipRow}>
              {MUSHAF_AUDIO_AYAH_REPEATS.map((repeat) => (
                <Pressable
                  key={repeat}
                  style={[styles.optionChip, settings.ayahRepeat === repeat && styles.optionChipSelected]}
                  onPress={() => patchSettings({ ayahRepeat: repeat })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      settings.ayahRepeat === repeat && styles.optionChipTextSelected,
                    ]}
                  >
                    {repeat}x
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.audioSettingsGroup}>
            <Text style={styles.sectionLabel}>Range repeat</Text>
            <View style={styles.optionChipRow}>
              {MUSHAF_AUDIO_RANGE_REPEATS.map((repeat) => (
                <Pressable
                  key={repeat}
                  style={[styles.optionChip, settings.rangeRepeat === repeat && styles.optionChipSelected]}
                  onPress={() => patchSettings({ rangeRepeat: repeat })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      settings.rangeRepeat === repeat && styles.optionChipTextSelected,
                    ]}
                  >
                    {repeat}x
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function AyahActionSheet({
  target,
  pageBookmarked,
  annotations,
  pageAyahs,
  onClose,
  onNavigate,
  onOpenMemorization,
  onPlayAyah,
  onPlayFromHere,
  onReciteFromAyah,
  onSavePage,
  onTogglePageBookmark,
  onToggleBookmark,
  onSetHighlight,
  onSaveNote,
}: {
  target: PageAyahTarget | null;
  pageBookmarked: boolean;
  annotations: MushafAnnotations;
  pageAyahs: PageAyahTarget[];
  onClose: () => void;
  onNavigate: (target: PageAyahTarget) => void;
  onOpenMemorization: (target: PageAyahTarget) => void;
  onPlayAyah: (target: PageAyahTarget) => void;
  onPlayFromHere: (target: PageAyahTarget) => void;
  onReciteFromAyah: (target: PageAyahTarget) => void;
  onSavePage: (target: PageAyahTarget) => void;
  onTogglePageBookmark: (target: PageAyahTarget) => void;
  onToggleBookmark: (target: PageAyahTarget) => void;
  onSetHighlight: (target: PageAyahTarget, color: HighlightColor | null) => void;
  onSaveNote: (target: PageAyahTarget, text: string) => void;
}) {
  const surah = target ? MUSHAF_SURAHS[target.surahNumber - 1] : null;
  const [sheetView, setSheetView] = useState<AyahSheetView>("main");
  const [noteText, setNoteText] = useState("");
  const [translationState, setTranslationState] = useState<LoadState<string>>({
    status: "idle",
    data: null,
    error: null,
  });
  const [translationExpanded, setTranslationExpanded] = useState(false);
  const [tafseerState, setTafseerState] = useState<LoadState<string>>({
    status: "idle",
    data: null,
    error: null,
  });
  const [tafseerExpanded, setTafseerExpanded] = useState(false);
  const [wbwState, setWbwState] = useState<LoadState<WBWWord[]>>({
    status: "idle",
    data: null,
    error: null,
  });
  const previousVerseKeyRef = useRef<string | null>(null);

  const bookmark = target ? annotations.bookmarks[target.verseKey] : undefined;
  const highlight = target ? annotations.highlights[target.verseKey] : undefined;
  const note = target ? annotations.notes[target.verseKey] : undefined;
  const previousAyah =
    target && target.ayahNumber > 1
      ? buildPageAyahTarget(target.surahNumber, target.ayahNumber - 1, pageAyahs)
      : null;
  const nextAyah =
    target && surah && target.ayahNumber < surah.verseCount
      ? buildPageAyahTarget(target.surahNumber, target.ayahNumber + 1, pageAyahs)
      : null;
  const sheetMaxHeight = Math.round(Dimensions.get("window").height * 0.86);

  useEffect(() => {
    const previous = previousVerseKeyRef.current;
    previousVerseKeyRef.current = target?.verseKey ?? null;
    if (!target) return;
    if (!previous) setSheetView("main");
    setNoteText(annotations.notes[target.verseKey]?.text ?? "");
    setTranslationState({ status: "idle", data: null, error: null });
    setTranslationExpanded(false);
    setTafseerState({ status: "idle", data: null, error: null });
    setTafseerExpanded(false);
    setWbwState({ status: "idle", data: null, error: null });
  }, [annotations.notes, target?.verseKey]);

  useEffect(() => {
    if (!target || sheetView !== "translation") return;
    let cancelled = false;
    setTranslationState({ status: "loading", data: null, error: null });
    fetchAyahTranslation(target.verseKey)
      .then((translation) => {
        if (!cancelled) setTranslationState({ status: "ready", data: translation, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setTranslationState({
            status: "error",
            data: null,
            error: error instanceof Error ? error.message : "Translation could not load.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sheetView, target?.verseKey]);

  useEffect(() => {
    if (!target || sheetView !== "tafseer") return;
    let cancelled = false;
    setTafseerState({ status: "loading", data: null, error: null });
    fetchAyahTafseer(target.surahNumber, target.ayahNumber)
      .then((tafseer) => {
        if (!cancelled) setTafseerState({ status: "ready", data: tafseer, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setTafseerState({
            status: "error",
            data: null,
            error: error instanceof Error ? error.message : "Tafseer could not load.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sheetView, target?.ayahNumber, target?.surahNumber]);

  useEffect(() => {
    if (!target || sheetView !== "wbw") return;
    let cancelled = false;
    setWbwState({ status: "loading", data: null, error: null });
    fetchAyahWbw(target.verseKey)
      .then((words) => {
        if (!cancelled) setWbwState({ status: "ready", data: words, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setWbwState({
            status: "error",
            data: null,
            error: error instanceof Error ? error.message : "Word-by-word could not load.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sheetView, target?.verseKey]);

  async function shareAyah() {
    if (!target) return;
    const translation = translationState.data ? `\n\n${translationState.data}` : "";
    try {
      await Share.share({
        message: `${target.textUthmani}${translation}\n\nQuran ${formatVerseLabel(target)}`,
      });
    } catch {
      // Sharing is best-effort.
    }
  }

  function renderSubHeader(title: string) {
    return (
      <View style={styles.ayahSubHeader}>
        <Pressable style={styles.ayahSubBack} onPress={() => setSheetView("main")}>
          <Ionicons name="chevron-back" size={18} color="#2563eb" />
          <Text style={styles.ayahSubBackText}>Actions</Text>
        </Pressable>
        <Text style={styles.ayahSubTitle}>{title}</Text>
        <View style={styles.ayahSubHeaderSpacer} />
      </View>
    );
  }

  function renderNavigation() {
    return (
      <View style={styles.ayahNavigationRow}>
        <Pressable
          style={[styles.ayahNavButton, !previousAyah && styles.ayahNavButtonDisabled]}
          disabled={!previousAyah}
          onPress={() => previousAyah && onNavigate(previousAyah)}
        >
          <Ionicons name="chevron-back" size={15} color={previousAyah ? "#2563eb" : "#9ca3af"} />
          <Text style={[styles.ayahNavButtonText, !previousAyah && styles.ayahNavButtonTextDisabled]}>
            Previous
          </Text>
        </Pressable>
        <Pressable
          style={[styles.ayahNavButton, !nextAyah && styles.ayahNavButtonDisabled]}
          disabled={!nextAyah}
          onPress={() => nextAyah && onNavigate(nextAyah)}
        >
          <Text style={[styles.ayahNavButtonText, !nextAyah && styles.ayahNavButtonTextDisabled]}>
            Next
          </Text>
          <Ionicons name="chevron-forward" size={15} color={nextAyah ? "#2563eb" : "#9ca3af"} />
        </Pressable>
      </View>
    );
  }

  function renderLoadingContent(label: string) {
    return (
      <View style={styles.ayahContentState}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.ayahContentStateText}>Loading {label}</Text>
      </View>
    );
  }

  function renderErrorContent(message: string | null) {
    return (
      <View style={styles.ayahContentState}>
        <Ionicons name="cloud-offline-outline" size={24} color="#dc2626" />
        <Text style={styles.ayahContentStateTitle}>Could not load</Text>
        <Text style={styles.ayahContentStateText}>{message ?? "Try again in a moment."}</Text>
      </View>
    );
  }

  function renderMainView() {
    if (!target) return null;

    return (
      <>
        <View style={styles.ayahPreviewCard}>
          <Text style={styles.ayahPreviewText} numberOfLines={4}>
            {target.textUthmani}
          </Text>
          <View style={styles.ayahMetaGrid}>
            <View style={styles.ayahMetaPill}>
              <Text style={styles.ayahMetaLabel}>Quran</Text>
              <Text style={styles.ayahMetaValue}>{formatVerseLabel(target)}</Text>
            </View>
            <View style={styles.ayahMetaPill}>
              <Text style={styles.ayahMetaLabel}>Page</Text>
              <Text style={styles.ayahMetaValue}>{target.pageNumber}</Text>
            </View>
            <View style={styles.ayahMetaPill}>
              <Text style={styles.ayahMetaLabel}>Juz</Text>
              <Text style={styles.ayahMetaValue}>{getJuzForMushafPage(target.pageNumber)}</Text>
            </View>
          </View>
          {bookmark || highlight || note ? (
            <View style={styles.ayahStatusRow}>
              {bookmark ? (
                <View style={styles.ayahStatusChip}>
                  <Ionicons name="bookmark" size={12} color="#b45309" />
                  <Text style={styles.ayahStatusChipText}>Bookmarked</Text>
                </View>
              ) : null}
              {highlight ? (
                <View style={styles.ayahStatusChip}>
                  <View
                    style={[styles.ayahAnnotationDot, { backgroundColor: HIGHLIGHT_COLORS[highlight.color].dot }]}
                  />
                  <Text style={styles.ayahStatusChipText}>
                    {HIGHLIGHT_COLORS[highlight.color].label}
                  </Text>
                </View>
              ) : null}
              {note ? (
                <View style={styles.ayahStatusChip}>
                  <Ionicons name="document-text-outline" size={12} color="#2563eb" />
                  <Text style={styles.ayahStatusChipText}>Note</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable style={styles.ayahPrimaryButton} onPress={() => onOpenMemorization(target)}>
          <Ionicons name="school-outline" size={17} color="#ffffff" />
          <Text style={styles.ayahPrimaryButtonText}>Practice from here</Text>
        </Pressable>

        <View style={styles.ayahMenuGroup}>
          <Pressable style={styles.ayahMenuRow} onPress={() => onPlayAyah(target)}>
            <Ionicons name="play-circle-outline" size={18} color="#2563eb" />
            <Text style={styles.ayahMenuRowText}>Play ayah</Text>
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => onPlayFromHere(target)}>
            <Ionicons name="play-forward-circle-outline" size={18} color="#2563eb" />
            <Text style={styles.ayahMenuRowText}>Play from here</Text>
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => onReciteFromAyah(target)}>
            <Ionicons name="mic-outline" size={18} color="#be123c" />
            <Text style={styles.ayahMenuRowText}>Recite from here</Text>
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => onSavePage(target)}>
            <Ionicons name="save-outline" size={18} color="#2563eb" />
            <Text style={styles.ayahMenuRowText}>Save current page</Text>
          </Pressable>
        </View>

        <View style={styles.ayahMenuGroup}>
          <Pressable style={styles.ayahMenuRow} onPress={() => onTogglePageBookmark(target)}>
            <Ionicons
              name={pageBookmarked ? "bookmark" : "bookmark-outline"}
              size={18}
              color="#0f766e"
            />
            <Text style={styles.ayahMenuRowText}>
              {pageBookmarked ? "Remove page bookmark" : "Bookmark page"}
            </Text>
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => onToggleBookmark(target)}>
            <Ionicons name={bookmark ? "bookmark" : "bookmark-outline"} size={18} color="#b45309" />
            <Text style={styles.ayahMenuRowText}>{bookmark ? "Remove bookmark" : "Bookmark ayah"}</Text>
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => setSheetView("highlight")}>
            <Ionicons name="color-palette-outline" size={18} color="#7c3aed" />
            <Text style={styles.ayahMenuRowText}>
              {highlight ? "Change highlight" : "Highlight ayah"}
            </Text>
            <Ionicons name="chevron-forward" size={17} color="#9ca3af" />
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => setSheetView("note")}>
            <Ionicons name="document-text-outline" size={18} color="#2563eb" />
            <Text style={styles.ayahMenuRowText}>{note ? "Edit note" : "Add note"}</Text>
            <Ionicons name="chevron-forward" size={17} color="#9ca3af" />
          </Pressable>
        </View>

        <View style={styles.ayahMenuGroup}>
          <Pressable style={styles.ayahMenuRow} onPress={() => setSheetView("translation")}>
            <Ionicons name="language-outline" size={18} color="#0f766e" />
            <Text style={styles.ayahMenuRowText}>Translation</Text>
            <Ionicons name="chevron-forward" size={17} color="#9ca3af" />
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => setSheetView("tafseer")}>
            <Ionicons name="book-outline" size={18} color="#0f766e" />
            <Text style={styles.ayahMenuRowText}>Tafseer</Text>
            <Ionicons name="chevron-forward" size={17} color="#9ca3af" />
          </Pressable>
          <Pressable style={styles.ayahMenuRow} onPress={() => setSheetView("wbw")}>
            <Ionicons name="text-outline" size={18} color="#0f766e" />
            <Text style={styles.ayahMenuRowText}>Word by word</Text>
            <Ionicons name="chevron-forward" size={17} color="#9ca3af" />
          </Pressable>
        </View>

        <View style={styles.ayahMenuGroup}>
          <Pressable style={styles.ayahMenuRow} onPress={shareAyah}>
            <Ionicons name="share-outline" size={18} color="#374151" />
            <Text style={styles.ayahMenuRowText}>Share ayah</Text>
          </Pressable>
        </View>

        {renderNavigation()}
      </>
    );
  }

  function renderHighlightView() {
    if (!target) return null;

    return (
      <>
        {renderSubHeader("Highlight")}
        <View style={styles.highlightGrid}>
          {(Object.entries(HIGHLIGHT_COLORS) as [HighlightColor, (typeof HIGHLIGHT_COLORS)[HighlightColor]][]).map(
            ([color, meta]) => (
              <Pressable
                key={color}
                style={[
                  styles.highlightSwatch,
                  { backgroundColor: meta.bg, borderColor: highlight?.color === color ? meta.dot : "transparent" },
                ]}
                onPress={() => {
                  onSetHighlight(target, color);
                  setSheetView("main");
                }}
              >
                <View style={[styles.highlightSwatchDot, { backgroundColor: meta.dot }]} />
                <Text style={styles.highlightSwatchText}>{meta.label}</Text>
              </Pressable>
            ),
          )}
        </View>
        {highlight ? (
          <Pressable
            style={styles.ayahDangerButton}
            onPress={() => {
              onSetHighlight(target, null);
              setSheetView("main");
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#dc2626" />
            <Text style={styles.ayahDangerButtonText}>Remove highlight</Text>
          </Pressable>
        ) : null}
        {renderNavigation()}
      </>
    );
  }

  function renderNoteView() {
    if (!target) return null;

    return (
      <>
        {renderSubHeader(note ? "Edit note" : "Add note")}
        <View style={styles.noteEditor}>
          <Text style={styles.noteEditorMeta}>Quran {formatVerseLabel(target)}</Text>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Write your note here"
            placeholderTextColor="#9ca3af"
            multiline
            autoFocus
            style={styles.noteInput}
            textAlignVertical="top"
          />
          <View style={styles.noteButtonRow}>
            <Pressable
              style={styles.noteSaveButton}
              onPress={() => {
                onSaveNote(target, noteText);
                setSheetView("main");
              }}
            >
              <Ionicons name="save-outline" size={15} color="#ffffff" />
              <Text style={styles.noteSaveButtonText}>Save note</Text>
            </Pressable>
            {note ? (
              <Pressable
                style={styles.noteDeleteButton}
                onPress={() => {
                  setNoteText("");
                  onSaveNote(target, "");
                  setSheetView("main");
                }}
              >
                <Text style={styles.noteDeleteButtonText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {renderNavigation()}
      </>
    );
  }

  function renderTranslationView() {
    if (!target) return null;

    return (
      <>
        {renderSubHeader("Translation")}
        <View style={styles.ayahTextPanel}>
          <Text style={styles.ayahTextPanelArabic}>{target.textUthmani}</Text>
          <Text style={styles.ayahTextPanelSource}>Saheeh International · Quran {formatVerseLabel(target)}</Text>
        </View>
        {translationState.status === "loading" ? (
          renderLoadingContent("translation")
        ) : translationState.status === "error" ? (
          renderErrorContent(translationState.error)
        ) : (
          <>
            <Text
              style={styles.ayahLongText}
              numberOfLines={translationExpanded ? undefined : 8}
            >
              {translationState.data ?? "Open this panel to load the translation."}
            </Text>
            {translationState.data && translationState.data.length > 300 ? (
              <Pressable
                style={styles.expandToggle}
                onPress={() => setTranslationExpanded((value) => !value)}
              >
                <Text style={styles.expandToggleText}>
                  {translationExpanded ? "Less" : "More"}
                </Text>
                <Ionicons
                  name={translationExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#2563eb"
                />
              </Pressable>
            ) : null}
          </>
        )}
        {renderNavigation()}
      </>
    );
  }

  function renderTafseerView() {
    if (!target) return null;

    return (
      <>
        {renderSubHeader("Tafseer")}
        <View style={styles.ayahTextPanel}>
          <Text style={styles.ayahTextPanelArabic}>{target.textUthmani}</Text>
          <Text style={styles.ayahTextPanelSource}>Ibn Kathir · Quran {formatVerseLabel(target)}</Text>
        </View>
        {tafseerState.status === "loading" ? (
          renderLoadingContent("tafseer")
        ) : tafseerState.status === "error" ? (
          renderErrorContent(tafseerState.error)
        ) : (
          <>
            <Text
              style={styles.ayahLongText}
              numberOfLines={tafseerExpanded ? undefined : 10}
            >
              {tafseerState.data ?? "Open this panel to load tafseer."}
            </Text>
            {tafseerState.data && tafseerState.data.length > 400 ? (
              <Pressable
                style={styles.expandToggle}
                onPress={() => setTafseerExpanded((value) => !value)}
              >
                <Text style={styles.expandToggleText}>
                  {tafseerExpanded ? "Less" : "More"}
                </Text>
                <Ionicons
                  name={tafseerExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#2563eb"
                />
              </Pressable>
            ) : null}
          </>
        )}
        {renderNavigation()}
      </>
    );
  }

  function renderWbwView() {
    if (!target) return null;

    return (
      <>
        {renderSubHeader("Word by word")}
        {wbwState.status === "loading" ? (
          renderLoadingContent("word-by-word")
        ) : wbwState.status === "error" ? (
          renderErrorContent(wbwState.error)
        ) : (
          <View style={styles.wbwGrid}>
            {(wbwState.data ?? []).map((word) => (
              <View key={word.position} style={styles.wbwCard}>
                <Text style={styles.wbwArabic}>{word.text_uthmani}</Text>
                <Text style={styles.wbwTransliteration} numberOfLines={2}>
                  {transliterationText(word.transliteration)}
                </Text>
                <Text style={styles.wbwTranslation} numberOfLines={3}>
                  {translationText(word.translation)}
                </Text>
              </View>
            ))}
            {wbwState.status === "ready" && (wbwState.data?.length ?? 0) === 0 ? (
              <Text style={styles.ayahContentStateText}>No word-by-word data returned.</Text>
            ) : null}
          </View>
        )}
        {renderNavigation()}
      </>
    );
  }

  function renderSheetContent() {
    switch (sheetView) {
      case "highlight":
        return renderHighlightView();
      case "note":
        return renderNoteView();
      case "translation":
        return renderTranslationView();
      case "tafseer":
        return renderTafseerView();
      case "wbw":
        return renderWbwView();
      default:
        return renderMainView();
    }
  }

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      {target ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.ayahKeyboardAvoider}
        >
          <View style={[styles.ayahActionSheet, { maxHeight: sheetMaxHeight }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.ayahActionHeader}>
              <View style={styles.ayahActionTitleBlock}>
                <Text style={styles.ayahActionTitle}>Ayah actions</Text>
                <Text style={styles.ayahActionSubtitle}>
                  {surah?.name ?? `Surah ${target.surahNumber}`} · Ayah {target.ayahNumber}
                </Text>
              </View>
              <Pressable style={styles.ayahActionClose} onPress={onClose}>
                <Ionicons name="close" size={18} color="#6b7280" />
              </Pressable>
            </View>
            <ScrollView
              style={styles.ayahActionScroll}
              contentContainerStyle={styles.ayahActionContent}
              keyboardShouldPersistTaps="handled"
            >
              {renderSheetContent()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  );
}

export default function MushafScreen() {
  const params = useLocalSearchParams<{
    childId: string;
    name?: string;
    page?: string;
    fromMemorization?: string;
    surahNumber?: string;
    ayahNumber?: string;
  }>();
  const { childId, name } = params;
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const screenW = Math.max(1, Math.round(windowWidth));
  const scrollPageItemHeight = useMemo(
    () => Math.max(1, Math.round(screenW / QURAN_COM_1405_PAGE_ASPECT_RATIO)),
    [screenW],
  );
  const requestedInitialPage = useMemo(() => parsePageParam(params.page), [params.page]);

  const [initialPage, setInitialPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState("");
  const [pageInput, setPageInput] = useState("");
  const [bookmarkedPages, setBookmarkedPages] = useState<number[]>([]);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<MushafAnnotations>(() => emptyMushafAnnotations());
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [recentReads, setRecentReads] = useState<RecentRead[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode>("none");
  const [blindRevealed, setBlindRevealed] = useState(false);
  const [selectedAyah, setSelectedAyah] = useState<PageAyahTarget | null>(null);
  const [pageVerses, setPageVerses] = useState<ApiPageVerse[]>([]);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<MushafAudioSettings>(
    DEFAULT_MUSHAF_AUDIO_SETTINGS,
  );
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<MushafAudioPlayer | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSettingsHydrated, setAudioSettingsHydrated] = useState(false);
  const [profileSettings, setProfileSettings] = useState(DEFAULT_PROFILE_SETTINGS);
  const [mushafViewMode, setMushafViewMode] = useState<MushafViewMode>(
    DEFAULT_PROFILE_SETTINGS.mushafViewMode,
  );

  const listRef = useRef<FlatList<number>>(null);
  const programmaticPageChangeRef = useRef(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioSoundRef = useRef<Audio.Sound | null>(null);
  const audioTokenRef = useRef(0);
  const audioPlayerRef = useRef<MushafAudioPlayer | null>(null);
  const audioSettingsRef = useRef<MushafAudioSettings>(DEFAULT_MUSHAF_AUDIO_SETTINGS);
  const lastAudioReciterIdRef = useRef(DEFAULT_MUSHAF_AUDIO_SETTINGS.reciterId);
  const preloadedMushafPagesRef = useRef<Set<number>>(new Set());

  const data = useMemo(
    () => Array.from({ length: TOTAL_MUSHAF_PAGES }, (_, i) => i + 1),
    [],
  );
  const currentSurah = getMushafSurahForPage(currentPage);
  const currentJuz = getJuzForMushafPage(currentPage);
  const pageAyahs = useMemo(
    () =>
      pageVerses
        .map((verse) => pageVerseToTarget(verse, currentPage))
        .filter((target): target is PageAyahTarget => target !== null),
    [currentPage, pageVerses],
  );
  const activeAudioTarget = audioPlayer?.queue[audioPlayer.index] ?? null;
  const activeVerseKey =
    audioPlayer?.status === "playing" || audioPlayer?.status === "loading"
      ? activeAudioTarget?.verseKey ?? null
      : null;
  const highlightedVerseKeys = useMemo(
    () => new Set(Object.keys(annotations.highlights)),
    [annotations.highlights],
  );
  const ayahBookmarkEntries = useMemo(
    () =>
      Object.values(annotations.bookmarks).sort((a, b) => {
        const timeDiff = b.savedAt - a.savedAt;
        if (timeDiff !== 0) return timeDiff;
        if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
        return a.ayahNumber - b.ayahNumber;
      }),
    [annotations.bookmarks],
  );
  const parsedQuery = parsePositiveInteger(jumpQuery);
  const pageResult =
    parsedQuery !== null && parsedQuery >= 1 && parsedQuery <= TOTAL_MUSHAF_PAGES
      ? parsedQuery
      : null;
  const surahResult =
    parsedQuery !== null && parsedQuery >= 1 && parsedQuery <= MUSHAF_SURAHS.length
      ? MUSHAF_SURAHS[parsedQuery - 1]
      : null;
  const juzResult =
    parsedQuery !== null && parsedQuery >= 1 && parsedQuery <= MUSHAF_JUZS.length
      ? MUSHAF_JUZS[parsedQuery - 1]
      : null;
  const surahResults = useMemo(
    () => searchMushafSurahs(jumpQuery).slice(0, jumpQuery.trim() ? 24 : MUSHAF_SURAHS.length),
    [jumpQuery],
  );
  const juzResults = useMemo(() => {
    const q = jumpQuery.trim().toLowerCase();
    if (!q) return MUSHAF_JUZS;
    return MUSHAF_JUZS.filter((juz) => {
      const label = `juz ${juz.number} page ${juz.startPage}`;
      return String(juz.number) === q || label.includes(q);
    });
  }, [jumpQuery]);

  const getSwipeItemLayout = useCallback(
    (_data: ArrayLike<number> | null | undefined, index: number) => ({
      length: screenW,
      offset: screenW * index,
      index,
    }),
    [screenW],
  );

  const getScrollItemLayout = useCallback(
    (_data: ArrayLike<number> | null | undefined, index: number) => ({
      length: scrollPageItemHeight,
      offset: scrollPageItemHeight * index,
      index,
    }),
    [scrollPageItemHeight],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPage() {
      try {
        const dashboard = await apiFetch<DashboardResponse>(
          `/api/children/${childId}/dashboard`,
        );
        if (cancelled) return;

        const goal = dashboard.readingGoal;
        const savedPage =
          goal?.lastPage != null && goal.lastPage >= 1
            ? clampMushafPage(goal.lastPage)
            : 1;
        const startPage = requestedInitialPage ?? savedPage;

        setCurrentPage(startPage);
        setInitialPage(startPage);
      } catch {
        if (cancelled) return;
        const fallbackPage = requestedInitialPage ?? 1;
        setCurrentPage(fallbackPage);
        setInitialPage(fallbackPage);
      }
    }

    async function loadBookmarks() {
      try {
        const raw = await AsyncStorage.getItem(bookmarkStorageKey(childId));
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        const pages = parsed
          .map((page) => Number(page))
          .filter((page) => Number.isInteger(page) && page >= 1 && page <= TOTAL_MUSHAF_PAGES)
          .slice(0, BOOKMARK_LIMIT);
        setBookmarkedPages(Array.from(new Set(pages)));
      } catch {
        if (!cancelled) setBookmarkError("Bookmarks could not load.");
      }
    }

    async function loadRecentReads() {
      try {
        const raw = await AsyncStorage.getItem(recentReadStorageKey(childId));
        if (cancelled) return;
        setRecentReads(normalizeRecentReads(raw));
      } catch {
        // Recent reads are a convenience; a failed load should never block reading.
      }
    }

    async function loadAnnotations() {
      try {
        const raw = await AsyncStorage.getItem(mushafAnnotationStorageKey(childId));
        if (cancelled) return;
        setAnnotations(normalizeMushafAnnotations(raw));
      } catch {
        if (!cancelled) setAnnotationError("Ayah annotations could not load.");
      }
    }

    async function loadAudioSettings() {
      setAudioSettingsHydrated(false);
      try {
        const raw = await AsyncStorage.getItem(audioSettingsStorageKey(childId));
        if (cancelled) return;
        setAudioSettings(normalizeAudioSettings(raw));
      } catch {
        if (!cancelled) setAudioSettings(DEFAULT_MUSHAF_AUDIO_SETTINGS);
      } finally {
        if (!cancelled) setAudioSettingsHydrated(true);
      }
    }

    async function loadReadingProfileSettings() {
      const settings = await loadProfileSettings(childId);
      if (cancelled) return;
      setProfileSettings(settings);
      setMushafViewMode(settings.mushafViewMode);
    }

    loadInitialPage();
    loadBookmarks();
    loadRecentReads();
    loadAnnotations();
    loadAudioSettings();
    loadReadingProfileSettings();

    return () => {
      cancelled = true;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      audioTokenRef.current += 1;
      if (audioSoundRef.current) {
        audioSoundRef.current.unloadAsync().catch(() => {});
        audioSoundRef.current = null;
      }
    };
  }, [childId, requestedInitialPage]);

  useEffect(() => {
    audioPlayerRef.current = audioPlayer;
  }, [audioPlayer]);

  useEffect(() => {
    const pagesToPreload = [
      currentPage,
      Math.max(currentPage - 1, 1),
      Math.min(currentPage + 1, TOTAL_MUSHAF_PAGES),
      Math.min(currentPage + 2, TOTAL_MUSHAF_PAGES),
    ];
    const newPagesToPreload = pagesToPreload.filter(
      (page) => !preloadedMushafPagesRef.current.has(page),
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
        newPagesToPreload.forEach((page) => preloadedMushafPagesRef.current.add(page));
        const pagesToKeep = new Set(pagesToPreload);
        preloadedMushafPagesRef.current = new Set(
          [...preloadedMushafPagesRef.current].filter((page) => pagesToKeep.has(page)),
        );
      } catch {
        // Preloading is only a swipe performance optimization.
      }
    }

    void preloadImages();
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    if (initialPage === null) return;
    if (!programmaticPageChangeRef.current) {
      programmaticPageChangeRef.current = true;
      return;
    }

    const index = currentPage - 1;
    const itemLength = mushafViewMode === "scroll" ? scrollPageItemHeight : screenW;
    const timeout = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index,
          animated: mushafViewMode === "scroll",
        });
      } catch {
        try {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, index * itemLength),
            animated: mushafViewMode === "scroll",
          });
        } catch {
          // The list may still be mounting after a mode switch.
        }
      }
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [currentPage, initialPage, mushafViewMode, screenW, scrollPageItemHeight]);

  useEffect(() => {
    audioSettingsRef.current = audioSettings;
    if (!audioSettingsHydrated) return;
    AsyncStorage.setItem(audioSettingsStorageKey(childId), JSON.stringify(audioSettings)).catch(() => {
      // Best-effort only.
    });
  }, [audioSettings, audioSettingsHydrated, childId]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {
      // Non-fatal on simulator.
    });
  }, []);

  useEffect(() => {
    audioSoundRef.current?.setRateAsync(audioSettings.speed, true).catch(() => {
      // Best-effort for already-loaded audio.
    });
  }, [audioSettings.speed]);

  useEffect(() => {
    const previousReciterId = lastAudioReciterIdRef.current;
    lastAudioReciterIdRef.current = audioSettings.reciterId;
    if (!audioSettingsHydrated || previousReciterId === audioSettings.reciterId) return;
    const player = audioPlayerRef.current;
    if (!player || player.status === "loading") return;
    void startAudioQueueAt({
      queue: player.queue,
      index: player.index,
      ayahRepeatPass: player.ayahRepeatPass,
      rangeRepeatPass: player.rangeRepeatPass,
      sourceLabel: player.sourceLabel,
      shouldPlay: player.status === "playing",
    });
  }, [audioSettings.reciterId, audioSettingsHydrated]);

  useEffect(() => {
    let cancelled = false;
    setPageVerses([]);

    fetchVersesByPage(currentPage)
      .then((verses) => {
        if (cancelled) return;
        setPageVerses(verses);
      })
      .catch(() => {
        if (cancelled) return;
        setPageVerses([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    setBlindRevealed(false);
    setSelectedAyah((current) => (current?.pageNumber === currentPage ? current : null));
  }, [currentPage]);

  useEffect(() => {
    if (initialPage === null) return;
    const nextRead: RecentRead = {
      page: currentPage,
      surahNumber: currentSurah.number,
      surahName: currentSurah.name,
      timestamp: Date.now(),
    };

    setRecentReads((current) => {
      const next = [
        nextRead,
        ...current.filter(
          (item) => item.page !== currentPage && item.surahNumber !== currentSurah.number,
        ),
      ].slice(0, RECENT_READ_LIMIT);

      AsyncStorage.setItem(recentReadStorageKey(childId), JSON.stringify(next)).catch(() => {
        // Best-effort only.
      });

      return next;
    });
  }, [childId, currentPage, currentSurah.name, currentSurah.number, initialPage]);

  function goToPage(page: number, closeJump = false) {
    const target = clampMushafPage(page);
    const targetIndex = target - 1;
    const itemLength = mushafViewMode === "scroll" ? scrollPageItemHeight : screenW;
    programmaticPageChangeRef.current = true;
    setCurrentPage(target);
    setSaveError(null);
    setSaveStatus("idle");
    try {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
    } catch {
      try {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, targetIndex * itemLength),
          animated: false,
        });
      } catch {
        // The current list orientation may be remounting.
      }
    }
    if (closeJump) {
      setJumpOpen(false);
      setJumpQuery("");
      setPageInput("");
    }
  }

  function updateVisiblePageFromScroll(page: number, save = true) {
    const target = clampMushafPage(page);
    if (target !== currentPage) {
      programmaticPageChangeRef.current = false;
      setCurrentPage(target);
      setSaveError(null);
      setSaveStatus("idle");
    }
    if (save) scheduleAutoSave(target);
  }

  function handleSwipeMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(event.nativeEvent.contentOffset.x / screenW);
    updateVisiblePageFromScroll(idx + 1);
  }

  function handleScrollMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(event.nativeEvent.contentOffset.y / scrollPageItemHeight);
    updateVisiblePageFromScroll(idx + 1);
  }

  function handleScrollScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(event.nativeEvent.contentOffset.y / scrollPageItemHeight);
    updateVisiblePageFromScroll(idx + 1);
  }

  function updateMushafViewMode(mode: MushafViewMode) {
    if (mode === mushafViewMode) return;
    const nextProfileSettings = { ...profileSettings, mushafViewMode: mode };
    programmaticPageChangeRef.current = true;
    setMushafViewMode(mode);
    setProfileSettings(nextProfileSettings);
    void saveProfileSettings(childId, nextProfileSettings);
  }

  async function savePage(page: number) {
    const target = clampMushafPage(page);
    setSaveStatus("saving");
    setSaveError(null);

    try {
      await apiFetch<ReadingProgressResponse>(
        `/api/children/${childId}/reading-progress`,
        {
          method: "POST",
          body: JSON.stringify({ currentPage: target }),
        },
      );

      setSaveStatus("saved");
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  function scheduleAutoSave(page: number) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void savePage(page);
    }, 2000);
  }

  function submitPageInput() {
    const page = parsePositiveInteger(pageInput);
    if (page === null) return;
    goToPage(page, true);
  }

  function jumpToSurah(surah: MushafSurah) {
    goToPage(surah.startPage, true);
  }

  function jumpToJuz(juz: MushafJuz) {
    goToPage(juz.startPage, true);
  }

  function toggleBookmark(page = currentPage) {
    const target = clampMushafPage(page);
    setBookmarkError(null);
    setBookmarkedPages((current) => {
      const next = current.includes(target)
        ? current.filter((savedPage) => savedPage !== target)
        : [target, ...current.filter((savedPage) => savedPage !== target)].slice(0, BOOKMARK_LIMIT);
      AsyncStorage.setItem(bookmarkStorageKey(childId), JSON.stringify(next)).catch(() => {
        setBookmarkError("Bookmark could not save.");
      });
      return next;
    });
  }

  function persistAnnotations(next: MushafAnnotations) {
    AsyncStorage.setItem(mushafAnnotationStorageKey(childId), JSON.stringify(next)).catch(() => {
      setAnnotationError("Ayah annotations could not save.");
    });
  }

  function updateAnnotations(updater: (current: MushafAnnotations) => MushafAnnotations) {
    setAnnotationError(null);
    setAnnotations((current) => {
      const next = updater(current);
      persistAnnotations(next);
      return next;
    });
  }

  function toggleAyahBookmark(target: PageAyahTarget) {
    updateAnnotations((current) => {
      const bookmarks = { ...current.bookmarks };
      if (bookmarks[target.verseKey]) {
        delete bookmarks[target.verseKey];
      } else {
        bookmarks[target.verseKey] = mushafAnnotationRecordFromTarget(target);
      }
      return { ...current, bookmarks };
    });
  }

  function setAyahHighlight(target: PageAyahTarget, color: HighlightColor | null) {
    updateAnnotations((current) => {
      const highlights = { ...current.highlights };
      if (!color) {
        delete highlights[target.verseKey];
      } else {
        highlights[target.verseKey] = {
          ...mushafAnnotationRecordFromTarget(target),
          color,
        };
      }
      return { ...current, highlights };
    });
  }

  function saveAyahNote(target: PageAyahTarget, text: string) {
    const clean = text.trim();
    updateAnnotations((current) => {
      const notes = { ...current.notes };
      if (!clean) {
        delete notes[target.verseKey];
      } else {
        notes[target.verseKey] = {
          ...mushafAnnotationRecordFromTarget(target),
          text: clean,
          updatedAt: Date.now(),
        };
      }
      return { ...current, notes };
    });
  }

  async function unloadCurrentMushafAudio() {
    const sound = audioSoundRef.current;
    audioSoundRef.current = null;
    if (!sound) return;
    sound.setOnPlaybackStatusUpdate(null);
    try {
      await sound.unloadAsync();
    } catch {
      // Best-effort cleanup.
    }
  }

  async function stopMushafAudio() {
    audioTokenRef.current += 1;
    await unloadCurrentMushafAudio();
    setAudioPlayer(null);
    setAudioError(null);
  }

  async function startAudioQueueAt({
    queue,
    index,
    ayahRepeatPass,
    rangeRepeatPass,
    sourceLabel,
    shouldPlay = true,
  }: {
    queue: PageAyahTarget[];
    index: number;
    ayahRepeatPass: number;
    rangeRepeatPass: number;
    sourceLabel: string;
    shouldPlay?: boolean;
  }) {
    const target = queue[index];
    if (!target) return;
    const token = audioTokenRef.current + 1;
    audioTokenRef.current = token;
    const settings = audioSettingsRef.current;
    const reciter = findReciter(settings.reciterId);
    setAudioError(null);
    setAudioPlayer({
      status: "loading",
      queue,
      index,
      ayahRepeatPass,
      rangeRepeatPass,
      sourceLabel,
    });
    if (target.pageNumber !== currentPage) {
      goToPage(target.pageNumber);
    }

    try {
      await unloadCurrentMushafAudio();
      const { sound } = await Audio.Sound.createAsync(
        { uri: ayahAudioUrl(reciter, target.surahNumber, target.ayahNumber) },
        {
          shouldPlay,
          rate: settings.speed,
          shouldCorrectPitch: true,
        },
        (status) => {
          if (!status.isLoaded || !status.didJustFinish) return;
          void handleMushafAudioFinished(token);
        },
      );
      if (token !== audioTokenRef.current) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      audioSoundRef.current = sound;
      setAudioPlayer({
        status: shouldPlay ? "playing" : "paused",
        queue,
        index,
        ayahRepeatPass,
        rangeRepeatPass,
        sourceLabel,
      });
    } catch (error) {
      if (token !== audioTokenRef.current) return;
      await unloadCurrentMushafAudio();
      setAudioPlayer(null);
      setAudioError(error instanceof Error ? error.message : "Audio could not play.");
    }
  }

  async function handleMushafAudioFinished(token: number) {
    if (token !== audioTokenRef.current) return;
    const player = audioPlayerRef.current;
    if (!player) return;
    const settings = audioSettingsRef.current;

    if (player.ayahRepeatPass < settings.ayahRepeat) {
      await startAudioQueueAt({
        queue: player.queue,
        index: player.index,
        ayahRepeatPass: player.ayahRepeatPass + 1,
        rangeRepeatPass: player.rangeRepeatPass,
        sourceLabel: player.sourceLabel,
      });
      return;
    }

    if (player.index < player.queue.length - 1) {
      await startAudioQueueAt({
        queue: player.queue,
        index: player.index + 1,
        ayahRepeatPass: 1,
        rangeRepeatPass: player.rangeRepeatPass,
        sourceLabel: player.sourceLabel,
      });
      return;
    }

    if (player.rangeRepeatPass < settings.rangeRepeat) {
      await startAudioQueueAt({
        queue: player.queue,
        index: 0,
        ayahRepeatPass: 1,
        rangeRepeatPass: player.rangeRepeatPass + 1,
        sourceLabel: player.sourceLabel,
      });
      return;
    }

    await stopMushafAudio();
  }

  async function playAudioTargets(targets: PageAyahTarget[], sourceLabel: string) {
    const queue = sortAyahTargets(targets);
    if (queue.length === 0) {
      Alert.alert("No ayahs ready", "Try again after the page finishes loading.");
      return;
    }
    await startAudioQueueAt({
      queue,
      index: 0,
      ayahRepeatPass: 1,
      rangeRepeatPass: 1,
      sourceLabel,
    });
  }

  async function toggleMushafAudio() {
    const player = audioPlayerRef.current;
    const sound = audioSoundRef.current;
    if (!player || !sound || player.status === "loading") return;
    try {
      if (player.status === "playing") {
        await sound.pauseAsync();
        setAudioPlayer({ ...player, status: "paused" });
      } else {
        await sound.playAsync();
        setAudioPlayer({ ...player, status: "playing" });
      }
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "Audio control failed.");
    }
  }

  function jumpMushafAudio(delta: -1 | 1) {
    const player = audioPlayerRef.current;
    if (!player || player.queue.length === 0) return;
    const settings = audioSettingsRef.current;
    let nextIndex = player.index + delta;
    let nextRangePass = player.rangeRepeatPass;

    if (nextIndex < 0) {
      if (nextRangePass <= 1) return;
      nextRangePass -= 1;
      nextIndex = player.queue.length - 1;
    }

    if (nextIndex >= player.queue.length) {
      if (nextRangePass >= settings.rangeRepeat) return;
      nextRangePass += 1;
      nextIndex = 0;
    }

    void startAudioQueueAt({
      queue: player.queue,
      index: nextIndex,
      ayahRepeatPass: 1,
      rangeRepeatPass: nextRangePass,
      sourceLabel: player.sourceLabel,
    });
  }

  function playAyahAudio(target: PageAyahTarget) {
    setSelectedAyah(null);
    void playAudioTargets([target], formatTargetRange([target]));
  }

  function playFromAyah(target: PageAyahTarget) {
    const queue = buildSurahPlaybackQueue(target, pageAyahs);
    setSelectedAyah(null);
    void playAudioTargets(queue, `${formatTargetRange([target])} onward`);
  }

  function toggleToolMode(mode: ToolMode) {
    setToolMode((current) => {
      const next = current === mode ? "none" : mode;
      if (next !== "blind") setBlindRevealed(false);
      return next;
    });
  }

  function openAyahActions(target: PageAyahTarget) {
    setSelectedAyah(target);
  }

  function openAnnotatedAyah(target: PageAyahTarget) {
    goToPage(target.pageNumber, true);
    setSelectedAyah(target);
  }

  function navigateAyahSheet(target: PageAyahTarget) {
    setSelectedAyah(target);
    if (target.pageNumber !== currentPage) {
      goToPage(target.pageNumber, false);
    }
  }

  function openMemorizationFromAyah(target: PageAyahTarget, options?: { recite?: boolean }) {
    setSelectedAyah(null);
    void stopMushafAudio();
    router.push({
      pathname: "/child/[childId]/memorization",
      params: {
        childId,
        name: name ?? "",
        surahNumber: String(target.surahNumber),
        ayahStart: String(target.ayahNumber),
        ayahEnd: String(target.ayahNumber),
        pageStart: String(target.pageNumber),
        pageEnd: String(target.pageNumber),
        session: "1",
        recite: options?.recite ? "1" : undefined,
        viewMode: options?.recite ? "page" : undefined,
      },
    });
  }

  function reciteFromAyah(target: PageAyahTarget) {
    openMemorizationFromAyah(target, { recite: true });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
        </Pressable>
        <Pressable
          style={styles.surahPill}
          onPress={() => setJumpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Quran jump search"
        >
          <Text style={styles.surahPillTitle} numberOfLines={1}>
            {currentSurah.number}. {currentSurah.name}
          </Text>
          <Text style={styles.surahPillMeta} numberOfLines={1}>
            Page {currentPage} · Juz {currentJuz} · Hafs
          </Text>
        </Pressable>
        <Pressable
          style={styles.headerInfoButton}
          onPress={() => setAttributionOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Mushaf credits"
        >
          <Ionicons name="information-circle-outline" size={21} color="#2563eb" />
        </Pressable>
      </View>

      {saveStatus === "error" && saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      )}
      {bookmarkError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{bookmarkError}</Text>
        </View>
      )}
      {annotationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{annotationError}</Text>
        </View>
      )}
      {audioError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{audioError}</Text>
        </View>
      )}

      {initialPage === null ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingCenterText}>Loading saved page</Text>
        </View>
      ) : (
        mushafViewMode === "scroll" ? (
          <FlatList
            key="reading-mushaf-scroll"
            ref={listRef}
            style={styles.pageList}
            data={data}
            keyExtractor={(page) => String(page)}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={currentPage - 1}
            getItemLayout={getScrollItemLayout}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                try {
                  listRef.current?.scrollToIndex({ index: info.index, animated: false });
                } catch {
                  listRef.current?.scrollToOffset({
                    offset: Math.max(0, info.index * scrollPageItemHeight),
                    animated: false,
                  });
                }
              }, 80);
            }}
            onMomentumScrollEnd={handleScrollMomentumEnd}
            onScroll={handleScrollScroll}
            scrollEventThrottle={64}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            renderItem={({ item }) => (
              <View style={{ width: screenW, height: scrollPageItemHeight }}>
                <PageView
                  pageNumber={item}
                  width={screenW}
                  toolMode={toolMode}
                  blindRevealed={blindRevealed}
                  highlightedVerseKeys={highlightedVerseKeys}
                  activeVerseKey={activeVerseKey}
                  onRevealBlindPage={() => setBlindRevealed(true)}
                  onOpenAyah={openAyahActions}
                  onStartRecite={reciteFromAyah}
                />
              </View>
            )}
          />
        ) : (
          <FlatList
            key="reading-mushaf-swipe"
            ref={listRef}
            style={styles.pageList}
            data={data}
            keyExtractor={(page) => String(page)}
            horizontal
            pagingEnabled
            inverted
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={currentPage - 1}
            getItemLayout={getSwipeItemLayout}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                try {
                  listRef.current?.scrollToIndex({ index: info.index, animated: false });
                } catch {
                  listRef.current?.scrollToOffset({
                    offset: Math.max(0, info.index * screenW),
                    animated: false,
                  });
                }
              }, 80);
            }}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            onMomentumScrollEnd={handleSwipeMomentumEnd}
            renderItem={({ item }) => (
              <PageView
                pageNumber={item}
                width={screenW}
                toolMode={toolMode}
                blindRevealed={blindRevealed}
                highlightedVerseKeys={highlightedVerseKeys}
                activeVerseKey={activeVerseKey}
                onRevealBlindPage={() => setBlindRevealed(true)}
                onOpenAyah={openAyahActions}
                onStartRecite={reciteFromAyah}
              />
            )}
          />
        )
      )}

      {initialPage !== null ? (
        <View style={styles.controlSlot}>
          <View style={styles.viewModeSegment}>
            {(["swipe", "scroll"] as const).map((mode) => {
              const active = mushafViewMode === mode;
              return (
                <Pressable
                  key={mode}
                  style={[
                    styles.viewModePill,
                    active && styles.viewModePillSelected,
                  ]}
                  onPress={() => updateMushafViewMode(mode)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Use ${mode} Mushaf view`}
                >
                  <Ionicons
                    name={mode === "swipe" ? "swap-horizontal-outline" : "reorder-four-outline"}
                    size={15}
                    color={active ? "#ffffff" : "#475569"}
                  />
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
          {audioPlayer ? (
            <MushafAudioBar
              player={audioPlayer}
              settings={audioSettings}
              onToggle={() => void toggleMushafAudio()}
              onStop={() => void stopMushafAudio()}
              onPrevious={() => jumpMushafAudio(-1)}
              onNext={() => jumpMushafAudio(1)}
              onOpenSettings={() => setAudioSettingsOpen(true)}
            />
          ) : (
            <View style={styles.controlPills}>
              <ToolButton
                label="Blind"
                iconName={toolMode === "blind" ? "eye-off-outline" : "eye-outline"}
                color="#7c3aed"
                active={toolMode === "blind"}
                onPress={() => toggleToolMode("blind")}
              />
              <ToolButton
                label="Recite"
                iconName="mic-outline"
                color="#be123c"
                active={toolMode === "recite"}
                onPress={() => toggleToolMode("recite")}
              />
            </View>
          )}
        </View>
      ) : null}

      <AyahActionSheet
        target={selectedAyah}
        pageBookmarked={selectedAyah ? bookmarkedPages.includes(selectedAyah.pageNumber) : false}
        annotations={annotations}
        pageAyahs={pageAyahs}
        onClose={() => setSelectedAyah(null)}
        onNavigate={navigateAyahSheet}
        onOpenMemorization={openMemorizationFromAyah}
        onPlayAyah={playAyahAudio}
        onPlayFromHere={playFromAyah}
        onReciteFromAyah={reciteFromAyah}
        onSavePage={(target) => void savePage(target.pageNumber)}
        onTogglePageBookmark={(target) => toggleBookmark(target.pageNumber)}
        onToggleBookmark={toggleAyahBookmark}
        onSetHighlight={setAyahHighlight}
        onSaveNote={saveAyahNote}
      />

      <MushafAudioSettingsModal
        visible={audioSettingsOpen}
        settings={audioSettings}
        onChange={setAudioSettings}
        onClose={() => setAudioSettingsOpen(false)}
      />

      <Modal
        visible={attributionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttributionOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAttributionOpen(false)} />
        <View style={styles.creditModalWrap}>
          <View style={styles.creditModal}>
            <View style={styles.creditHeader}>
              <View style={styles.creditIcon}>
                <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
              </View>
              <Text style={styles.creditTitle}>Mushaf credits</Text>
              <Pressable
                style={styles.creditClose}
                onPress={() => setAttributionOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close credits"
              >
                <Ionicons name="close" size={18} color="#6b7280" />
              </Pressable>
            </View>
            <Text style={styles.creditText}>
              Mushaf images: King Fahd Glorious Qur'an Printing Complex (Madinah print, 1405H/2003 edition)
            </Text>
            <Text style={styles.creditText}>
              Distributed under King Fahd Complex's free-use rights for non-commercial software and educational apps
            </Text>
            <Text style={styles.creditText}>
              Image set extracted from Quran.com QuranEngine (Apache 2.0, github.com/quran/quran-ios)
            </Text>
            <Text style={styles.creditText}>
              Original page rendering pattern adapted from open-mushaf-native (MIT, github.com/adelpro/open-mushaf-native)
            </Text>
          </View>
        </View>
      </Modal>

      <Modal visible={jumpOpen} animationType="slide" onRequestClose={() => setJumpOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable style={styles.sheetClose} onPress={() => setJumpOpen(false)}>
              <Ionicons name="chevron-down" size={22} color="#2563eb" />
            </Pressable>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle}>Jump in Quran</Text>
              <Text style={styles.sheetSubtitle}>Page, surah, juz, bookmark, or recent read</Text>
            </View>
            <View style={styles.sheetHeaderSpacer} />
          </View>

          <View style={styles.pageJumpCard}>
            <Text style={styles.sectionLabel}>Page jump</Text>
            <View style={styles.pageInputRow}>
              <TextInput
                value={pageInput}
                onChangeText={setPageInput}
                placeholder={`Current ${currentPage}`}
                keyboardType="number-pad"
                returnKeyType="go"
                onSubmitEditing={submitPageInput}
                style={styles.pageInput}
              />
              <Pressable style={styles.pageInputButton} onPress={submitPageInput}>
                <Text style={styles.pageInputButtonText}>Go</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              value={jumpQuery}
              onChangeText={setJumpQuery}
              placeholder="Search surahs, pages, or juz"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {jumpQuery ? (
              <Pressable onPress={() => setJumpQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            {pageResult !== null || surahResult || juzResult ? (
              <View style={styles.resultGroup}>
                <Text style={styles.sectionLabel}>Quick match</Text>
                {pageResult !== null ? (
                  <JumpRow
                    title={`Page ${pageResult}`}
                    detail={`Juz ${getJuzForMushafPage(pageResult)} · ${
                      getMushafSurahForPage(pageResult).name
                    }`}
                    iconName="reader-outline"
                    color="#2563eb"
                    trailing={`p. ${pageResult}`}
                    onPress={() => goToPage(pageResult, true)}
                  />
                ) : null}
                {surahResult ? (
                  <JumpRow
                    title={`${surahResult.number}. ${surahResult.name}`}
                    detail={`${surahResult.translation} · ${surahResult.verseCount} ayahs`}
                    iconName="book-outline"
                    color="#0f766e"
                    trailing={`p. ${surahResult.startPage}`}
                    onPress={() => jumpToSurah(surahResult)}
                  />
                ) : null}
                {juzResult ? (
                  <JumpRow
                    title={`Juz ${juzResult.number}`}
                    detail={`Pages ${juzResult.startPage}-${juzResult.endPage}`}
                    iconName="albums-outline"
                    color="#7c3aed"
                    trailing={`p. ${juzResult.startPage}`}
                    onPress={() => jumpToJuz(juzResult)}
                  />
                ) : null}
              </View>
            ) : null}

            {recentReads.length > 0 && !jumpQuery.trim() ? (
              <View style={styles.resultGroup}>
                <Text style={styles.sectionLabel}>Recent reads</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentScroller}
                >
                  {recentReads.map((read) => (
                    <Pressable
                      key={`${read.surahNumber}-${read.page}`}
                      style={styles.recentChip}
                      onPress={() => goToPage(read.page, true)}
                    >
                      <Text style={styles.recentChipTitle} numberOfLines={1}>
                        {read.surahName}
                      </Text>
                      <Text style={styles.recentChipDetail}>Page {read.page}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {ayahBookmarkEntries.length > 0 ? (
              <View style={styles.resultGroup}>
                <Text style={styles.sectionLabel}>Ayah bookmarks</Text>
                {ayahBookmarkEntries.map((target) => {
                  const surah = MUSHAF_SURAHS[target.surahNumber - 1];
                  return (
                    <JumpRow
                      key={target.verseKey}
                      title={`${surah?.name ?? `Surah ${target.surahNumber}`} ${formatVerseLabel(target)}`}
                      detail={`Page ${target.pageNumber} · open ayah actions`}
                      iconName="bookmark-outline"
                      color="#b45309"
                      trailing={formatVerseLabel(target)}
                      onPress={() => openAnnotatedAyah(target)}
                    />
                  );
                })}
              </View>
            ) : null}

            {bookmarkedPages.length > 0 ? (
              <View style={styles.resultGroup}>
                <Text style={styles.sectionLabel}>Bookmarks</Text>
                {bookmarkedPages.map((page) => {
                  const surah = getMushafSurahForPage(page);
                  return (
                    <JumpRow
                      key={page}
                      title={`Page ${page}`}
                      detail={`${surah.number}. ${surah.name} · Juz ${getJuzForMushafPage(page)}`}
                      iconName="bookmark-outline"
                      color="#0f766e"
                      trailing={`p. ${page}`}
                      onPress={() => goToPage(page, true)}
                    />
                  );
                })}
              </View>
            ) : null}

            <View style={styles.resultGroup}>
              <Text style={styles.sectionLabel}>Juz jump</Text>
              <View style={styles.juzGrid}>
                {juzResults.map((juz) => (
                  <JuzChip key={juz.number} item={juz} onPress={() => jumpToJuz(juz)} />
                ))}
              </View>
            </View>

            <View style={styles.resultGroup}>
              <Text style={styles.sectionLabel}>Surahs</Text>
              {surahResults.map((surah) => (
                <JumpRow
                  key={surah.number}
                  title={`${surah.number}. ${surah.name}`}
                  detail={`${surah.translation} · ${surah.verseCount} ayahs · Juz ${surah.juzStart}`}
                  iconName="book-outline"
                  color={surah.number === currentSurah.number ? "#2563eb" : "#111827"}
                  trailing={`p. ${surah.startPage}`}
                  onPress={() => jumpToSurah(surah)}
                />
              ))}
              {surahResults.length === 0 ? (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsTitle}>No surahs found</Text>
                  <Text style={styles.emptyResultsDetail}>Try a page number, juz number, or surah name.</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
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
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  surahPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  surahPillTitle: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "900",
    textAlign: "center",
  },
  surahPillMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#666666",
    fontWeight: "800",
    textAlign: "center",
  },
  headerInfoButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  controlSlot: {
    height: MUSHAF_CONTROL_SLOT_HEIGHT,
    backgroundColor: "#f5efe0",
    borderTopWidth: 1,
    borderTopColor: "#e3d5bd",
    justifyContent: "center",
    paddingBottom: 10,
  },
  controlPills: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  viewModeSegment: {
    alignSelf: "center",
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderWidth: 1,
    borderColor: "#e3d5bd",
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    marginBottom: 10,
  },
  viewModePill: {
    minWidth: 92,
    minHeight: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
  },
  viewModePillSelected: {
    backgroundColor: "#2563eb",
  },
  viewModePillText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "900",
  },
  viewModePillTextSelected: {
    color: "#ffffff",
  },
  toolButton: {
    minWidth: 108,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toolButtonText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "900",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  errorBannerText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "700",
  },
  loadingCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingCenterText: {
    fontSize: 13,
    color: "#666666",
    fontWeight: "700",
  },
  pageList: {
    flex: 1,
  },
  pageWrap: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    backgroundColor: "#f8fafc",
  },
  pageImageShell: {
    flex: 1,
    width: "100%",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    position: "relative",
  },
  quranCom1405ImageShell: {
    flex: 0,
    aspectRatio: QURAN_COM_1405_PAGE_ASPECT_RATIO,
  },
  pageImage: {
    width: "100%",
    flex: 1,
  },
  pageBackgroundPressable: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  ayahTapOverlay: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 4,
  },
  ayahTapOverlayHighlighted: {
    backgroundColor: "rgba(250, 204, 21, 0.2)",
  },
  ayahTapOverlayActive: {
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.48)",
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
  blindOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
    zIndex: 12,
  },
  blindOverlayTitle: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "900",
  },
  blindOverlayText: {
    fontSize: 13,
    color: "#d1d5db",
    fontWeight: "700",
    textAlign: "center",
  },
  modeOverlayHint: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 10,
  },
  modeOverlayHintText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "900",
  },
  modeOverlayHintTextRecite: {
    color: "#be123c",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fef2f2",
  },
  errorTitle: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "700",
    marginBottom: 4,
  },
  errorBody: {
    fontSize: 11,
    color: "#dc2626",
    textAlign: "center",
  },
  audioBar: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 12,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  audioBarTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  audioNowPlaying: {
    flex: 1,
  },
  audioKicker: {
    fontSize: 10,
    color: "#2563eb",
    fontWeight: "900",
    textTransform: "uppercase",
  },
  audioTitle: {
    marginTop: 2,
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },
  audioMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#4b5563",
    fontWeight: "700",
  },
  audioIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  audioControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioRoundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  audioRoundButtonDisabled: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  audioPrimaryRoundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  audioStopButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  audioStopButtonText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "900",
  },
  sheet: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  sheetHeader: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetClose: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitleBlock: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 20,
    color: "#111827",
    fontWeight: "900",
  },
  sheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#666666",
    fontWeight: "700",
  },
  sheetHeaderSpacer: {
    width: 38,
  },
  ayahAnnotationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
  },
  creditModalWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  creditModal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  creditHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  creditIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  creditTitle: {
    flex: 1,
    fontSize: 17,
    color: "#111827",
    fontWeight: "900",
  },
  creditClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  creditText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#374151",
    fontWeight: "700",
  },
  ayahKeyboardAvoider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  ayahActionSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#ffffff",
    paddingTop: 10,
    overflow: "hidden",
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginBottom: 10,
  },
  ayahActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
  },
  ayahActionTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  ayahActionTitle: {
    fontSize: 19,
    color: "#111827",
    fontWeight: "900",
  },
  ayahActionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#666666",
    fontWeight: "700",
  },
  ayahActionClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  ayahActionScroll: {
    maxHeight: "100%",
  },
  ayahActionContent: {
    paddingHorizontal: 18,
    paddingBottom: 34,
    gap: 12,
  },
  ayahPreviewCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  ayahPreviewText: {
    fontSize: 22,
    lineHeight: 40,
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  ayahMetaGrid: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  ayahMetaPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  ayahMetaLabel: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  ayahMetaValue: {
    marginTop: 2,
    fontSize: 13,
    color: "#111827",
    fontWeight: "900",
  },
  ayahStatusRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ayahStatusChip: {
    minHeight: 24,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ayahStatusChipText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "800",
  },
  ayahPrimaryButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ayahPrimaryButtonText: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "900",
  },
  ayahMenuGroup: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  ayahMenuRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  ayahMenuRowText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
  },
  ayahNavigationRow: {
    flexDirection: "row",
    gap: 10,
  },
  ayahNavButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  ayahNavButtonDisabled: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  ayahNavButtonText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "900",
  },
  ayahNavButtonTextDisabled: {
    color: "#9ca3af",
  },
  ayahSubHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ayahSubBack: {
    width: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ayahSubBackText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
  },
  ayahSubTitle: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    fontWeight: "900",
    textAlign: "center",
  },
  ayahSubHeaderSpacer: {
    width: 92,
  },
  highlightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  highlightSwatch: {
    width: "47%",
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  highlightSwatchDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  highlightSwatchText: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "900",
  },
  ayahDangerButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  ayahDangerButtonText: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "900",
  },
  noteEditor: {
    gap: 10,
  },
  noteEditorMeta: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "800",
  },
  noteInput: {
    minHeight: 128,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    padding: 12,
    color: "#111827",
    fontSize: 15,
    lineHeight: 21,
  },
  noteButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  noteSaveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  noteSaveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  noteDeleteButton: {
    minWidth: 88,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  noteDeleteButtonText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "900",
  },
  ayahTextPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  ayahTextPanelArabic: {
    fontSize: 22,
    lineHeight: 38,
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  ayahTextPanelSource: {
    marginTop: 8,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "800",
  },
  ayahLongText: {
    fontSize: 15,
    lineHeight: 26,
    color: "#374151",
    fontWeight: "600",
  },
  expandToggle: {
    alignSelf: "flex-start",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  expandToggleText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
  },
  ayahContentState: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 8,
  },
  ayahContentStateTitle: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
    textAlign: "center",
  },
  ayahContentStateText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "700",
    textAlign: "center",
  },
  wbwGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wbwCard: {
    width: "31%",
    minHeight: 116,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 8,
    alignItems: "center",
  },
  wbwArabic: {
    fontSize: 20,
    lineHeight: 30,
    color: "#111827",
    textAlign: "center",
    writingDirection: "rtl",
  },
  wbwTransliteration: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 13,
    color: "#6b7280",
    fontWeight: "700",
    textAlign: "center",
  },
  wbwTranslation: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 13,
    color: "#374151",
    fontWeight: "700",
    textAlign: "center",
  },
  pageJumpCard: {
    margin: 16,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 8,
  },
  pageInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  pageInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#111827",
    fontWeight: "700",
  },
  pageInputButton: {
    minWidth: 70,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  pageInputButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 16,
  },
  audioSettingsContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 18,
  },
  audioSettingsGroup: {
    gap: 10,
  },
  reciterRow: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reciterRowSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  reciterTextBlock: {
    flex: 1,
  },
  reciterName: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "900",
  },
  reciterNameSelected: {
    color: "#1d4ed8",
  },
  reciterStyle: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
  },
  optionChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    minHeight: 36,
    minWidth: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionChipSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  optionChipText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "900",
  },
  optionChipTextSelected: {
    color: "#1d4ed8",
  },
  resultGroup: {
    gap: 8,
  },
  recentScroller: {
    gap: 8,
    paddingRight: 16,
  },
  recentChip: {
    width: 128,
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  recentChipTitle: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "900",
  },
  recentChipDetail: {
    marginTop: 3,
    fontSize: 11,
    color: "#666666",
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "900",
    textTransform: "uppercase",
  },
  jumpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  jumpIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  jumpTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  jumpTitle: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },
  jumpDetail: {
    marginTop: 2,
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
  jumpTrailing: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "900",
  },
  juzGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  juzChip: {
    width: "23%",
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  juzChipTitle: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "900",
  },
  juzChipDetail: {
    fontSize: 10,
    color: "#666666",
    fontWeight: "700",
  },
  emptyResults: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 4,
  },
  emptyResultsTitle: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "900",
  },
  emptyResultsDetail: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
});
