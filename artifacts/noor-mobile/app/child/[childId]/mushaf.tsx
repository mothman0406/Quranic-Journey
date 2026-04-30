import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/src/lib/api";
import { fetchVersesByPage, type ApiPageVerse } from "@/src/lib/quran";
import {
  MUSHAF_JUZS,
  MUSHAF_SURAHS,
  clampMushafPage,
  getJuzForMushafPage,
  getMushafSurahForPage,
  mushafPageUrl,
  searchMushafSurahs,
  TOTAL_MUSHAF_PAGES,
  type MushafJuz,
  type MushafSurah,
} from "@/src/lib/mushaf";

const PAGE_ASPECT_RATIO = 1.45;
const PRESET_PAGES = [1, 50, 300, TOTAL_MUSHAF_PAGES] as const;
const BOOKMARK_LIMIT = 12;
const RECENT_READ_LIMIT = 5;
const QURAN_API = "https://api.quran.com/api/v4";

type ReadingStatus = "not_started" | "in_progress" | "completed";
type ToolMode = "none" | "blind" | "select" | "recite";
type HighlightColor = "yellow" | "green" | "blue" | "pink";
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
type PageVerseStatus = "idle" | "loading" | "ready" | "error";

type RecentRead = {
  page: number;
  surahNumber: number;
  surahName: string;
  timestamp: number;
};

type PageAyahTarget = {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  textUthmani: string;
};

type AyahAnnotationRecord = PageAyahTarget & {
  savedAt: number;
};

type AyahHighlightRecord = AyahAnnotationRecord & {
  color: HighlightColor;
};

type AyahNoteRecord = AyahAnnotationRecord & {
  text: string;
  updatedAt: number;
};

type MushafAnnotations = {
  bookmarks: Record<string, AyahAnnotationRecord>;
  highlights: Record<string, AyahHighlightRecord>;
  notes: Record<string, AyahNoteRecord>;
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

function annotationStorageKey(childId: string | undefined) {
  return `noorpath:mushaf:annotations:${childId ?? "unknown"}`;
}

function formatPageCount(value: number) {
  const formatted = Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
  return `${formatted} page${value === 1 ? "" : "s"}`;
}

function formatGoalCopy(goal: ReadingGoal | null) {
  if (!goal?.isEnabled) return "No reading target set";
  const completed = goal.completedPages ?? 0;
  const target = goal.targetPages ?? 0;
  if (goal.status === "completed") {
    return `Target complete: ${formatPageCount(completed)} of ${formatPageCount(target)} counted today`;
  }
  return `Today counted: ${formatPageCount(completed)} of ${formatPageCount(target)}`;
}

function progressRatio(goal: ReadingGoal | null) {
  if (!goal?.isEnabled || goal.targetPages <= 0) return 0;
  return Math.max(0, Math.min(1, (goal.completedPages ?? 0) / goal.targetPages));
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

function emptyAnnotations(): MushafAnnotations {
  return { bookmarks: {}, highlights: {}, notes: {} };
}

function isHighlightColor(value: unknown): value is HighlightColor {
  return value === "yellow" || value === "green" || value === "blue" || value === "pink";
}

function normalizeAnnotationRecord(value: unknown): AyahAnnotationRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const verseKey = typeof record.verseKey === "string" ? record.verseKey : "";
  const parsed = parseVerseKey(verseKey);
  const pageNumber = Number(record.pageNumber);
  const textUthmani = typeof record.textUthmani === "string" ? record.textUthmani : "";
  const savedAt = Number(record.savedAt);

  if (
    !parsed ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > TOTAL_MUSHAF_PAGES ||
    !textUthmani
  ) {
    return null;
  }

  return {
    verseKey,
    surahNumber: parsed.surahNumber,
    ayahNumber: parsed.ayahNumber,
    pageNumber,
    textUthmani,
    savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(),
  };
}

function normalizeAnnotations(raw: string | null): MushafAnnotations {
  if (!raw) return emptyAnnotations();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyAnnotations();
    const record = parsed as Record<string, unknown>;
    const bookmarks: MushafAnnotations["bookmarks"] = {};
    const highlights: MushafAnnotations["highlights"] = {};
    const notes: MushafAnnotations["notes"] = {};

    for (const [verseKey, value] of Object.entries((record.bookmarks as Record<string, unknown>) ?? {})) {
      const normalized = normalizeAnnotationRecord({ ...(value as object), verseKey });
      if (normalized) bookmarks[normalized.verseKey] = normalized;
    }

    for (const [verseKey, value] of Object.entries((record.highlights as Record<string, unknown>) ?? {})) {
      const normalized = normalizeAnnotationRecord({ ...(value as object), verseKey });
      const color = value && typeof value === "object" ? (value as Record<string, unknown>).color : null;
      if (normalized && isHighlightColor(color)) {
        highlights[normalized.verseKey] = { ...normalized, color };
      }
    }

    for (const [verseKey, value] of Object.entries((record.notes as Record<string, unknown>) ?? {})) {
      const normalized = normalizeAnnotationRecord({ ...(value as object), verseKey });
      const noteText = value && typeof value === "object" ? (value as Record<string, unknown>).text : null;
      const updatedAt = value && typeof value === "object" ? Number((value as Record<string, unknown>).updatedAt) : Date.now();
      if (normalized && typeof noteText === "string" && noteText.trim()) {
        notes[normalized.verseKey] = {
          ...normalized,
          text: noteText,
          updatedAt: Number.isFinite(updatedAt) ? updatedAt : normalized.savedAt,
        };
      }
    }

    return { bookmarks, highlights, notes };
  } catch {
    return emptyAnnotations();
  }
}

function annotationRecordFromTarget(target: PageAyahTarget): AyahAnnotationRecord {
  return {
    ...target,
    savedAt: Date.now(),
  };
}

function formatVerseLabel(target: Pick<PageAyahTarget, "surahNumber" | "ayahNumber">) {
  return `${target.surahNumber}:${target.ayahNumber}`;
}

function cleanTranslationHtml(raw: string): string {
  return raw
    .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAyahTranslation(verseKey: string): Promise<string> {
  const res = await fetch(`${QURAN_API}/verses/by_key/${verseKey}?translations=20`);
  if (!res.ok) throw new Error(`Translation unavailable (${res.status})`);
  const data = (await res.json()) as { verse?: { translations?: Array<{ text?: string }> } };
  const text = cleanTranslationHtml(data.verse?.translations?.[0]?.text ?? "");
  if (!text) throw new Error("Translation unavailable");
  return text;
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

function buildMemorizationContext({
  fromMemorization,
  surahNumber,
  ayahNumber,
}: {
  fromMemorization: SearchParamValue;
  surahNumber: SearchParamValue;
  ayahNumber: SearchParamValue;
}) {
  if (singleParam(fromMemorization) !== "1") return null;
  const surah = parsePositiveInteger(singleParam(surahNumber) ?? "");
  const ayah = parsePositiveInteger(singleParam(ayahNumber) ?? "");
  if (surah === null || ayah === null) return "Opened from Memorization";
  const surahMeta = MUSHAF_SURAHS.find((item) => item.number === surah);
  return `From Memorization · ${surahMeta?.name ?? `Surah ${surah}`} ${surah}:${ayah}`;
}

function PageView({
  pageNumber,
  width,
  toolMode,
  blindRevealed,
  onRevealBlindPage,
  onOpenAyahList,
}: {
  pageNumber: number;
  width: number;
  toolMode: ToolMode;
  blindRevealed: boolean;
  onRevealBlindPage: () => void;
  onOpenAyahList: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const height = width * PAGE_ASPECT_RATIO;
  const isBlindHidden = toolMode === "blind" && !blindRevealed;
  const canOpenAyahList = toolMode === "select" || toolMode === "recite";

  return (
    <View style={[styles.pageWrap, { width }]}>
      <Pressable
        style={[styles.pageCard, { width: width - 32, height: height - 80 }]}
        onPress={
          isBlindHidden
            ? onRevealBlindPage
            : canOpenAyahList
              ? onOpenAyahList
              : undefined
        }
      >
        {!loaded && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>page {pageNumber}</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Failed</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        )}
        <Image
          source={{ uri: mushafPageUrl(pageNumber) }}
          style={styles.pageImage}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={(e) => setError(e.nativeEvent.error ?? "unknown error")}
        />
        {isBlindHidden ? (
          <View style={styles.blindOverlay}>
            <Ionicons name="eye-off-outline" size={28} color="#ffffff" />
            <Text style={styles.blindOverlayTitle}>Blind mode</Text>
            <Text style={styles.blindOverlayText}>Tap to reveal this page when ready</Text>
          </View>
        ) : canOpenAyahList ? (
          <View style={styles.modeOverlayHint}>
            <Ionicons
              name={toolMode === "select" ? "checkmark-circle-outline" : "mic-outline"}
              size={15}
              color={toolMode === "select" ? "#047857" : "#be123c"}
            />
            <Text
              style={[
                styles.modeOverlayHintText,
                toolMode === "recite" && styles.modeOverlayHintTextRecite,
              ]}
            >
              Tap page to choose ayah
            </Text>
          </View>
        ) : null}
      </Pressable>
      <Text style={styles.pageNumberLabel}>
        {pageNumber} / {TOTAL_MUSHAF_PAGES}
      </Text>
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

function AyahListModal({
  visible,
  pageNumber,
  toolMode,
  pageAyahs,
  status,
  selectedVerseKeys,
  annotations,
  onClose,
  onOpenAyah,
  onToggleSelectedAyah,
  onStartRecite,
  onStartSelected,
}: {
  visible: boolean;
  pageNumber: number;
  toolMode: ToolMode;
  pageAyahs: PageAyahTarget[];
  status: PageVerseStatus;
  selectedVerseKeys: Set<string>;
  annotations: MushafAnnotations;
  onClose: () => void;
  onOpenAyah: (target: PageAyahTarget) => void;
  onToggleSelectedAyah: (target: PageAyahTarget) => void;
  onStartRecite: (target: PageAyahTarget) => void;
  onStartSelected: () => void;
}) {
  const selectedCount = selectedVerseKeys.size;
  const modeCopy =
    toolMode === "select"
      ? "Tap ayahs to build a range for memorization."
      : toolMode === "recite"
        ? "Pick the ayah where recitation should begin."
        : "Tap an ayah to open actions.";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Pressable style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="chevron-down" size={22} color="#2563eb" />
          </Pressable>
          <View style={styles.sheetTitleBlock}>
            <Text style={styles.sheetTitle}>Ayahs on Page {pageNumber}</Text>
            <Text style={styles.sheetSubtitle}>{modeCopy}</Text>
          </View>
          <View style={styles.sheetHeaderSpacer} />
        </View>

        {status === "loading" ? (
          <View style={styles.sheetCenter}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.sheetCenterText}>Loading ayahs</Text>
          </View>
        ) : status === "error" ? (
          <View style={styles.sheetCenter}>
            <Ionicons name="cloud-offline-outline" size={26} color="#dc2626" />
            <Text style={styles.sheetCenterTitle}>Ayahs could not load</Text>
            <Text style={styles.sheetCenterText}>The page image is still available.</Text>
          </View>
        ) : (
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.ayahListContent}>
            {pageAyahs.map((ayah) => {
              const selected = selectedVerseKeys.has(ayah.verseKey);
              const surah = MUSHAF_SURAHS[ayah.surahNumber - 1];
              const highlight = annotations.highlights[ayah.verseKey];
              const isBookmarked = !!annotations.bookmarks[ayah.verseKey];
              const hasNote = !!annotations.notes[ayah.verseKey];
              return (
                <Pressable
                  key={ayah.verseKey}
                  style={[
                    styles.ayahRow,
                    highlight && { backgroundColor: HIGHLIGHT_COLORS[highlight.color].bg },
                    selected && styles.ayahRowSelected,
                  ]}
                  onPress={() => {
                    if (toolMode === "select") {
                      onToggleSelectedAyah(ayah);
                    } else if (toolMode === "recite") {
                      onStartRecite(ayah);
                    } else {
                      onOpenAyah(ayah);
                    }
                  }}
                >
                  <View style={[styles.ayahNumberBadge, selected && styles.ayahNumberBadgeSelected]}>
                    <Text
                      style={[
                        styles.ayahNumberBadgeText,
                        selected && styles.ayahNumberBadgeTextSelected,
                      ]}
                    >
                      {ayah.ayahNumber}
                    </Text>
                  </View>
                  <View style={styles.ayahRowTextBlock}>
                    <Text style={styles.ayahRowTitle} numberOfLines={1}>
                      {surah?.name ?? `Surah ${ayah.surahNumber}`} · Ayah {ayah.ayahNumber}
                    </Text>
                    <Text style={styles.ayahRowArabic} numberOfLines={2}>
                      {ayah.textUthmani}
                    </Text>
                    {isBookmarked || highlight || hasNote ? (
                      <View style={styles.ayahAnnotationRow}>
                        {isBookmarked ? (
                          <View style={styles.ayahAnnotationChip}>
                            <Ionicons name="bookmark" size={11} color="#b45309" />
                            <Text style={styles.ayahAnnotationChipText}>Bookmark</Text>
                          </View>
                        ) : null}
                        {highlight ? (
                          <View style={styles.ayahAnnotationChip}>
                            <View
                              style={[
                                styles.ayahAnnotationDot,
                                { backgroundColor: HIGHLIGHT_COLORS[highlight.color].dot },
                              ]}
                            />
                            <Text style={styles.ayahAnnotationChipText}>
                              {HIGHLIGHT_COLORS[highlight.color].label}
                            </Text>
                          </View>
                        ) : null}
                        {hasNote ? (
                          <View style={styles.ayahAnnotationChip}>
                            <Ionicons name="document-text-outline" size={11} color="#2563eb" />
                            <Text style={styles.ayahAnnotationChipText}>Note</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                  <Ionicons
                    name={
                      toolMode === "select"
                        ? selected
                          ? "checkmark-circle"
                          : "ellipse-outline"
                        : toolMode === "recite"
                          ? "mic-outline"
                          : "chevron-forward"
                    }
                    size={21}
                    color={selected ? "#047857" : toolMode === "recite" ? "#be123c" : "#9ca3af"}
                  />
                </Pressable>
              );
            })}
            {pageAyahs.length === 0 ? (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsTitle}>No ayahs loaded</Text>
                <Text style={styles.emptyResultsDetail}>Try again after the page finishes loading.</Text>
              </View>
            ) : null}
          </ScrollView>
        )}

        {toolMode === "select" ? (
          <View style={styles.ayahListFooter}>
            <Text style={styles.ayahListFooterText}>
              {selectedCount} ayah{selectedCount === 1 ? "" : "s"} selected
            </Text>
            <Pressable
              style={[styles.ayahListFooterButton, selectedCount === 0 && styles.ayahListFooterButtonDisabled]}
              disabled={selectedCount === 0}
              onPress={onStartSelected}
            >
              <Text style={styles.ayahListFooterButtonText}>Open Range</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function AyahActionSheet({
  target,
  selected,
  annotations,
  pageAyahs,
  onClose,
  onNavigate,
  onOpenMemorization,
  onToggleSelection,
  onToggleBookmark,
  onSetHighlight,
  onSaveNote,
}: {
  target: PageAyahTarget | null;
  selected: boolean;
  annotations: MushafAnnotations;
  pageAyahs: PageAyahTarget[];
  onClose: () => void;
  onNavigate: (target: PageAyahTarget) => void;
  onOpenMemorization: (target: PageAyahTarget) => void;
  onToggleSelection: (target: PageAyahTarget) => void;
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
  const [tafseerState, setTafseerState] = useState<LoadState<string>>({
    status: "idle",
    data: null,
    error: null,
  });
  const [wbwState, setWbwState] = useState<LoadState<WBWWord[]>>({
    status: "idle",
    data: null,
    error: null,
  });

  const bookmark = target ? annotations.bookmarks[target.verseKey] : undefined;
  const highlight = target ? annotations.highlights[target.verseKey] : undefined;
  const note = target ? annotations.notes[target.verseKey] : undefined;
  const currentIndex = target ? pageAyahs.findIndex((ayah) => ayah.verseKey === target.verseKey) : -1;
  const previousAyah = currentIndex > 0 ? pageAyahs[currentIndex - 1] : null;
  const nextAyah =
    currentIndex >= 0 && currentIndex < pageAyahs.length - 1 ? pageAyahs[currentIndex + 1] : null;
  const sheetMaxHeight = Math.round(Dimensions.get("window").height * 0.86);

  useEffect(() => {
    setSheetView("main");
    setNoteText(target ? annotations.notes[target.verseKey]?.text ?? "" : "");
    setTranslationState({ status: "idle", data: null, error: null });
    setTafseerState({ status: "idle", data: null, error: null });
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
          <Pressable style={styles.ayahMenuRow} onPress={() => onToggleSelection(target)}>
            <Ionicons
              name={selected ? "checkmark-circle" : "checkmark-circle-outline"}
              size={18}
              color="#047857"
            />
            <Text style={styles.ayahMenuRowText}>
              {selected ? "Remove from selection" : "Add to selection"}
            </Text>
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
          <Text style={styles.ayahLongText}>
            {translationState.data ?? "Open this panel to load the translation."}
          </Text>
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
          <Text style={styles.ayahLongText}>
            {tafseerState.data ?? "Open this panel to load tafseer."}
          </Text>
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
  const screenW = Dimensions.get("window").width;
  const requestedInitialPage = useMemo(() => parsePageParam(params.page), [params.page]);
  const memorizationContext = useMemo(
    () =>
      buildMemorizationContext({
        fromMemorization: params.fromMemorization,
        surahNumber: params.surahNumber,
        ayahNumber: params.ayahNumber,
      }),
    [params.fromMemorization, params.surahNumber, params.ayahNumber],
  );

  const [initialPage, setInitialPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [readingGoal, setReadingGoal] = useState<ReadingGoal | null>(null);
  const [lastSavedPage, setLastSavedPage] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState("");
  const [pageInput, setPageInput] = useState("");
  const [bookmarkedPages, setBookmarkedPages] = useState<number[]>([]);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<MushafAnnotations>(() => emptyAnnotations());
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [recentReads, setRecentReads] = useState<RecentRead[]>([]);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [toolMode, setToolMode] = useState<ToolMode>("none");
  const [blindRevealed, setBlindRevealed] = useState(false);
  const [ayahListOpen, setAyahListOpen] = useState(false);
  const [selectedAyah, setSelectedAyah] = useState<PageAyahTarget | null>(null);
  const [selectedVerseKeys, setSelectedVerseKeys] = useState<Set<string>>(new Set());
  const [pageVerses, setPageVerses] = useState<ApiPageVerse[]>([]);
  const [pageVerseStatus, setPageVerseStatus] = useState<PageVerseStatus>("idle");

  const listRef = useRef<FlatList<number>>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = useMemo(
    () => Array.from({ length: TOTAL_MUSHAF_PAGES }, (_, i) => i + 1),
    [],
  );
  const currentSurah = getMushafSurahForPage(currentPage);
  const currentJuz = getJuzForMushafPage(currentPage);
  const ratio = progressRatio(readingGoal);
  const goalCopy = formatGoalCopy(readingGoal);
  const isBookmarked = bookmarkedPages.includes(currentPage);
  const pageAyahs = useMemo(
    () =>
      pageVerses
        .map((verse) => pageVerseToTarget(verse, currentPage))
        .filter((target): target is PageAyahTarget => target !== null),
    [currentPage, pageVerses],
  );
  const selectedAyahTargets = useMemo(
    () =>
      pageAyahs.filter((target) => selectedVerseKeys.has(target.verseKey)).sort((a, b) => {
        if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
        return a.ayahNumber - b.ayahNumber;
      }),
    [pageAyahs, selectedVerseKeys],
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
  const annotationCount =
    Object.keys(annotations.bookmarks).length +
    Object.keys(annotations.highlights).length +
    Object.keys(annotations.notes).length;
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

        setReadingGoal(goal);
        setLastSavedPage(goal?.lastPage ?? null);
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
        const raw = await AsyncStorage.getItem(annotationStorageKey(childId));
        if (cancelled) return;
        setAnnotations(normalizeAnnotations(raw));
      } catch {
        if (!cancelled) setAnnotationError("Ayah annotations could not load.");
      }
    }

    loadInitialPage();
    loadBookmarks();
    loadRecentReads();
    loadAnnotations();

    return () => {
      cancelled = true;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    };
  }, [childId, requestedInitialPage]);

  useEffect(() => {
    let cancelled = false;
    setPageVerseStatus("loading");
    setPageVerses([]);

    fetchVersesByPage(currentPage)
      .then((verses) => {
        if (cancelled) return;
        setPageVerses(verses);
        setPageVerseStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPageVerses([]);
        setPageVerseStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    setBlindRevealed(false);
    setSelectedVerseKeys(new Set());
    setSelectedAyah(null);
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
    setCurrentPage(target);
    setSaveError(null);
    setSaveStatus("idle");
    listRef.current?.scrollToIndex({ index: target - 1, animated: false });
    if (closeJump) {
      setJumpOpen(false);
      setJumpQuery("");
      setPageInput("");
    }
  }

  async function savePage(page: number) {
    const target = clampMushafPage(page);
    setSaveStatus("saving");
    setSaveError(null);

    try {
      const result = await apiFetch<ReadingProgressResponse>(
        `/api/children/${childId}/reading-progress`,
        {
          method: "POST",
          body: JSON.stringify({ currentPage: target }),
        },
      );

      setReadingGoal((current) => ({
        targetPages: current?.targetPages ?? 0,
        completedPages: result.readingCompletedPages ?? current?.completedPages ?? 0,
        lastPage: result.readingLastPage ?? target,
        status: result.readingStatus ?? current?.status ?? "not_started",
        isEnabled: current?.isEnabled ?? false,
      }));
      setLastSavedPage(result.readingLastPage ?? target);
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

  function toggleBookmark() {
    const page = currentPage;
    setBookmarkError(null);
    setBookmarkedPages((current) => {
      const next = current.includes(page)
        ? current.filter((savedPage) => savedPage !== page)
        : [page, ...current.filter((savedPage) => savedPage !== page)].slice(0, BOOKMARK_LIMIT);
      AsyncStorage.setItem(bookmarkStorageKey(childId), JSON.stringify(next)).catch(() => {
        setBookmarkError("Bookmark could not save.");
      });
      return next;
    });
  }

  function persistAnnotations(next: MushafAnnotations) {
    AsyncStorage.setItem(annotationStorageKey(childId), JSON.stringify(next)).catch(() => {
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
        bookmarks[target.verseKey] = annotationRecordFromTarget(target);
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
          ...annotationRecordFromTarget(target),
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
          ...annotationRecordFromTarget(target),
          text: clean,
          updatedAt: Date.now(),
        };
      }
      return { ...current, notes };
    });
  }

  function toggleToolMode(mode: ToolMode) {
    setToolMode((current) => {
      const next = current === mode ? "none" : mode;
      if (next !== "blind") setBlindRevealed(false);
      if (next !== "select") setSelectedVerseKeys(new Set());
      return next;
    });
  }

  function toggleSelectedAyah(target: PageAyahTarget) {
    setSelectedVerseKeys((current) => {
      const next = new Set(current);
      if (next.has(target.verseKey)) next.delete(target.verseKey);
      else next.add(target.verseKey);
      return next;
    });
  }

  function toggleSelectedAyahFromSheet(target: PageAyahTarget) {
    const willSelect = !selectedVerseKeys.has(target.verseKey);
    toggleSelectedAyah(target);
    if (willSelect) setToolMode("select");
  }

  function openAyahActions(target: PageAyahTarget) {
    setSelectedAyah(target);
    setAyahListOpen(false);
  }

  function openAnnotatedAyah(target: PageAyahTarget) {
    goToPage(target.pageNumber, true);
    setSelectedAyah(target);
    setAyahListOpen(false);
  }

  function openMemorizationFromAyah(target: PageAyahTarget) {
    setSelectedAyah(null);
    setAyahListOpen(false);
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
      },
    });
  }

  function openSelectedRangeInMemorization() {
    if (selectedAyahTargets.length === 0) return;
    const surahNumber = selectedAyahTargets[0]?.surahNumber;
    if (!surahNumber || selectedAyahTargets.some((target) => target.surahNumber !== surahNumber)) {
      Alert.alert("Select one surah", "For this shell, selected ayahs need to be in the same surah.");
      return;
    }

    const ayahStart = Math.min(...selectedAyahTargets.map((target) => target.ayahNumber));
    const ayahEnd = Math.max(...selectedAyahTargets.map((target) => target.ayahNumber));
    setAyahListOpen(false);
    router.push({
      pathname: "/child/[childId]/memorization",
      params: {
        childId,
        name: name ?? "",
        surahNumber: String(surahNumber),
        ayahStart: String(ayahStart),
        ayahEnd: String(ayahEnd),
        pageStart: String(currentPage),
        pageEnd: String(currentPage),
        session: "1",
      },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={19} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Full Quran</Text>
          <Text style={styles.headerSubtitle}>
            Page {currentPage} · Juz {currentJuz}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButtonNeutral} onPress={() => setChromeVisible((value) => !value)}>
            <Ionicons
              name={chromeVisible ? "chevron-up" : "chevron-down"}
              size={18}
              color="#374151"
            />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={toggleBookmark}>
            <Ionicons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={18}
              color={isBookmarked ? "#0f766e" : "#2563eb"}
            />
          </Pressable>
          <Pressable
            style={[styles.saveButton, saveStatus === "saving" && styles.saveButtonDisabled]}
            onPress={() => savePage(currentPage)}
            disabled={saveStatus === "saving"}
          >
            <Text
              style={[
                styles.saveText,
                saveStatus === "saving" && styles.saveTextMuted,
                saveStatus === "saved" && styles.saveTextConfirm,
              ]}
            >
              {saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>
      </View>

      {chromeVisible ? (
        <>
          <View style={styles.statusPanel}>
            <View style={styles.statusTopRow}>
              <View style={styles.surahBlock}>
                <Text style={styles.surahTitle} numberOfLines={1}>
                  {currentSurah.number}. {currentSurah.name}
                </Text>
                <Text style={styles.surahMeta} numberOfLines={1}>
                  {currentSurah.translation} · pages {currentSurah.startPage}-{currentSurah.endPage}
                </Text>
              </View>
              <View style={styles.resumePill}>
                <Text style={styles.resumePillText}>
                  {lastSavedPage ? `Saved p. ${lastSavedPage}` : "No saved page"}
                </Text>
              </View>
            </View>
            {memorizationContext ? (
              <View style={styles.sourceContextPill}>
                <Ionicons name="reader-outline" size={14} color="#0369a1" />
                <Text style={styles.sourceContextText} numberOfLines={1}>
                  {memorizationContext}
                </Text>
              </View>
            ) : null}
            {annotationCount > 0 ? (
              <View style={styles.sourceContextPill}>
                <Ionicons name="pricetags-outline" size={14} color="#7c3aed" />
                <Text style={styles.sourceContextText} numberOfLines={1}>
                  {annotationCount} ayah annotation{annotationCount === 1 ? "" : "s"} saved
                </Text>
              </View>
            ) : null}
            <View style={styles.progressRow}>
              <View style={styles.progressTextBlock}>
                <Text style={styles.progressLabel}>{goalCopy}</Text>
                <Text style={styles.progressHint} numberOfLines={1}>
                  {name ? `${name}'s reading` : "Daily reading"}
                </Text>
              </View>
              <Text style={styles.progressPercent}>{Math.round(ratio * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.toolPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toolScroller}
            >
              <ToolButton
                label="Jump"
                iconName="search"
                color="#2563eb"
                onPress={() => setJumpOpen(true)}
              />
              <ToolButton
                label="Ayahs"
                iconName="list-outline"
                color="#0f766e"
                active={ayahListOpen}
                onPress={() => setAyahListOpen(true)}
              />
              <ToolButton
                label="Blind"
                iconName={toolMode === "blind" ? "eye-off-outline" : "eye-outline"}
                color="#7c3aed"
                active={toolMode === "blind"}
                onPress={() => toggleToolMode("blind")}
              />
              <ToolButton
                label="Select"
                iconName="checkmark-circle-outline"
                color="#047857"
                active={toolMode === "select"}
                onPress={() => {
                  toggleToolMode("select");
                  setAyahListOpen(true);
                }}
              />
              <ToolButton
                label="Recite"
                iconName="mic-outline"
                color="#be123c"
                active={toolMode === "recite"}
                onPress={() => {
                  toggleToolMode("recite");
                  setAyahListOpen(true);
                }}
              />
            </ScrollView>
          </View>
        </>
      ) : (
        <View style={styles.collapsedChromeBar}>
          <Text style={styles.collapsedChromeText} numberOfLines={1}>
            {currentSurah.name} · Page {currentPage} · tools hidden
          </Text>
        </View>
      )}

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

      {initialPage === null ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingCenterText}>Loading saved page</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(page) => String(page)}
          horizontal
          pagingEnabled
          inverted
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialPage - 1}
          getItemLayout={(_, index) => ({
            length: screenW,
            offset: screenW * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: false });
            }, 80);
          }}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
            const page = clampMushafPage(idx + 1);
            setCurrentPage(page);
            scheduleAutoSave(page);
          }}
          renderItem={({ item }) => (
            <PageView
              pageNumber={item}
              width={screenW}
              toolMode={toolMode}
              blindRevealed={blindRevealed}
              onRevealBlindPage={() => setBlindRevealed(true)}
              onOpenAyahList={() => setAyahListOpen(true)}
            />
          )}
        />
      )}

      {toolMode === "select" && selectedVerseKeys.size > 0 ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarText}>
            {selectedVerseKeys.size} ayah{selectedVerseKeys.size === 1 ? "" : "s"} selected
          </Text>
          <Pressable style={styles.selectionBarButton} onPress={openSelectedRangeInMemorization}>
            <Text style={styles.selectionBarButtonText}>Open Range</Text>
          </Pressable>
        </View>
      ) : null}

      {chromeVisible ? (
        <View style={styles.footer}>
          <View style={styles.footerControls}>
            <Pressable
              style={[styles.footerButton, currentPage <= 1 && styles.footerButtonDisabled]}
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <Ionicons name="chevron-back" size={17} color={currentPage <= 1 ? "#9ca3af" : "#2563eb"} />
              <Text style={[styles.footerButtonText, currentPage <= 1 && styles.footerButtonTextDisabled]}>
                Prev
              </Text>
            </Pressable>
            <Pressable style={styles.footerButtonPrimary} onPress={() => setJumpOpen(true)}>
              <Ionicons name="search" size={17} color="#ffffff" />
              <Text style={styles.footerButtonPrimaryText}>Jump</Text>
            </Pressable>
            <Pressable
              style={[
                styles.footerButton,
                currentPage >= TOTAL_MUSHAF_PAGES && styles.footerButtonDisabled,
              ]}
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage >= TOTAL_MUSHAF_PAGES}
            >
              <Text
                style={[
                  styles.footerButtonText,
                  currentPage >= TOTAL_MUSHAF_PAGES && styles.footerButtonTextDisabled,
                ]}
              >
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={17}
                color={currentPage >= TOTAL_MUSHAF_PAGES ? "#9ca3af" : "#2563eb"}
              />
            </Pressable>
          </View>
          <View style={styles.presetRow}>
            {PRESET_PAGES.map((page) => (
              <Pressable
                key={page}
                style={[styles.presetButton, currentPage === page && styles.presetButtonActive]}
                onPress={() => goToPage(page)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    currentPage === page && styles.presetButtonTextActive,
                  ]}
                >
                  Page {page}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <AyahListModal
        visible={ayahListOpen}
        pageNumber={currentPage}
        toolMode={toolMode}
        pageAyahs={pageAyahs}
        status={pageVerseStatus}
        selectedVerseKeys={selectedVerseKeys}
        annotations={annotations}
        onClose={() => setAyahListOpen(false)}
        onOpenAyah={openAyahActions}
        onToggleSelectedAyah={toggleSelectedAyah}
        onStartRecite={openMemorizationFromAyah}
        onStartSelected={openSelectedRangeInMemorization}
      />

      <AyahActionSheet
        target={selectedAyah}
        selected={selectedAyah ? selectedVerseKeys.has(selectedAyah.verseKey) : false}
        annotations={annotations}
        pageAyahs={pageAyahs}
        onClose={() => setSelectedAyah(null)}
        onNavigate={setSelectedAyah}
        onOpenMemorization={openMemorizationFromAyah}
        onToggleSelection={toggleSelectedAyahFromSheet}
        onToggleBookmark={toggleAyahBookmark}
        onSetHighlight={setAyahHighlight}
        onSaveNote={saveAyahNote}
      />

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
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    width: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backText: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "700",
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111111",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#666666",
    fontWeight: "700",
  },
  headerActions: {
    width: 136,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  iconButtonNeutral: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
  },
  saveButton: {
    minWidth: 56,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  saveButtonDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  saveText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "800",
  },
  saveTextMuted: {
    color: "#999999",
  },
  saveTextConfirm: {
    color: "#16a34a",
  },
  statusPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statusTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  surahBlock: {
    flex: 1,
    minWidth: 0,
  },
  surahTitle: {
    fontSize: 15,
    color: "#111111",
    fontWeight: "800",
  },
  surahMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
  resumePill: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resumePillText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "800",
  },
  sourceContextPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceContextText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
    color: "#0369a1",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  progressLabel: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "800",
  },
  progressHint: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 16,
    color: "#0f766e",
    fontWeight: "900",
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0f766e",
  },
  toolPanel: {
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  toolScroller: {
    paddingHorizontal: 16,
    gap: 8,
  },
  toolButton: {
    minWidth: 76,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
  },
  toolButtonText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "900",
  },
  collapsedChromeBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  collapsedChromeText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "800",
    textAlign: "center",
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
  pageWrap: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pageCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  blindOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
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
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modeOverlayHintText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "900",
  },
  modeOverlayHintTextRecite: {
    color: "#be123c",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  loadingText: {
    fontSize: 11,
    color: "#666666",
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
  pageNumberLabel: {
    fontSize: 11,
    color: "#666666",
    marginTop: 6,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  footer: {
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 22,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  footerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  footerButtonDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  footerButtonText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
  },
  footerButtonTextDisabled: {
    color: "#9ca3af",
  },
  footerButtonPrimary: {
    flex: 1.15,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  footerButtonPrimaryText: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "900",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  presetButtonActive: {
    backgroundColor: "#ecfeff",
    borderColor: "#67e8f9",
  },
  presetButtonText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "800",
  },
  presetButtonTextActive: {
    color: "#0e7490",
  },
  selectionBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectionBarText: {
    flex: 1,
    fontSize: 13,
    color: "#047857",
    fontWeight: "900",
  },
  selectionBarButton: {
    borderRadius: 9,
    backgroundColor: "#047857",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectionBarButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  sheet: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  sheetHeader: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
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
    color: "#111111",
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
  sheetCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 28,
  },
  sheetCenterTitle: {
    fontSize: 16,
    color: "#111111",
    fontWeight: "900",
    textAlign: "center",
  },
  sheetCenterText: {
    fontSize: 13,
    color: "#666666",
    fontWeight: "700",
    textAlign: "center",
  },
  ayahListContent: {
    padding: 16,
    paddingBottom: 30,
    gap: 10,
  },
  ayahRow: {
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ayahRowSelected: {
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  ayahNumberBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  ayahNumberBadgeSelected: {
    borderColor: "#047857",
    backgroundColor: "#047857",
  },
  ayahNumberBadgeText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "900",
  },
  ayahNumberBadgeTextSelected: {
    color: "#ffffff",
  },
  ayahRowTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  ayahRowTitle: {
    fontSize: 13,
    color: "#111111",
    fontWeight: "900",
  },
  ayahRowArabic: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 30,
    color: "#374151",
    textAlign: "right",
    writingDirection: "rtl",
  },
  ayahAnnotationRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ayahAnnotationChip: {
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ayahAnnotationChipText: {
    fontSize: 10,
    color: "#374151",
    fontWeight: "800",
  },
  ayahAnnotationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ayahListFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  ayahListFooterText: {
    flex: 1,
    fontSize: 13,
    color: "#047857",
    fontWeight: "900",
  },
  ayahListFooterButton: {
    borderRadius: 10,
    backgroundColor: "#047857",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ayahListFooterButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  ayahListFooterButtonText: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "900",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
  },
  ayahKeyboardAvoider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  ayahActionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    color: "#111111",
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
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  ayahPreviewText: {
    fontSize: 22,
    lineHeight: 40,
    color: "#111111",
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
    borderColor: "#e5e7eb",
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
    color: "#111111",
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
    borderColor: "#e5e7eb",
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
  ayahSecondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ayahSecondaryButtonText: {
    fontSize: 14,
    color: "#047857",
    fontWeight: "900",
  },
  ayahMenuGroup: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
    color: "#111111",
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
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
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
    color: "#111111",
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
    color: "#111111",
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
    color: "#111111",
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
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 14,
  },
  ayahTextPanelArabic: {
    fontSize: 22,
    lineHeight: 38,
    color: "#111111",
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
  ayahContentState: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 8,
  },
  ayahContentStateTitle: {
    fontSize: 14,
    color: "#111111",
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
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 8,
    alignItems: "center",
  },
  wbwArabic: {
    fontSize: 20,
    lineHeight: 30,
    color: "#111111",
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
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
    color: "#111111",
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
    borderRadius: 10,
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
    color: "#111111",
    fontWeight: "600",
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 16,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  recentChipTitle: {
    fontSize: 13,
    color: "#111111",
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
    color: "#111111",
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
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  juzChipTitle: {
    fontSize: 12,
    color: "#111111",
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
    color: "#111111",
    fontWeight: "900",
  },
  emptyResultsDetail: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
});
