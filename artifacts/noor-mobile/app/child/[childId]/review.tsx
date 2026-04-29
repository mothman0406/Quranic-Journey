import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  const navChildId = typeof childId === "string" ? childId : undefined;
  const navName = typeof name === "string" ? name : "";
  const navReviewCount = state.status === "ok" ? state.data.dueToday.length : undefined;

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
    <ScreenContainer>
      <ScreenHeader title="Reviews" onBack={() => router.back()} sideWidth={60} />

      {state.status === "loading" && (
        <LoadingState />
      )}

      {state.status === "error" && (
        <ErrorState message={state.message} onRetry={load} />
      )}

      {state.status === "ok" && (
        <ScreenScrollView contentContainerStyle={styles.reviewContent}>
          {state.data.dueToday.length === 0 && state.data.reviewedToday.length === 0 ? (
            <EmptyState title="No reviews due today" />
          ) : (
            <>
              {state.data.dueToday.length > 0 && (
                <>
                  <SectionLabel>Due Today</SectionLabel>
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
                  <View
                    style={
                      state.data.dueToday.length > 0
                        ? styles.reviewedSectionLabel
                        : undefined
                    }
                  >
                    <SectionLabel>Reviewed Today</SectionLabel>
                  </View>
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
  },
  reviewedSectionLabel: {
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
