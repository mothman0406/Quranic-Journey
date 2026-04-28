import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchReviewQueue, ReviewQueueItem, ReviewQueueResponse } from "@/src/lib/reviews";
import { getReviewPriorityStyle } from "@/src/lib/review-priority";

function PriorityPill({ priority }: { priority: string }) {
  const priorityStyle = getReviewPriorityStyle(priority);
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: priorityStyle.bg,
          borderColor: priorityStyle.border,
        },
      ]}
    >
      <View style={[styles.pillDot, { backgroundColor: priorityStyle.text }]} />
      <Text style={[styles.pillText, { color: priorityStyle.text }]}>
        {priorityStyle.label}
      </Text>
    </View>
  );
}

function ReviewCard({
  item,
  onPress,
}: {
  item: ReviewQueueItem;
  onPress: () => void;
}) {
  const pageLabel =
    item.pageStart === item.pageEnd
      ? `Page ${item.pageStart}`
      : `Pages ${item.pageStart}–${item.pageEnd}`;
  const priorityStyle = getReviewPriorityStyle(item.reviewPriority);

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: priorityStyle.cardBg,
          borderColor: priorityStyle.border,
        },
      ]}
      onPress={onPress}
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
      <Text style={styles.cardSub}>
        Ayahs {item.ayahStart}–{item.ayahEnd} · {pageLabel}
      </Text>
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

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await fetchReviewQueue(childId);
      setState({ status: "ok", data });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Failed to load" });
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Reviews</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.status === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}

      {state.status === "error" && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {state.status === "ok" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {state.data.dueToday.length === 0 && state.data.reviewedToday.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No reviews due today</Text>
            </View>
          ) : (
            <>
              {state.data.dueToday.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Due Today</Text>
                  {state.data.dueToday.map((item) => (
                    <ReviewCard
                      key={item.id}
                      item={item}
                      onPress={() => handleCardPress(item)}
                    />
                  ))}
                </>
              )}

              {state.data.reviewedToday.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
                    Reviewed Today
                  </Text>
                  {state.data.reviewedToday.map((item) => (
                    <View key={item.id} style={styles.doneCard}>
                      <Text style={styles.doneCheck}>✓</Text>
                      <View>
                        <Text style={styles.doneName}>
                          {item.surahName ?? `Surah ${item.surahNumber}`}
                        </Text>
                        <Text style={styles.doneSub}>
                          Ayahs {item.ayahStart}–{item.ayahEnd}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  back: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "500",
    width: 60,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
  },
  headerSpacer: {
    width: 60,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  scrollContent: {
    padding: 20,
    gap: 10,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 17,
    color: "#666666",
    textAlign: "center",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionHeaderSpaced: {
    marginTop: 20,
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
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
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
  cardSub: {
    fontSize: 13,
    color: "#555555",
  },
  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
  },
  doneCheck: {
    fontSize: 18,
    color: "#16a34a",
    fontWeight: "700",
  },
  doneName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  doneSub: {
    fontSize: 13,
    color: "#555555",
  },
});
