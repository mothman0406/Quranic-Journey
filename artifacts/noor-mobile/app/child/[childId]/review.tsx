import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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

type CompletedDaySection = {
  date: string;
  items: CompletedReviewItem[];
  sessionTotal: number;
};

const REVIEW_LOOKAHEAD_DAYS = 45;

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

function tomorrowLocalDate() {
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateHeaderValue(tomorrow);
}

function getLocalDateHeaderValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isLocalDateValue(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function activeReviewDateKey(childId: string) {
  return `noorpath:review-active-date:${childId}`;
}

function reviewSessionKey(childId: string, reviewDate: string) {
  return `noorpath:review-session:${childId}:${reviewDate}`;
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

async function loadStoredActiveReviewDate(childId: string, todayLocal: string) {
  try {
    const storedDate = await AsyncStorage.getItem(activeReviewDateKey(childId));
    if (!isLocalDateValue(storedDate) || storedDate < todayLocal) return todayLocal;
    return storedDate;
  } catch {
    return todayLocal;
  }
}

async function saveStoredActiveReviewDate(childId: string, reviewDate: string) {
  try {
    await AsyncStorage.setItem(activeReviewDateKey(childId), reviewDate);
  } catch {
    // best-effort persistence only
  }
}

function nextScheduledReviewDate(activeLocalDate: string, upcoming: ReviewQueueItem[]) {
  return (
    upcoming
      .map((item) => item.dueDate)
      .filter((dueDate) => dueDate > activeLocalDate)
      .sort()[0] ?? null
  );
}

async function resolveNextOpenReviewDate(
  childId: string,
  activeLocalDate: string,
  upcoming: ReviewQueueItem[],
) {
  const nextScheduledDate = nextScheduledReviewDate(activeLocalDate, upcoming);
  if (nextScheduledDate) return nextScheduledDate;

  let candidate = addDaysToLocalDate(activeLocalDate, 1);
  for (let offset = 0; offset < REVIEW_LOOKAHEAD_DAYS; offset += 1) {
    const session = await loadStoredReviewSession(childId, candidate);
    if (!isStoredReviewSessionComplete(session)) return candidate;
    candidate = addDaysToLocalDate(candidate, 1);
  }

  return candidate;
}

async function loadCompletedDaySections(
  childId: string,
  todayLocal: string,
  activeLocalDate: string,
): Promise<CompletedDaySection[]> {
  if (activeLocalDate <= todayLocal) return [];

  const sections: CompletedDaySection[] = [];
  let candidate = todayLocal;

  for (
    let offset = 0;
    offset < REVIEW_LOOKAHEAD_DAYS && candidate < activeLocalDate;
    offset += 1
  ) {
    const session = await loadStoredReviewSession(childId, candidate);
    const items = session?.completedItemsData ?? [];

    if (isStoredReviewSessionComplete(session) && items.length > 0) {
      sections.push({
        date: candidate,
        items,
        sessionTotal: Number(session?.sessionTotal ?? items.length),
      });
    }

    candidate = addDaysToLocalDate(candidate, 1);
  }

  return sections;
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
  const summaryCopy =
    dueCount > 0
      ? `${dueCount} review${dueCount === 1 ? "" : "s"} ready for ${formatReviewDayInSentence(activeDateLabel)}.`
      : reviewedCount > 0
      ? `${activeDateLabel}'s review queue is complete.`
      : upcomingCount > 0
      ? `No reviews due for ${formatReviewDayInSentence(activeDateLabel)}. The next queue is visible below.`
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

function CompletionCelebrationCard({
  reviewedCount,
  tomorrowCount,
  onStartTomorrow,
  onDismiss,
}: {
  reviewedCount: number;
  tomorrowCount: number;
  onStartTomorrow: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.celebrationCard}>
      <View style={styles.celebrationIcon}>
        <Ionicons name="checkmark-circle" size={44} color="#16a34a" />
      </View>
      <Text style={styles.celebrationTitle}>All caught up!</Text>
      <Text style={styles.celebrationDetail}>
        Great work - {reviewedCount} review{reviewedCount === 1 ? "" : "s"} done today.
      </Text>
      {tomorrowCount > 0 && (
        <Pressable style={styles.celebrationPrimaryButton} onPress={onStartTomorrow}>
          <Text style={styles.celebrationPrimaryButtonText}>
            Start tomorrow's reviews early
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#ffffff" />
        </Pressable>
      )}
      <Pressable style={styles.celebrationDismissButton} onPress={onDismiss}>
        <Text style={styles.celebrationDismissText}>Done for today</Text>
      </Pressable>
    </View>
  );
}

function DayStateCard({
  tone,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  tone: "complete" | "clear";
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const isComplete = tone === "complete";
  const color = isComplete ? "#047857" : "#0f766e";
  return (
    <View
      style={[
        styles.dayStateCard,
        isComplete ? styles.dayStateComplete : styles.dayStateClear,
      ]}
    >
      <Ionicons
        name={isComplete ? "checkmark-circle-outline" : "leaf-outline"}
        size={22}
        color={color}
      />
      <View style={styles.dayStateText}>
        <Text style={[styles.dayStateTitle, { color }]}>{title}</Text>
        <Text style={styles.dayStateDetail}>{detail}</Text>
        {actionLabel && onAction ? (
          <Pressable style={styles.dayStateAction} onPress={onAction}>
            <Text style={styles.dayStateActionText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={15} color="#ffffff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CompletedDaySectionsCard({ sections }: { sections: CompletedDaySection[] }) {
  if (sections.length === 0) return null;

  return (
    <View style={styles.completedDaysCard}>
      <View style={styles.completedDaysHeader}>
        <View style={styles.completedDaysTitleWrap}>
          <Text style={styles.completedDaysTitle}>Completed Review Days</Text>
          <Text style={styles.completedDaysDetail}>
            Ahead-day work stays grouped by the day it belonged to.
          </Text>
        </View>
        <View style={styles.completedDaysBadge}>
          <Text style={styles.completedDaysBadgeText}>
            {sections.length} {sections.length === 1 ? "day" : "days"}
          </Text>
        </View>
      </View>

      {sections.map((section) => (
        <View key={section.date} style={styles.completedDayGroup}>
          <View style={styles.completedDayGroupHeader}>
            <View>
              <Text style={styles.completedDayGroupTitle}>
                {formatReviewDayLabel(section.date)}
              </Text>
              <Text style={styles.completedDayGroupDate}>{section.date}</Text>
            </View>
            <Text style={styles.completedDayGroupCount}>
              {section.items.length}/{section.sessionTotal} done
            </Text>
          </View>
          {section.items.map((item) => (
            <View
              key={`${section.date}-${item.surahId}-${item.ayahStart ?? 0}`}
              style={styles.completedDayRow}
            >
              <Ionicons name="checkmark-circle" size={17} color="#16a34a" />
              <View style={styles.completedDayRowText}>
                <Text style={styles.completedDayRowTitle} numberOfLines={1}>
                  {item.surahName ?? `Surah ${item.surahNumber}`}
                </Text>
                <Text style={styles.completedDayRowDetail}>
                  {formatAyahRange(completedItemToReviewQueueItem(item, section.date, 0))}
                </Text>
              </View>
              <Text style={styles.completedDayRowStatus}>Reviewed</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
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
  const [activeLocalDate, setActiveLocalDate] = useState(todayLocal);
  const [currentStoredSession, setCurrentStoredSession] =
    useState<StoredReviewSession | null>(null);
  const [completedDaySections, setCompletedDaySections] = useState<
    CompletedDaySection[]
  >([]);
  const [nextOpenReviewDate, setNextOpenReviewDate] = useState<string | null>(null);
  const [selectedMushafSurahIds, setSelectedMushafSurahIds] = useState<number[]>([]);
  const [startTomorrowEarly, setStartTomorrowEarly] = useState(false);
  const [completionDismissed, setCompletionDismissed] = useState(false);

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: ReviewQueueResponse }
  >({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const activeDateRef = useRef(todayLocal);
  const loadRequestRef = useRef(0);
  const navChildId = typeof childId === "string" ? childId : undefined;
  const navName = typeof name === "string" ? name : "";
  const navReviewCount = state.status === "ok" ? state.data.dueToday.length : undefined;

  useEffect(() => {
    activeDateRef.current = activeLocalDate;
  }, [activeLocalDate]);

  const load = useCallback(
    async (
      mode: "initial" | "refresh" = "initial",
      reviewDate = activeDateRef.current,
    ) => {
      const requestId = loadRequestRef.current + 1;
      loadRequestRef.current = requestId;

      if (mode === "initial") {
        setState({ status: "loading" });
      } else {
        setRefreshing(true);
      }
      try {
        await saveStoredActiveReviewDate(childId, reviewDate);
        const data = await fetchReviewQueue(childId, reviewDate);
        const storedSession = await saveReviewSessionFromQueue(childId, reviewDate, data);
        const [sections, nextDate] = await Promise.all([
          loadCompletedDaySections(childId, todayLocal, reviewDate),
          resolveNextOpenReviewDate(childId, reviewDate, data.upcoming ?? []),
        ]);

        if (loadRequestRef.current !== requestId) return;

        setCurrentStoredSession(storedSession);
        setCompletedDaySections(sections);
        setNextOpenReviewDate(nextDate);
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
      let cancelled = false;

      void (async () => {
        const storedActiveDate = await loadStoredActiveReviewDate(childId, todayLocal);
        if (cancelled) return;

        if (storedActiveDate !== activeDateRef.current) {
          activeDateRef.current = storedActiveDate;
          setActiveLocalDate(storedActiveDate);
        }
        await load(mode, storedActiveDate);
      })();

      return () => {
        cancelled = true;
      };
    }, [childId, load, todayLocal]),
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
      reviewDate: activeLocalDate,
    };
    if (batchItems && batchItems.length > 1) {
      params.batchQueue = JSON.stringify(batchItems.map(serializableReviewItem));
    }

    router.push({
      pathname: "/child/[childId]/review-session",
      params,
    });
  }

  function handleContinueReviewing(nextDate: string) {
    setStartTomorrowEarly(false);
    setCompletionDismissed(false);
    setSelectedMushafSurahIds([]);
    activeDateRef.current = nextDate;
    setActiveLocalDate(nextDate);
    void load("initial", nextDate);
  }

  function handleStartTomorrowEarly() {
    setStartTomorrowEarly(true);
    setCompletionDismissed(false);
    setSelectedMushafSurahIds([]);
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
          onRetry={() => load("initial", activeLocalDate)}
        />
      )}

      {state.status === "ok" && (
        <ScreenScrollView
          contentContainerStyle={styles.reviewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh", activeLocalDate)}
              tintColor="#2563eb"
            />
          }
        >
          {(() => {
            const storedCompletedItems =
              currentStoredSession?.date === activeLocalDate
                ? currentStoredSession.completedItemsData ?? []
                : [];
            const reviewedToday = mergeReviewedQueueItems(
              storedCompletedItems,
              state.data.reviewedToday ?? [],
              activeLocalDate,
            );
            const reviewedSurahIds = new Set(reviewedToday.map((item) => item.surahId));
            const baseDueToday = (state.data.dueToday ?? []).filter(
              (item) => !reviewedSurahIds.has(item.surahId),
            );
            const rawUpcoming = state.data.upcoming ?? [];
            const tomorrowDate = tomorrowLocalDate();
            const tomorrowUpcoming = rawUpcoming.filter(
              (item) =>
                item.dueDate === tomorrowDate && !reviewedSurahIds.has(item.surahId),
            );
            const promoteTomorrow =
              activeLocalDate === todayLocal &&
              startTomorrowEarly &&
              baseDueToday.length === 0;
            const promotedTomorrow = promoteTomorrow ? tomorrowUpcoming : [];
            const dueToday = promoteTomorrow
              ? [...baseDueToday, ...promotedTomorrow]
              : baseDueToday;
            const upcoming = dueToday.length === 0 ? tomorrowUpcoming : [];
            const nextRawUpcoming = rawUpcoming
              .map((item) => item.dueDate)
              .filter((dueDate) => dueDate > activeLocalDate)
              .sort()[0];
            const activeDateLabel = formatReviewDayLabel(activeLocalDate);
            const nextOpenReviewLabel = nextOpenReviewDate
              ? formatReviewDayLabel(nextOpenReviewDate)
              : null;
            const isFullyEmpty =
              dueToday.length === 0 &&
              reviewedToday.length === 0 &&
              rawUpcoming.length === 0;
            const isCompleteToday = dueToday.length === 0 && reviewedToday.length > 0;
            const showCompletionCelebration =
              activeLocalDate === todayLocal && isCompleteToday && !completionDismissed;
            const hasFutureReviews =
              dueToday.length === 0 &&
              reviewedToday.length === 0 &&
              rawUpcoming.length > 0;
            const upcomingCount =
              promoteTomorrow && promotedTomorrow.length > 0 ? 0 : tomorrowUpcoming.length;
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
            const hasTomorrowItems = tomorrowUpcoming.length > 0;
            const willRenderUpcoming = upcoming.length > 0;

            console.log("[noor-review-queue] section-decisions", {
              dueTodayCount: dueToday.length,
              reviewedTodayCount: reviewedToday.length,
              upcomingCount: tomorrowUpcoming.length,
              celebrationCardCondition: {
                dueTodayEmpty: dueToday.length === 0,
                hasReviewedToday: reviewedToday.length > 0,
                hasTomorrowItems,
              },
              willRenderCelebrationCard: showCompletionCelebration,
            });
            console.log("[noor-review-queue] upcoming-decision", {
              dueTodayCount: dueToday.length,
              hasTomorrowItems,
              willRenderUpcoming,
            });
            if (promoteTomorrow) {
              console.log("[noor-review-queue] promote-tomorrow-result", {
                dueTodayCountAfterPromotion: dueToday.length,
                tomorrowItemsCount: tomorrowUpcoming.length,
              });
            }

            return (
              <>
                <QueueSummary
                  dueCount={dueToday.length}
                  reviewedCount={reviewedToday.length}
                  upcomingCount={upcomingCount}
                  activeDateLabel={activeDateLabel}
                />

                <CompletedDaySectionsCard sections={completedDaySections} />

                {dueToday.length > 0 && (
                  <>
                    <SectionLabel>
                      {activeLocalDate === todayLocal
                        ? "Due Today"
                        : `Due ${activeDateLabel}`}
                    </SectionLabel>
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

                {showCompletionCelebration &&
                  (() => {
                    console.log("[noor-review-queue] celebration-render", {
                      message: "celebration-card-rendered",
                      tomorrowItemsCount: tomorrowUpcoming.length,
                      isPromoted: startTomorrowEarly,
                    });
                    return (
                      <CompletionCelebrationCard
                        reviewedCount={reviewedToday.length}
                        tomorrowCount={tomorrowUpcoming.length}
                        onStartTomorrow={() => {
                          console.log("[noor-review-queue] promote-tomorrow-tap", {
                            tomorrowItemsCount: tomorrowUpcoming.length,
                            action: "setStartTomorrowEarly(true)",
                          });
                          handleStartTomorrowEarly();
                        }}
                        onDismiss={() => setCompletionDismissed(true)}
                      />
                    );
                  })()}

                {hasFutureReviews && (
                  <DayStateCard
                    tone="clear"
                    title={`No reviews due ${formatReviewDayInSentence(activeDateLabel)}`}
                    detail={
                      upcoming.length > 0
                        ? "Tomorrow's reviews are ready when you want them."
                        : `Next scheduled review: ${
                            nextRawUpcoming ? formatDueDate(nextRawUpcoming) : "soon"
                          }.`
                    }
                    actionLabel={
                      upcoming.length > 0
                        ? "Start tomorrow's reviews early"
                        : nextOpenReviewLabel
                        ? `Continue Reviewing ${nextOpenReviewLabel}`
                        : undefined
                    }
                    onAction={
                      upcoming.length > 0
                        ? handleStartTomorrowEarly
                        : nextOpenReviewDate
                        ? () => handleContinueReviewing(nextOpenReviewDate)
                        : undefined
                    }
                  />
                )}

                {reviewedToday.length > 0 && (
                  <>
                    <View style={dueToday.length > 0 ? styles.sectionWithSpace : undefined}>
                      <SectionLabel>
                        {activeLocalDate === todayLocal
                          ? "Reviewed Today"
                          : `Reviewed ${activeDateLabel}`}
                      </SectionLabel>
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

                {upcoming.length > 0 && (
                  <>
                    <View
                      style={
                        dueToday.length > 0 || reviewedToday.length > 0
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
  celebrationCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 8,
  },
  celebrationIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  celebrationTitle: {
    color: "#064e3b",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  celebrationDetail: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
  },
  celebrationPrimaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#16a34a",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  celebrationPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  celebrationDismissButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  celebrationDismissText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
  },
  dayStateCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
  },
  dayStateComplete: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  dayStateClear: {
    backgroundColor: "#f0fdfa",
    borderColor: "#99f6e4",
  },
  dayStateText: {
    flex: 1,
    gap: 3,
  },
  dayStateTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  dayStateDetail: {
    color: "#555555",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  dayStateAction: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dayStateActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  completedDaysCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    padding: 14,
    gap: 12,
  },
  completedDaysHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  completedDaysTitleWrap: {
    flex: 1,
    gap: 2,
  },
  completedDaysTitle: {
    color: "#064e3b",
    fontSize: 14,
    fontWeight: "800",
  },
  completedDaysDetail: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  completedDaysBadge: {
    backgroundColor: "#ffffff",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  completedDaysBadgeText: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "800",
  },
  completedDayGroup: {
    backgroundColor: "#ffffff",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 11,
    gap: 9,
  },
  completedDayGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  completedDayGroupTitle: {
    color: "#064e3b",
    fontSize: 13,
    fontWeight: "800",
  },
  completedDayGroupDate: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  completedDayGroupCount: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
  },
  completedDayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#f0fdf4",
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  completedDayRowText: {
    flex: 1,
    gap: 1,
  },
  completedDayRowTitle: {
    color: "#064e3b",
    fontSize: 13,
    fontWeight: "700",
  },
  completedDayRowDetail: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "600",
  },
  completedDayRowStatus: {
    color: "#16a34a",
    fontSize: 11,
    fontWeight: "800",
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
