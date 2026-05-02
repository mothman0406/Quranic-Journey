import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import {
  BadgePill,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
  SectionLabel,
} from "@/src/components/screen-primitives";
import { fetchMemorizationProgress, type MemorizationProgress } from "@/src/lib/memorization";
import { MUSHAF_SURAHS } from "@/src/lib/mushaf";
import { fetchReviewQueue, ReviewQueueItem, ReviewQueueResponse } from "@/src/lib/reviews";
import { getReviewPriorityStyle } from "@/src/lib/review-priority";

type CompletedReviewItem = {
  surahId: number;
  surahName?: string | null;
  surahNumber: number;
  ayahStart?: number;
  ayahEnd?: number;
  pageStart?: number;
  pageEnd?: number;
  chunkIndex?: number;
  chunkCount?: number;
};

type StoredReviewSession = {
  date?: string;
  sessionDone?: boolean;
  completedItemsData?: CompletedReviewItem[];
  sessionTotal?: number;
  updatedAt?: number;
};

function serializableReviewItem(item: ReviewQueueItem) {
  return {
    id: item.id,
    surahId: item.surahId,
    surahName: item.surahName,
    surahNumber: item.surahNumber,
    ayahStart: item.ayahStart,
    ayahEnd: item.ayahEnd,
    pageStart: item.pageStart,
    pageEnd: item.pageEnd,
    chunkIndex: item.chunkIndex,
    chunkCount: item.chunkCount,
    isPartialReview: item.isPartialReview,
    dueDate: item.dueDate,
    isOverdue: item.isOverdue,
    isWeak: item.isWeak,
    reviewPriority: item.reviewPriority,
  };
}

function formatAyahRange(item: ReviewQueueItem) {
  return item.ayahStart === item.ayahEnd
    ? `Ayah ${item.ayahStart}`
    : `Ayahs ${item.ayahStart}-${item.ayahEnd}`;
}

function formatPageRange(item: ReviewQueueItem) {
  return item.pageStart === item.pageEnd
    ? `Page ${item.pageStart}`
    : `Pages ${item.pageStart}-${item.pageEnd}`;
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getLocalDateHeaderValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToLocalDate(value: string, days: number) {
  const date = parseLocalDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return getLocalDateHeaderValue(date);
}

function formatDueDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value || "Scheduled";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatReviewDayLabel(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value || "this review day";
  const diffDays = Math.round((date.getTime() - startOfToday().getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return formatDueDate(value);
}

function formatReviewDayInSentence(label: string) {
  if (label === "Today") return "today";
  if (label === "Tomorrow") return "tomorrow";
  if (label === "Yesterday") return "yesterday";
  return label;
}

function formatRelativeDueDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value || "Scheduled";
  const diffDays = Math.round((date.getTime() - startOfToday().getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1) return `In ${diffDays} days`;
  if (diffDays === -1) return "Yesterday";
  return `${Math.abs(diffDays)} days overdue`;
}

function itemKey(prefix: string, item: ReviewQueueItem, index: number) {
  return `${prefix}-${item.id}-${item.surahId}-${item.ayahStart}-${index}`;
}

function reviewSessionKey(childId: string, reviewDate: string) {
  return `noorpath:review-session:${childId}:${reviewDate}`;
}

function continueReviewingKey(childId: string, todayLocal: string) {
  return `noorpath:review-continue:${childId}:${todayLocal}`;
}

function parseContinueOffset(raw: string | null) {
  if (!raw) return 0;
  if (raw === "true") return 1;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeCompletedReviewItem(
  item: Partial<CompletedReviewItem>,
): CompletedReviewItem | null {
  const surahId = numberOrUndefined(item.surahId);
  const surahNumber = numberOrUndefined(item.surahNumber);
  if (!surahId || !surahNumber) return null;

  return {
    surahId,
    surahName: typeof item.surahName === "string" ? item.surahName : null,
    surahNumber,
    ayahStart: numberOrUndefined(item.ayahStart),
    ayahEnd: numberOrUndefined(item.ayahEnd),
    pageStart: numberOrUndefined(item.pageStart),
    pageEnd: numberOrUndefined(item.pageEnd),
    chunkIndex: numberOrUndefined(item.chunkIndex),
    chunkCount: numberOrUndefined(item.chunkCount),
  };
}

function completedFromQueueItem(item: ReviewQueueItem): CompletedReviewItem {
  return {
    surahId: item.surahId,
    surahName: item.surahName,
    surahNumber: item.surahNumber,
    ayahStart: item.ayahStart,
    ayahEnd: item.ayahEnd,
    pageStart: item.pageStart,
    pageEnd: item.pageEnd,
    chunkIndex: item.chunkIndex,
    chunkCount: item.chunkCount,
  };
}

function mergeCompletedReviewItems(
  localItems: CompletedReviewItem[],
  backendItems: CompletedReviewItem[],
): CompletedReviewItem[] {
  const merged = new Map<number, CompletedReviewItem>();

  for (const item of backendItems) {
    merged.set(item.surahId, item);
  }
  for (const item of localItems) {
    merged.set(item.surahId, {
      ...merged.get(item.surahId),
      ...item,
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.surahNumber - b.surahNumber);
}

function isStoredReviewSessionComplete(session: StoredReviewSession | null | undefined) {
  if (!session) return false;

  const completedCount = session.completedItemsData?.length ?? 0;
  const sessionTotal = Number(session.sessionTotal ?? completedCount);

  return (
    completedCount > 0 &&
    (session.sessionDone === true ||
      (sessionTotal > 0 && completedCount >= sessionTotal))
  );
}

async function loadStoredReviewSession(
  childId: string,
  reviewDate: string,
): Promise<StoredReviewSession | null> {
  try {
    const raw = await AsyncStorage.getItem(reviewSessionKey(childId, reviewDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReviewSession;
    if (parsed.date && parsed.date !== reviewDate) return null;
    const completedItemsData = Array.isArray(parsed.completedItemsData)
      ? parsed.completedItemsData
          .map((item) => normalizeCompletedReviewItem(item))
          .filter((item): item is CompletedReviewItem => !!item)
      : [];
    const sessionTotal = Number(parsed.sessionTotal ?? completedItemsData.length);

    return {
      date: reviewDate,
      sessionDone: parsed.sessionDone === true,
      completedItemsData,
      sessionTotal: Number.isFinite(sessionTotal)
        ? Math.max(0, Math.round(sessionTotal))
        : completedItemsData.length,
      updatedAt: numberOrUndefined(parsed.updatedAt),
    };
  } catch {
    return null;
  }
}

async function saveStoredReviewSession(
  childId: string,
  reviewDate: string,
  updates: {
    sessionDone?: boolean;
    completedItemsData?: CompletedReviewItem[];
    sessionTotal?: number;
  },
): Promise<StoredReviewSession | null> {
  try {
    const current = await loadStoredReviewSession(childId, reviewDate);
    const completedItemsData = updates.completedItemsData
      ? mergeCompletedReviewItems(
          current?.completedItemsData ?? [],
          updates.completedItemsData,
        )
      : current?.completedItemsData ?? [];
    const sessionTotal = Math.max(
      current?.sessionTotal ?? 0,
      updates.sessionTotal ?? 0,
      completedItemsData.length,
    );
    const next: StoredReviewSession = {
      ...current,
      date: reviewDate,
      sessionDone: updates.sessionDone ?? current?.sessionDone ?? false,
      completedItemsData,
      sessionTotal,
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(reviewSessionKey(childId, reviewDate), JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

async function saveReviewSessionFromQueue(
  childId: string,
  reviewDate: string,
  data: ReviewQueueResponse,
) {
  const storedSession = await loadStoredReviewSession(childId, reviewDate);
  const backendItems = (data.reviewedToday ?? []).map(completedFromQueueItem);
  const completedItemsData = mergeCompletedReviewItems(
    storedSession?.completedItemsData ?? [],
    backendItems,
  );
  const sessionTotal = Math.max(
    storedSession?.sessionTotal ?? 0,
    completedItemsData.length + (data.dueToday?.length ?? 0),
  );
  const sessionDone =
    completedItemsData.length > 0 &&
    (data.dueToday?.length ?? 0) === 0 &&
    completedItemsData.length >= sessionTotal;

  return saveStoredReviewSession(childId, reviewDate, {
    completedItemsData,
    sessionDone: sessionDone || storedSession?.sessionDone === true,
    sessionTotal,
  });
}

function completedItemToReviewQueueItem(
  item: CompletedReviewItem,
  reviewDate: string,
  index: number,
): ReviewQueueItem {
  const ayahStart = item.ayahStart ?? 1;
  const ayahEnd = item.ayahEnd ?? ayahStart;
  const pageStart = item.pageStart ?? 1;
  const pageEnd = item.pageEnd ?? pageStart;
  const chunkCount = item.chunkCount ?? 1;

  return {
    id: -(index + 1),
    surahId: item.surahId,
    surahName: item.surahName ?? `Surah ${item.surahNumber}`,
    surahNumber: item.surahNumber,
    ayahStart,
    ayahEnd,
    pageStart,
    pageEnd,
    chunkIndex: item.chunkIndex ?? 1,
    chunkCount,
    isPartialReview: chunkCount > 1,
    dueDate: reviewDate,
    isOverdue: false,
    isWeak: false,
    reviewPriority: "green",
  };
}

function mergeReviewedQueueItems(
  localItems: CompletedReviewItem[],
  backendItems: ReviewQueueItem[],
  reviewDate: string,
): ReviewQueueItem[] {
  const merged = new Map<number, ReviewQueueItem>();

  for (const item of backendItems) {
    merged.set(item.surahId, item);
  }
  for (const item of localItems) {
    if (!merged.has(item.surahId)) {
      merged.set(
        item.surahId,
        completedItemToReviewQueueItem(item, reviewDate, merged.size),
      );
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.surahNumber - b.surahNumber);
}

function PriorityPill({ priority }: { priority: string }) {
  const priorityStyle = getReviewPriorityStyle(priority);
  return (
    <BadgePill
      label={priorityStyle.label}
      color={priorityStyle.text}
      backgroundColor={priorityStyle.bg}
      borderColor={priorityStyle.border}
      dotColor={priorityStyle.text}
    />
  );
}

function MutedPriorityPill({ priority }: { priority: string }) {
  const priorityStyle = getReviewPriorityStyle(priority);
  return (
    <BadgePill
      label={priorityStyle.label}
      color="#6b7280"
      backgroundColor="#f9fafb"
      borderColor="#e5e7eb"
      dotColor={priorityStyle.text}
    />
  );
}

function SummaryMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={[styles.summaryMetricValue, { color }]}>{value}</Text>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
    </View>
  );
}

function QueueSummary({
  dueCount,
  reviewedCount,
  upcomingCount,
  activeDateLabel,
}: {
  dueCount: number;
  reviewedCount: number;
  upcomingCount: number;
  activeDateLabel: string;
}) {
  const activeDateInSentence = formatReviewDayInSentence(activeDateLabel);
  const summaryCopy =
    dueCount > 0
      ? reviewedCount > 0
        ? `${reviewedCount} review${reviewedCount === 1 ? "" : "s"} done, ${dueCount} remaining for ${activeDateInSentence}.`
        : `${dueCount} review${dueCount === 1 ? "" : "s"} ready for ${activeDateInSentence}.`
      : reviewedCount > 0
      ? activeDateLabel === "Today"
        ? "Today's review queue is complete."
        : `Review queue complete for ${activeDateInSentence}.`
      : upcomingCount > 0
      ? `No reviews due for ${activeDateInSentence}. The next queue is visible below.`
      : "No reviews are scheduled yet.";

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryIcon}>
          <Ionicons name="refresh" size={22} color="#ffffff" />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryKicker}>Spaced repetition</Text>
          <Text style={styles.summaryTitle}>Review Queue</Text>
          <Text style={styles.summaryDetail}>{summaryCopy}</Text>
        </View>
      </View>
      <View style={styles.summaryMetrics}>
        <SummaryMetric label="Due" value={dueCount} color="#ea580c" />
        <SummaryMetric label="Done" value={reviewedCount} color="#16a34a" />
        <SummaryMetric label="Upcoming" value={upcomingCount} color="#2563eb" />
      </View>
    </View>
  );
}

function TodaysWorkCompletePanel() {
  return (
    <View style={styles.completePanel}>
      <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
      <Text style={styles.completePanelTitle}>Today's work complete!</Text>
    </View>
  );
}

function ContinueReviewingButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.continueReviewingButton} onPress={onPress}>
      <Text style={styles.continueReviewingButtonText}>Continue Reviewing →</Text>
      <Ionicons name="arrow-forward" size={16} color="#ffffff" />
    </Pressable>
  );
}

function ReviewSpecificSurahCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.specificSurahCard} onPress={onPress}>
      <View style={styles.specificSurahIcon}>
        <Ionicons name="search" size={20} color="#2563eb" />
      </View>
      <View style={styles.specificSurahText}>
        <Text style={styles.specificSurahTitle}>Review Specific Surah</Text>
        <Text style={styles.specificSurahDetail}>Pick any memorized surah</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}

function canonicalReviewSurahOrder(surahNumber: number) {
  if (surahNumber === 1) return 0;
  return 115 - surahNumber;
}

function getMemorizationReviewPriority(progress: MemorizationProgress) {
  const memorizedAyahs =
    progress.memorizedAyahs.length > 0
      ? progress.memorizedAyahs
      : Array.from({ length: progress.versesMemorized }, (_, index) => index + 1);
  const hasRedAyah = memorizedAyahs.some(
    (ayah) => (progress.ayahStrengths?.[String(ayah)] ?? progress.strength ?? 3) <= 1,
  );
  if (hasRedAyah) return "red";
  if (memorizedAyahs.length < progress.totalVerses) return "orange";
  const hasOrangeAyah = memorizedAyahs.some(
    (ayah) => (progress.ayahStrengths?.[String(ayah)] ?? progress.strength ?? 3) <= 3,
  );
  return hasOrangeAyah ? "orange" : "green";
}

function isMemorizedForReview(progress: MemorizationProgress) {
  return (
    progress.status === "memorized" ||
    progress.status === "needs_review" ||
    (progress.status === "in_progress" && progress.versesMemorized >= progress.totalVerses)
  );
}

function getApproxPageForVerse(surahNumber: number, ayah: number) {
  const surah = MUSHAF_SURAHS.find((item) => item.number === surahNumber);
  if (!surah) return 1;
  if (surah.startPage === surah.endPage || surah.verseCount <= 1) return surah.startPage;
  const boundedAyah = Math.max(1, Math.min(surah.verseCount, ayah));
  const ratio = (boundedAyah - 1) / Math.max(1, surah.verseCount - 1);
  return Math.max(
    surah.startPage,
    Math.min(surah.endPage, Math.floor(surah.startPage + ratio * (surah.endPage - surah.startPage))),
  );
}

function VerseStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.rangeStepper}>
      <Text style={styles.rangeStepperLabel}>{label}</Text>
      <View style={styles.rangeStepperControls}>
        <Pressable
          style={[styles.rangeStepperButton, value <= min && styles.rangeStepperButtonDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Ionicons name="remove" size={16} color={value <= min ? "#94a3b8" : "#2563eb"} />
        </Pressable>
        <Text style={styles.rangeStepperValue}>{value}</Text>
        <Pressable
          style={[styles.rangeStepperButton, value >= max && styles.rangeStepperButtonDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Ionicons name="add" size={16} color={value >= max ? "#94a3b8" : "#2563eb"} />
        </Pressable>
      </View>
    </View>
  );
}

function ReviewSpecificSurahSheet({
  visible,
  childId,
  name,
  todayLocal,
  onClose,
}: {
  visible: boolean;
  childId: string;
  name: string;
  todayLocal: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<MemorizationProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MemorizationProgress | null>(null);
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(1);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearch("");
    setSelected(null);

    fetchMemorizationProgress(childId)
      .then((items) => {
        if (!cancelled) setProgress(items);
      })
      .catch((e) => {
        if (!cancelled) {
          setProgress([]);
          setError(e instanceof Error ? e.message : "Memorized surahs could not load.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [childId, visible]);

  const memorizedSurahs = useMemo(
    () =>
      progress
        .filter(isMemorizedForReview)
        .sort(
          (a, b) =>
            canonicalReviewSurahOrder(a.surahNumber) -
            canonicalReviewSurahOrder(b.surahNumber),
        ),
    [progress],
  );
  const filteredSurahs = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return memorizedSurahs;
    return memorizedSurahs.filter((item) =>
      `${item.surahNumber} ${item.surahName}`.toLowerCase().includes(normalized),
    );
  }, [memorizedSurahs, search]);

  function chooseSurah(item: MemorizationProgress) {
    setSelected(item);
    setFromAyah(1);
    setToAyah(item.totalVerses);
  }

  function updateFromAyah(next: number) {
    const bounded = Math.max(1, Math.min(next, selected?.totalVerses ?? 1));
    setFromAyah(bounded);
    setToAyah((current) => Math.max(current, bounded));
  }

  function updateToAyah(next: number) {
    const bounded = Math.max(1, Math.min(next, selected?.totalVerses ?? 1));
    setToAyah(bounded);
    setFromAyah((current) => Math.min(current, bounded));
  }

  function startSpecificReview() {
    if (!selected) return;
    const pageStart = getApproxPageForVerse(selected.surahNumber, fromAyah);
    const pageEnd = getApproxPageForVerse(selected.surahNumber, toAyah);
    onClose();
    router.push({
      pathname: "/child/[childId]/review-session",
      params: {
        childId,
        name,
        surahId: String(selected.surahId),
        surahNumber: String(selected.surahNumber),
        surahName: selected.surahName,
        ayahStart: String(fromAyah),
        ayahEnd: String(toAyah),
        pageStart: String(Math.min(pageStart, pageEnd)),
        pageEnd: String(Math.max(pageStart, pageEnd)),
        chunkIndex: "1",
        chunkCount: "1",
        reviewDate: todayLocal,
        isAdHoc: "true",
      },
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.specificSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            {selected ? (
              <Pressable style={styles.sheetIconButton} onPress={() => setSelected(null)}>
                <Ionicons name="arrow-back" size={19} color="#334155" />
              </Pressable>
            ) : (
              <View style={styles.sheetIconButtonPlaceholder} />
            )}
            <Text style={styles.sheetTitle}>
              {selected ? selected.surahName : "Review Specific Surah"}
            </Text>
            <Pressable style={styles.sheetIconButton} onPress={onClose}>
              <Ionicons name="close" size={19} color="#334155" />
            </Pressable>
          </View>

          {!selected ? (
            <>
              <View style={styles.surahSearchBox}>
                <Ionicons name="search" size={17} color="#64748b" />
                <TextInput
                  style={styles.surahSearchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search memorized surahs"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="search"
                />
              </View>
              {loading ? (
                <View style={styles.sheetState}>
                  <ActivityIndicator color="#2563eb" />
                  <Text style={styles.sheetStateText}>Loading memorized surahs...</Text>
                </View>
              ) : error ? (
                <View style={styles.sheetState}>
                  <Text style={styles.sheetErrorText}>{error}</Text>
                </View>
              ) : filteredSurahs.length === 0 ? (
                <View style={styles.sheetState}>
                  <Text style={styles.sheetStateText}>No memorized surahs found.</Text>
                </View>
              ) : (
                <ScrollView style={styles.surahPickerList} keyboardShouldPersistTaps="handled">
                  {filteredSurahs.map((item) => {
                    const priority = getMemorizationReviewPriority(item);
                    const priorityStyle = getReviewPriorityStyle(priority);
                    return (
                      <Pressable
                        key={item.surahId}
                        style={styles.surahPickerRow}
                        onPress={() => chooseSurah(item)}
                      >
                        <View
                          style={[
                            styles.surahPriorityDot,
                            { backgroundColor: priorityStyle.text },
                          ]}
                        />
                        <View style={styles.surahPickerText}>
                          <Text style={styles.surahPickerTitle} numberOfLines={1}>
                            {item.surahNumber}. {item.surahName}
                          </Text>
                          <Text style={styles.surahPickerDetail}>
                            {item.totalVerses} ayah{item.totalVerses === 1 ? "" : "s"}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color="#94a3b8" />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </>
          ) : (
            <View style={styles.rangePanel}>
              <Text style={styles.rangeDetail}>
                {selected.totalVerses} ayah{selected.totalVerses === 1 ? "" : "s"}
              </Text>
              <View style={styles.rangeSteppers}>
                <VerseStepper
                  label="From"
                  value={fromAyah}
                  min={1}
                  max={toAyah}
                  onChange={updateFromAyah}
                />
                <VerseStepper
                  label="To"
                  value={toAyah}
                  min={fromAyah}
                  max={selected.totalVerses}
                  onChange={updateToAyah}
                />
              </View>
              <Pressable style={styles.startSpecificButton} onPress={startSpecificReview}>
                <Text style={styles.startSpecificButtonText}>Start Review</Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ReviewCard({
  item,
  onPress,
  variant = "due",
  batchState,
}: {
  item: ReviewQueueItem;
  onPress?: () => void;
  variant?: "due" | "upcoming" | "reviewed";
  batchState?: {
    active: boolean;
    selected: boolean;
    neighbor: boolean;
    canToggle: boolean;
    onToggle: () => void;
  };
}) {
  const pageLabel = formatPageRange(item);
  const priorityStyle = getReviewPriorityStyle(item.reviewPriority);
  const isReviewed = variant === "reviewed";
  const isUpcoming = variant === "upcoming";
  const isBatchMode = !!batchState;
  const cardPress =
    isBatchMode && batchState.active
      ? batchState.canToggle
        ? batchState.onToggle
        : undefined
      : onPress;
  const statusLabel = isReviewed
    ? "Reviewed"
    : isUpcoming
    ? formatRelativeDueDate(item.dueDate)
    : item.isOverdue
    ? "Overdue"
    : "Today";

  return (
    <Pressable
      style={[
        styles.card,
        !isReviewed &&
          !isUpcoming && {
            backgroundColor: priorityStyle.cardBg,
            borderColor: priorityStyle.border,
          },
        isReviewed && styles.reviewedCard,
        isUpcoming && styles.upcomingCard,
        batchState?.selected && styles.cardSelectedForBatch,
        batchState?.neighbor && styles.cardNeighborForBatch,
        isBatchMode && !batchState.canToggle && styles.cardBlockedForBatch,
        !cardPress && styles.cardReadOnly,
      ]}
      onPress={cardPress}
      disabled={!cardPress}
    >
      {isReviewed ? (
        <View style={styles.reviewedCheckRail}>
          <Ionicons name="checkmark-circle" size={21} color="#16a34a" />
        </View>
      ) : (
        <View
          style={[
            styles.priorityRail,
            { backgroundColor: isUpcoming ? "#cbd5e1" : priorityStyle.text },
          ]}
        />
      )}
      <View style={[styles.cardTop, isUpcoming && styles.upcomingCardTop]}>
        {isReviewed ? (
          <MutedPriorityPill priority={item.reviewPriority} />
        ) : (
          <PriorityPill priority={item.reviewPriority} />
        )}
        <Text
          style={[
            styles.surahName,
            isReviewed && styles.reviewedSurahName,
            isUpcoming && styles.upcomingSurahName,
          ]}
          numberOfLines={1}
        >
          {item.surahName ?? `Surah ${item.surahNumber}`}
        </Text>
        {item.isPartialReview && (
          <Text style={[styles.chunkBadge, isReviewed && styles.reviewedChunkBadge]}>
            {item.chunkIndex} of {item.chunkCount}
          </Text>
        )}
        {batchState && (
          <Pressable
            style={[
              styles.batchSelectCircle,
              batchState.selected && styles.batchSelectCircleSelected,
              batchState.neighbor && styles.batchSelectCircleNeighbor,
              !batchState.canToggle && styles.batchSelectCircleDisabled,
            ]}
            onPress={(event) => {
              event.stopPropagation();
              if (batchState.canToggle) batchState.onToggle();
            }}
            disabled={!batchState.canToggle}
          >
            {batchState.selected ? (
              <Ionicons name="checkmark" size={14} color="#ffffff" />
            ) : null}
          </Pressable>
        )}
      </View>
      <View style={styles.cardMetaRow}>
        <Text
          style={[
            styles.cardSub,
            isReviewed && styles.reviewedCardSub,
            isUpcoming && styles.upcomingCardSub,
          ]}
        >
          {formatAyahRange(item)} · {pageLabel}
        </Text>
        <Text
          style={[
            styles.statusBadge,
            {
              color: isReviewed ? "#6b7280" : isUpcoming ? "#475569" : priorityStyle.text,
              backgroundColor: isReviewed
                ? "#f9fafb"
                : isUpcoming
                ? "#f8fafc"
                : priorityStyle.bg,
              borderColor: isReviewed
                ? "#e5e7eb"
                : isUpcoming
                ? "#e2e8f0"
                : priorityStyle.border,
            },
            isReviewed && styles.reviewedStatusBadge,
            isUpcoming && styles.upcomingStatusBadge,
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      {isUpcoming && (
        <Text style={styles.upcomingDate}>Due {formatDueDate(item.dueDate)}</Text>
      )}
      {batchState?.active && (
        <Text
          style={[
            styles.batchCardHint,
            batchState.selected && styles.batchCardHintSelected,
          ]}
        >
          {batchState.selected
            ? "Included"
            : batchState.neighbor
            ? "Next to select"
            : "Outside connected run"}
        </Text>
      )}
    </Pressable>
  );
}

function ReviewBatchPicker({
  selectedCount,
  totalCount,
  startName,
  allSelected,
  onToggleAll,
  onClear,
  onStart,
}: {
  selectedCount: number;
  totalCount: number;
  startName?: string | null;
  allSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onStart: () => void;
}) {
  const hasSelection = selectedCount > 0;

  return (
    <View style={styles.batchCard}>
      <View style={styles.batchHeader}>
        <View style={styles.batchTitleWrap}>
          <Text style={styles.batchTitle}>Review A Few Together</Text>
          <Text style={styles.batchDetail}>Connected Mushaf run</Text>
        </View>
        <Pressable style={styles.batchHeaderButton} onPress={onToggleAll}>
          <Text style={styles.batchHeaderButtonText}>
            {allSelected ? "Clear All" : "Select All"}
          </Text>
        </Pressable>
      </View>

      {hasSelection ? (
        <View style={styles.batchSelectionPanel}>
          <View style={styles.batchSelectionText}>
            <Text style={styles.batchSelectionTitle}>
              {selectedCount}/{totalCount} selected
            </Text>
            <Text style={styles.batchSelectionDetail} numberOfLines={1}>
              {startName ? `Starts with ${startName}` : "Ready to start"}
            </Text>
          </View>
          <View style={styles.batchActions}>
            <Pressable style={styles.batchStartButton} onPress={onStart}>
              <Text style={styles.batchStartButtonText}>Start Mushaf</Text>
            </Pressable>
            <Pressable style={styles.batchClearButton} onPress={onClear}>
              <Text style={styles.batchClearButtonText}>Clear</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.batchEmptyPanel}>
          <Text style={styles.batchEmptyText}>Pick a starting card.</Text>
        </View>
      )}
    </View>
  );
}

export default function ReviewScreen() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();
  const todayLocal = getLocalDateHeaderValue();
  const [selectedMushafSurahIds, setSelectedMushafSurahIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: ReviewQueueResponse }
  >({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadRequestRef = useRef(0);
  const navChildId = typeof childId === "string" ? childId : undefined;
  const navName = typeof name === "string" ? name : "";
  const navReviewCount = state.status === "ok" ? state.data.dueToday.length : undefined;

  const load = useCallback(
    async (
      mode: "initial" | "refresh" = "initial",
      reviewDate = todayLocal,
    ) => {
      const requestId = loadRequestRef.current + 1;
      loadRequestRef.current = requestId;

      if (mode === "initial") {
        setState({ status: "loading" });
      } else {
        setRefreshing(true);
      }
      try {
        const continueOffset = parseContinueOffset(
          await AsyncStorage.getItem(continueReviewingKey(childId, todayLocal)),
        );
        const data = await fetchReviewQueue(childId, reviewDate, {
          continueIntoTomorrow: continueOffset > 0,
          continueOffset,
        });

        if (loadRequestRef.current !== requestId) return;

        setState({ status: "ok", data });
      } catch (e) {
        if (loadRequestRef.current !== requestId) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load",
        });
      } finally {
        if (loadRequestRef.current === requestId) {
          setRefreshing(false);
        }
      }
    },
    [childId, todayLocal],
  );

  useFocusEffect(
    useCallback(() => {
      const mode = hasLoadedRef.current ? "refresh" : "initial";
      hasLoadedRef.current = true;
      void load(mode, todayLocal);
    }, [load, todayLocal]),
  );

  function handleCardPress(item: ReviewQueueItem, batchItems?: ReviewQueueItem[]) {
    const params: { childId: string; [key: string]: string } = {
      childId,
      name: name ?? "",
      surahId: String(item.surahId),
      surahNumber: String(item.surahNumber),
      surahName: item.surahName ?? "",
      ayahStart: String(item.ayahStart),
      ayahEnd: String(item.ayahEnd),
      pageStart: String(item.pageStart),
      pageEnd: String(item.pageEnd),
      chunkIndex: String(item.chunkIndex),
      chunkCount: String(item.chunkCount),
      reviewDate: todayLocal,
    };
    if (batchItems && batchItems.length > 1) {
      params.batchQueue = JSON.stringify(batchItems.map(serializableReviewItem));
    }

    router.push({
      pathname: "/child/[childId]/review-session",
      params,
    });
  }

  async function handleContinueReviewing() {
    setSelectedMushafSurahIds([]);
    const key = continueReviewingKey(childId, todayLocal);
    const currentOffset = parseContinueOffset(await AsyncStorage.getItem(key));
    await AsyncStorage.setItem(key, String(currentOffset + 1));
    await load("initial", todayLocal);
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Reviews" onBack={() => router.back()} sideWidth={60} />

      {state.status === "loading" && (
        <LoadingState label="Loading review queue" />
      )}

      {state.status === "error" && (
        <ErrorState
          message={`Review queue could not load. ${state.message}`}
          onRetry={() => load("initial", todayLocal)}
        />
      )}

      {state.status === "ok" && (
        <ScreenScrollView
          contentContainerStyle={styles.reviewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh", todayLocal)}
              tintColor="#2563eb"
            />
          }
        >
          {(() => {
            const reviewedToday = state.data.reviewedToday ?? [];
            const reviewedSurahIds = new Set(reviewedToday.map((item) => item.surahId));
            const dueToday = (state.data.dueToday ?? []).filter(
              (item) => !reviewedSurahIds.has(item.surahId),
            );
            const upcoming = (state.data.upcoming ?? []).filter(
              (item) => !reviewedSurahIds.has(item.surahId),
            );
            const activeDateLabel = formatReviewDayLabel(todayLocal);
            const isFullyEmpty =
              dueToday.length === 0 &&
              reviewedToday.length === 0 &&
              upcoming.length === 0;
            const isReviewDayComplete =
              dueToday.length === 0 && reviewedToday.length > 0;
            const upcomingCount = upcoming.length;
            const pendingIds = new Set(dueToday.map((item) => item.surahId));
            const activeSelectedIds = selectedMushafSurahIds.filter((surahId) =>
              pendingIds.has(surahId),
            );
            const hasBatchSelection = activeSelectedIds.length > 0;
            const selectedPendingIndices = dueToday.reduce<number[]>(
              (acc, item, index) => {
                if (activeSelectedIds.includes(item.surahId)) {
                  acc.push(index);
                }
                return acc;
              },
              [],
            );
            const selectedBatchStartIndex = selectedPendingIndices[0] ?? null;
            const selectedBatchEndIndex =
              selectedPendingIndices[selectedPendingIndices.length - 1] ?? null;
            const selectedBatchItems = dueToday.filter((item) =>
              activeSelectedIds.includes(item.surahId),
            );
            const selectedBatchStartItem = selectedBatchItems[0] ?? null;
            const batchNeighborIndices = new Set<number>();
            if (selectedBatchStartIndex !== null && selectedBatchStartIndex > 0) {
              batchNeighborIndices.add(selectedBatchStartIndex - 1);
            }
            if (
              selectedBatchEndIndex !== null &&
              selectedBatchEndIndex < dueToday.length - 1
            ) {
              batchNeighborIndices.add(selectedBatchEndIndex + 1);
            }
            const toggleBatchSelection = (itemIndex: number) => {
              const item = dueToday[itemIndex];
              if (!item) return;

              setSelectedMushafSurahIds((prev) => {
                const currentIds = prev.filter((surahId) => pendingIds.has(surahId));
                const orderedSelectedIndices = dueToday.reduce<number[]>(
                  (acc, pendingItem, pendingIndex) => {
                    if (currentIds.includes(pendingItem.surahId)) {
                      acc.push(pendingIndex);
                    }
                    return acc;
                  },
                  [],
                );
                const isSelected = currentIds.includes(item.surahId);

                if (orderedSelectedIndices.length === 0) {
                  return [item.surahId];
                }

                const firstIndex = orderedSelectedIndices[0]!;
                const lastIndex = orderedSelectedIndices[orderedSelectedIndices.length - 1]!;

                if (isSelected) {
                  if (orderedSelectedIndices.length === 1) return [];
                  if (itemIndex === firstIndex) {
                    return dueToday
                      .slice(firstIndex + 1, lastIndex + 1)
                      .map((pendingItem) => pendingItem.surahId);
                  }
                  if (itemIndex === lastIndex) {
                    return dueToday
                      .slice(firstIndex, lastIndex)
                      .map((pendingItem) => pendingItem.surahId);
                  }
                  return currentIds;
                }

                if (itemIndex === firstIndex - 1 || itemIndex === lastIndex + 1) {
                  return dueToday
                    .slice(
                      Math.min(itemIndex, firstIndex),
                      Math.max(itemIndex, lastIndex) + 1,
                    )
                    .map((pendingItem) => pendingItem.surahId);
                }

                return currentIds;
              });
            };

            return (
              <>
                <QueueSummary
                  dueCount={dueToday.length}
                  reviewedCount={reviewedToday.length}
                  upcomingCount={upcomingCount}
                  activeDateLabel={activeDateLabel}
                />

                <ReviewSpecificSurahCard onPress={() => setPickerOpen(true)} />

                {dueToday.length > 0 && (
                  <>
                    <SectionLabel>Due Today</SectionLabel>
                    {dueToday.length > 1 && (
                      <ReviewBatchPicker
                        selectedCount={activeSelectedIds.length}
                        totalCount={dueToday.length}
                        startName={selectedBatchStartItem?.surahName}
                        allSelected={activeSelectedIds.length === dueToday.length}
                        onToggleAll={() =>
                          setSelectedMushafSurahIds(
                            activeSelectedIds.length === dueToday.length
                              ? []
                              : dueToday.map((item) => item.surahId),
                          )
                        }
                        onClear={() => setSelectedMushafSurahIds([])}
                        onStart={() => {
                          if (selectedBatchItems.length === 0) return;
                          setSelectedMushafSurahIds([]);
                          handleCardPress(selectedBatchItems[0]!, selectedBatchItems);
                        }}
                      />
                    )}
                    {dueToday.map((item, index) => (
                      <ReviewCard
                        key={itemKey("due", item, index)}
                        item={item}
                        onPress={
                          hasBatchSelection
                            ? undefined
                            : () => handleCardPress(item)
                        }
                        batchState={
                          dueToday.length > 1
                            ? {
                                active: hasBatchSelection,
                                selected: activeSelectedIds.includes(item.surahId),
                                neighbor:
                                  hasBatchSelection && batchNeighborIndices.has(index),
                                canToggle:
                                  !hasBatchSelection ||
                                  activeSelectedIds.includes(item.surahId) ||
                                  batchNeighborIndices.has(index),
                                onToggle: () => toggleBatchSelection(index),
                              }
                            : undefined
                        }
                      />
                    ))}
                  </>
                )}

                {isReviewDayComplete && (
                  <TodaysWorkCompletePanel />
                )}

                {dueToday.length === 0 && (
                  <ContinueReviewingButton
                    onPress={() => {
                      void handleContinueReviewing();
                    }}
                  />
                )}

                {reviewedToday.length > 0 && (
                  <>
                    <View style={dueToday.length > 0 ? styles.sectionWithSpace : undefined}>
                      <SectionLabel>Reviewed Today</SectionLabel>
                    </View>
                    {reviewedToday.map((item, index) => (
                      <ReviewCard
                        key={itemKey("reviewed", item, index)}
                        item={item}
                        variant="reviewed"
                      />
                    ))}
                  </>
                )}

                {dueToday.length === 0 && upcoming.length > 0 && (
                  <>
                    <View
                      style={
                        reviewedToday.length > 0
                          ? styles.sectionWithSpace
                          : undefined
                      }
                    >
                      <SectionLabel>Upcoming Reviews</SectionLabel>
                    </View>
                    {upcoming.slice(0, 8).map((item, index) => (
                      <ReviewCard
                        key={itemKey("upcoming", item, index)}
                        item={item}
                        variant="upcoming"
                      />
                    ))}
                    {upcoming.length > 8 && (
                      <Text style={styles.moreQueuedText}>
                        +{upcoming.length - 8} more scheduled reviews
                      </Text>
                    )}
                  </>
                )}

                {isFullyEmpty && (
                  <EmptyState
                    title="No reviews scheduled yet"
                    detail="Memorized surahs will appear here when spaced repetition starts."
                  />
                )}
              </>
            );
          })()}
        </ScreenScrollView>
      )}

      <ReviewSpecificSurahSheet
        visible={pickerOpen}
        childId={childId}
        name={navName}
        todayLocal={todayLocal}
        onClose={() => setPickerOpen(false)}
      />

      <ChildBottomNav
        active="review"
        childId={navChildId}
        name={navName}
        reviewCount={navReviewCount}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  reviewContent: {
    gap: 10,
    paddingBottom: 112,
  },
  sectionWithSpace: {
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryKicker: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
  },
  summaryDetail: {
    color: "#d1d5db",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  summaryMetrics: {
    flexDirection: "row",
    gap: 8,
  },
  summaryMetric: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  summaryMetricValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  summaryMetricLabel: {
    color: "#555555",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  completePanel: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  completePanelTitle: {
    color: "#064e3b",
    fontSize: 16,
    fontWeight: "900",
  },
  continueReviewingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  continueReviewingButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  specificSurahCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  specificSurahIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  specificSurahText: {
    flex: 1,
    gap: 2,
  },
  specificSurahTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  specificSurahDetail: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  specificSheet: {
    maxHeight: "82%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  sheetIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIconButtonPlaceholder: {
    width: 34,
    height: 34,
  },
  surahSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
  },
  surahSearchInput: {
    flex: 1,
    minHeight: 44,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  sheetState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sheetStateText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  sheetErrorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  surahPickerList: {
    maxHeight: 430,
  },
  surahPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 12,
  },
  surahPriorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  surahPickerText: {
    flex: 1,
    gap: 2,
  },
  surahPickerTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  surahPickerDetail: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  rangePanel: {
    gap: 14,
  },
  rangeDetail: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  rangeSteppers: {
    flexDirection: "row",
    gap: 12,
  },
  rangeStepper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 10,
  },
  rangeStepperLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  rangeStepperControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  rangeStepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  rangeStepperButtonDisabled: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f1f5f9",
  },
  rangeStepperValue: {
    minWidth: 30,
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  startSpecificButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
  },
  startSpecificButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  batchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  batchHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  batchTitleWrap: {
    flex: 1,
    gap: 2,
  },
  batchTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  batchDetail: {
    color: "#555555",
    fontSize: 12,
    fontWeight: "600",
  },
  batchHeaderButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  batchHeaderButtonText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  batchSelectionPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 11,
  },
  batchSelectionText: {
    flex: 1,
    gap: 2,
  },
  batchSelectionTitle: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "800",
  },
  batchSelectionDetail: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "600",
  },
  batchActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchStartButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  batchStartButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  batchClearButton: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  batchClearButtonText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  batchEmptyPanel: {
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  batchEmptyText: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    paddingLeft: 18,
    gap: 6,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardReadOnly: {
    opacity: 0.95,
  },
  reviewedCard: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    paddingVertical: 12,
    paddingLeft: 44,
    shadowOpacity: 0,
    elevation: 0,
  },
  upcomingCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
    paddingVertical: 11,
    paddingHorizontal: 12,
    paddingLeft: 16,
    gap: 4,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardSelectedForBatch: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  cardNeighborForBatch: {
    borderColor: "#93c5fd",
    backgroundColor: "#f8fbff",
  },
  cardBlockedForBatch: {
    opacity: 0.72,
  },
  priorityRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  reviewedCheckRail: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  upcomingCardTop: {
    gap: 7,
  },
  surahName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  reviewedSurahName: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "800",
  },
  upcomingSurahName: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  chunkBadge: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "800",
  },
  reviewedChunkBadge: {
    color: "#9ca3af",
  },
  batchSelectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  batchSelectCircleSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  batchSelectCircleNeighbor: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  batchSelectCircleDisabled: {
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardSub: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  reviewedCardSub: {
    color: "#6b7280",
    fontSize: 12,
  },
  upcomingCardSub: {
    color: "#64748b",
    fontSize: 12,
  },
  statusBadge: {
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 9,
    fontSize: 11,
    fontWeight: "800",
  },
  reviewedStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  upcomingStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  upcomingDate: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  batchCardHint: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "800",
  },
  batchCardHintSelected: {
    color: "#1d4ed8",
  },
  moreQueuedText: {
    textAlign: "center",
    color: "#666666",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
  },
});
