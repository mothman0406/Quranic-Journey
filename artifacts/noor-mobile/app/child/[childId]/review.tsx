import React, { useCallback, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

function formatDueDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value || "Scheduled";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
}: {
  dueCount: number;
  reviewedCount: number;
  upcomingCount: number;
}) {
  const summaryCopy =
    dueCount > 0
      ? `${dueCount} review${dueCount === 1 ? "" : "s"} ready for today.`
      : reviewedCount > 0
      ? "Today's review queue is complete."
      : upcomingCount > 0
      ? "No reviews due today. The next queue is visible below."
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

function DayStateCard({
  tone,
  title,
  detail,
}: {
  tone: "complete" | "clear";
  title: string;
  detail: string;
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
      </View>
    </View>
  );
}

function ReviewCard({
  item,
  onPress,
  variant = "due",
}: {
  item: ReviewQueueItem;
  onPress?: () => void;
  variant?: "due" | "upcoming" | "reviewed";
}) {
  const pageLabel = formatPageRange(item);
  const priorityStyle = getReviewPriorityStyle(item.reviewPriority);
  const isReviewed = variant === "reviewed";
  const isUpcoming = variant === "upcoming";
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
        {
          backgroundColor: priorityStyle.cardBg,
          borderColor: priorityStyle.border,
        },
        !onPress && styles.cardReadOnly,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.priorityRail, { backgroundColor: priorityStyle.text }]} />
      <View style={styles.cardTop}>
        <PriorityPill priority={item.reviewPriority} />
        <Text style={styles.surahName} numberOfLines={1}>
          {item.surahName ?? `Surah ${item.surahNumber}`}
        </Text>
        {item.isPartialReview && (
          <Text style={styles.chunkBadge}>
            {item.chunkIndex} of {item.chunkCount}
          </Text>
        )}
      </View>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardSub}>
          {formatAyahRange(item)} · {pageLabel}
        </Text>
        <Text
          style={[
            styles.statusBadge,
            {
              color: isReviewed ? "#047857" : priorityStyle.text,
              backgroundColor: isReviewed ? "#ecfdf5" : priorityStyle.bg,
              borderColor: isReviewed ? "#a7f3d0" : priorityStyle.border,
            },
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      {isUpcoming && (
        <Text style={styles.upcomingDate}>Due {formatDueDate(item.dueDate)}</Text>
      )}
    </Pressable>
  );
}

export default function ReviewScreen() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: ReviewQueueResponse }
  >({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const navChildId = typeof childId === "string" ? childId : undefined;
  const navName = typeof name === "string" ? name : "";
  const navReviewCount = state.status === "ok" ? state.data.dueToday.length : undefined;

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setState({ status: "loading" });
    } else {
      setRefreshing(true);
    }
    try {
      const data = await fetchReviewQueue(childId);
      setState({ status: "ok", data });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Failed to load" });
    } finally {
      setRefreshing(false);
    }
  }, [childId]);

  useFocusEffect(
    useCallback(() => {
      const mode = hasLoadedRef.current ? "refresh" : "initial";
      hasLoadedRef.current = true;
      void load(mode);
    }, [load]),
  );

  function handleCardPress(item: ReviewQueueItem) {
    router.push({
      pathname: "/child/[childId]/review-session",
      params: {
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
      },
    });
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
          onRetry={() => load()}
        />
      )}

      {state.status === "ok" && (
        <ScreenScrollView
          contentContainerStyle={styles.reviewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load("refresh")}
              tintColor="#2563eb"
            />
          }
        >
          {(() => {
            const dueToday = state.data.dueToday ?? [];
            const upcoming = state.data.upcoming ?? [];
            const reviewedToday = state.data.reviewedToday ?? [];
            const isFullyEmpty =
              dueToday.length === 0 && reviewedToday.length === 0 && upcoming.length === 0;
            const isCompleteToday = dueToday.length === 0 && reviewedToday.length > 0;

            return (
              <>
                <QueueSummary
                  dueCount={dueToday.length}
                  reviewedCount={reviewedToday.length}
                  upcomingCount={upcoming.length}
                />

                {dueToday.length > 0 && (
                  <>
                    <SectionLabel>Due Today</SectionLabel>
                    {dueToday.map((item, index) => (
                      <ReviewCard
                        key={itemKey("due", item, index)}
                        item={item}
                        onPress={() => handleCardPress(item)}
                      />
                    ))}
                  </>
                )}

                {isCompleteToday && (
                  <DayStateCard
                    tone="complete"
                    title="Today's review is complete"
                    detail="The queue is clear. Finished items stay below for today's record."
                  />
                )}

                {dueToday.length === 0 && reviewedToday.length === 0 && upcoming.length > 0 && (
                  <DayStateCard
                    tone="clear"
                    title="No reviews due today"
                    detail={`Next scheduled review: ${formatDueDate(upcoming[0]!.dueDate)}.`}
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
    paddingBottom: 96,
  },
  sectionWithSpace: {
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: "#111111",
    borderRadius: 14,
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
    fontWeight: "800",
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
    borderRadius: 10,
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
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    paddingLeft: 18,
    gap: 6,
    overflow: "hidden",
  },
  cardReadOnly: {
    opacity: 0.95,
  },
  priorityRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  surahName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#111111",
  },
  chunkBadge: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "500",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardSub: {
    flex: 1,
    fontSize: 13,
    color: "#555555",
    lineHeight: 18,
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
  upcomingDate: {
    fontSize: 12,
    color: "#555555",
    fontWeight: "600",
  },
  moreQueuedText: {
    textAlign: "center",
    color: "#666666",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
  },
});
