import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ApiError,
  apiFetch,
  getApiRuntimeInfo,
} from "@/src/lib/api";
import { fetchReviewQueue, type ReviewQueueItem, type ReviewQueueResponse } from "@/src/lib/reviews";
import { getReviewPriorityStyle } from "@/src/lib/review-priority";

type WorkStatus = "not_started" | "in_progress" | "completed";

type DashboardChild = {
  name: string;
  avatarEmoji: string;
  streakDays: number;
  totalPoints: number;
};

type ChildDetail = DashboardChild & {
  readPagesPerDay: number;
};

type NewMemorization = {
  surahName: string;
  surahNumber: number;
  currentWorkSurahName?: string;
  currentWorkAyahStart?: number;
  currentWorkAyahEnd?: number;
  ayahStart: number;
  ayahEnd: number;
  pageStart: number;
  pageEnd: number;
  workLabel?: string;
  isReviewOnly?: boolean;
  estimatedMinutes?: number;
};

type TodayProgress = {
  memStatus: WorkStatus;
  reviewStatus: WorkStatus;
  reviewTargetCount: number | null;
  reviewCompletedCount: number;
};

type ReadingGoal = {
  targetPages: number;
  completedPages: number;
  lastPage: number | null;
  status: WorkStatus;
  isEnabled: boolean;
};

type DashboardResponse = {
  child: DashboardChild;
  todaysPlan: {
    newMemorization: NewMemorization | null;
    totalEstimatedMinutes: number;
  };
  reviewsDueToday: number;
  todayProgress?: TodayProgress;
  readingGoal: ReadingGoal | null;
};

type DiagnosticStep = {
  label: string;
  status: "ok" | "failed";
  detail: string;
};

type DashboardDiagnostics = ReturnType<typeof getApiRuntimeInfo> & {
  steps: DiagnosticStep[];
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string; diagnostics: DashboardDiagnostics }
  | {
      status: "ok";
      dashboard: DashboardResponse;
      reviews: ReviewQueueResponse | null;
      reviewError: string | null;
      dashboardError: string | null;
      diagnostics: DashboardDiagnostics;
    };

type CardTone = {
  accent: string;
  bg: string;
  border: string;
  soft: string;
};

const CARD_TONES: Record<"memorization" | "review" | "reading", CardTone> = {
  memorization: {
    accent: "#2563eb",
    bg: "#f8fbff",
    border: "#bfdbfe",
    soft: "#dbeafe",
  },
  review: {
    accent: "#ea580c",
    bg: "#fffaf5",
    border: "#fed7aa",
    soft: "#ffedd5",
  },
  reading: {
    accent: "#0f766e",
    bg: "#f5fffc",
    border: "#99f6e4",
    soft: "#ccfbf1",
  },
};

function formatAyahRange(start: number | undefined, end: number | undefined) {
  if (start == null || end == null) return "Ayahs";
  return start === end ? `Ayah ${start}` : `Ayahs ${start}-${end}`;
}

function formatPageRange(start: number | undefined, end: number | undefined) {
  if (start == null || end == null) return null;
  return start === end ? `Page ${start}` : `Pages ${start}-${end}`;
}

function formatDayStreak(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function makeDiagnostics(steps: DiagnosticStep[]): DashboardDiagnostics {
  return {
    ...getApiRuntimeInfo(),
    steps,
  };
}

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message} (${error.path}; cookie=${error.hasCookie ? "yes" : "no"})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown failure";
}

function fallbackChild(childId: string | undefined, name: string | undefined): ChildDetail {
  return {
    name: name || (childId ? `Child ${childId}` : "Child"),
    avatarEmoji: "?",
    streakDays: 0,
    totalPoints: 0,
    readPagesPerDay: 0,
  };
}

function isValidChildId(childId: string | undefined) {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function fallbackDashboard(
  child: ChildDetail,
  reviews: ReviewQueueResponse | null,
): DashboardResponse {
  const reviewCount = reviews?.dueToday.length ?? 0;
  const readPagesPerDay = child.readPagesPerDay ?? 0;

  return {
    child: {
      name: child.name,
      avatarEmoji: child.avatarEmoji,
      streakDays: child.streakDays,
      totalPoints: child.totalPoints,
    },
    todaysPlan: {
      newMemorization: null,
      totalEstimatedMinutes: 0,
    },
    reviewsDueToday: reviewCount,
    todayProgress: {
      memStatus: "not_started",
      reviewStatus: "not_started",
      reviewTargetCount: reviewCount,
      reviewCompletedCount: 0,
    },
    readingGoal: {
      targetPages: readPagesPerDay,
      completedPages: 0,
      lastPage: null,
      status: "not_started",
      isEnabled: readPagesPerDay > 0,
    },
  };
}

function WorkCard({
  title,
  eyebrow,
  detail,
  cta,
  tone,
  onPress,
  children,
}: {
  title: string;
  eyebrow: string;
  detail: string;
  cta: string;
  tone: CardTone;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: tone.soft }]}>
          <Text style={[styles.cardIconText, { color: tone.accent }]}>
            {title.charAt(0)}
          </Text>
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardEyebrow}>{eyebrow}</Text>
          <Text style={styles.cardLabel}>{title}</Text>
        </View>
        <Text style={[styles.cardAction, { color: tone.accent }]}>{cta}</Text>
      </View>
      <Text style={styles.cardDetail}>{detail}</Text>
      {children}
    </Pressable>
  );
}

function ReviewPreviewItem({ item }: { item: ReviewQueueItem }) {
  const priorityStyle = getReviewPriorityStyle(item.reviewPriority);
  const rangeLabel = formatAyahRange(item.ayahStart, item.ayahEnd);

  return (
    <View
      style={[
        styles.reviewPreview,
        {
          backgroundColor: priorityStyle.cardBg,
          borderColor: priorityStyle.border,
        },
      ]}
    >
      <View style={[styles.reviewDot, { backgroundColor: priorityStyle.text }]} />
      <View style={styles.reviewPreviewText}>
        <Text style={styles.reviewSurah} numberOfLines={1}>
          {item.surahName ?? `Surah ${item.surahNumber}`}
        </Text>
        <Text style={styles.reviewRange}>{rangeLabel}</Text>
      </View>
      <Text style={[styles.reviewPriority, { color: priorityStyle.text }]}>
        {priorityStyle.label}
      </Text>
    </View>
  );
}

function DashboardDiagnosticPanel({
  diagnostics,
}: {
  diagnostics: DashboardDiagnostics;
}) {
  return (
    <View style={styles.diagnosticBox}>
      <Text style={styles.diagnosticTitle}>
        NoorPath diagnostic · {diagnostics.marker}
      </Text>
      <Text style={styles.diagnosticText}>API: {diagnostics.baseURL}</Text>
      <Text style={styles.diagnosticText}>
        Local date: {diagnostics.localDate} · Cookie:{" "}
        {diagnostics.hasCookie ? "present" : "missing"}
      </Text>
      {diagnostics.steps.map((step, index) => (
        <Text
          key={`${step.label}-${index}`}
          style={[
            styles.diagnosticText,
            step.status === "failed" && styles.diagnosticFailed,
          ]}
        >
          {step.status === "ok" ? "OK" : "FAIL"} {step.label}: {step.detail}
        </Text>
      ))}
    </View>
  );
}

export default function ChildDashboard() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const steps: DiagnosticStep[] = [];
      const childIdParam = childId;
      const nameParam = name;

      if (mode === "initial") {
        setState({ status: "loading" });
      } else {
        setRefreshing(true);
      }

      if (!isValidChildId(childIdParam)) {
        steps.push({
          label: "route params",
          status: "failed",
          detail: childIdParam ? `invalid childId: ${childIdParam}` : "missing childId",
        });
        setState({
          status: "error",
          message: "This dashboard route is missing a valid child id. Go back and reopen the child profile.",
          diagnostics: makeDiagnostics(steps),
        });
        setRefreshing(false);
        return;
      }

      try {
        let dashboard: DashboardResponse;
        try {
          dashboard = await apiFetch<DashboardResponse>(
            `/api/children/${childIdParam}/dashboard`,
          );
          steps.push({
            label: "dashboard first attempt",
            status: "ok",
            detail: "200",
          });
        } catch (firstDashboardError) {
          steps.push({
            label: "dashboard first attempt",
            status: "failed",
            detail: describeError(firstDashboardError),
          });
          await wait(350);
          dashboard = await apiFetch<DashboardResponse>(
            `/api/children/${childIdParam}/dashboard`,
          );
          steps.push({
            label: "dashboard retry",
            status: "ok",
            detail: "200",
          });
        }
        let reviews: ReviewQueueResponse | null = null;
        let reviewError: string | null = null;

        try {
          reviews = await fetchReviewQueue(childIdParam);
          steps.push({
            label: "review queue",
            status: "ok",
            detail: "loaded",
          });
        } catch (e) {
          reviewError = describeError(e);
          steps.push({
            label: "review queue",
            status: "failed",
            detail: reviewError,
          });
        }

        setState({
          status: "ok",
          dashboard,
          reviews,
          reviewError,
          dashboardError: null,
          diagnostics: makeDiagnostics(steps),
        });
      } catch (e) {
        const dashboardError = describeError(e);
        let reviews: ReviewQueueResponse | null = null;
        let reviewError: string | null = null;
        let child: ChildDetail | null = null;

        try {
          reviews = await fetchReviewQueue(childIdParam);
          steps.push({
            label: "fallback review queue",
            status: "ok",
            detail: "loaded",
          });
        } catch (reviewFetchError) {
          reviewError = describeError(reviewFetchError);
          steps.push({
            label: "fallback review queue",
            status: "failed",
            detail: reviewError,
          });
        }

        try {
          child = await apiFetch<ChildDetail>(`/api/children/${childIdParam}`);
          steps.push({
            label: "fallback child fetch",
            status: "ok",
            detail: "loaded",
          });
        } catch (childFetchError) {
          const childError = describeError(childFetchError);
          steps.push({
            label: "fallback child fetch",
            status: "failed",
            detail: childError,
          });
          child = fallbackChild(childIdParam, nameParam);
        }

        setState({
          status: "ok",
          dashboard: fallbackDashboard(child, reviews),
          reviews,
          reviewError,
          dashboardError,
          diagnostics: makeDiagnostics(steps),
        });
      } finally {
        setRefreshing(false);
      }
    },
    [childId, name],
  );

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  function handleCardPress(key: string) {
    if (key === "review") {
      router.push({
        pathname: "/child/[childId]/review",
        params: { childId, name: name ?? "" },
      });
    } else if (key === "reading") {
      router.push({
        pathname: "/child/[childId]/mushaf",
        params: { childId, name: name ?? "" },
      });
    } else if (key === "memorization") {
      router.push({
        pathname: "/child/[childId]/memorization",
        params: { childId, name: name ?? "" },
      });
    }
  }

  function handleTargetsPress() {
    if (!isValidChildId(childId)) return;

    router.push({
      pathname: "/child/[childId]/targets",
      params: { childId, name: name ?? "" },
    });
  }

  function renderContent() {
    if (state.status === "loading") {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      );
    }

    if (state.status === "error") {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{state.message}</Text>
          <DashboardDiagnosticPanel diagnostics={state.diagnostics} />
          <Pressable style={styles.retryButton} onPress={() => loadDashboard()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    const { dashboard, reviews, reviewError, dashboardError, diagnostics } = state;
    const child = dashboard.child;
    const todaysMem = dashboard.todaysPlan.newMemorization;
    const todayProgress = dashboard.todayProgress;
    const memStatus = todayProgress?.memStatus ?? "not_started";
    const memSurah = todaysMem?.currentWorkSurahName ?? todaysMem?.surahName;
    const memAyahStart = todaysMem?.currentWorkAyahStart ?? todaysMem?.ayahStart;
    const memAyahEnd = todaysMem?.currentWorkAyahEnd ?? todaysMem?.ayahEnd;
    const memPageLabel = formatPageRange(todaysMem?.pageStart, todaysMem?.pageEnd);
    const memDetail = !todaysMem
      ? "No memorization assigned today."
      : memStatus === "completed"
      ? `${todaysMem.workLabel ?? "Memorization"} complete for ${todaysMem.surahName}.`
      : memStatus === "in_progress"
      ? `${memSurah} is in progress · ${formatAyahRange(memAyahStart, memAyahEnd)}${
          memPageLabel ? ` · ${memPageLabel}` : ""
        }`
      : `${todaysMem.workLabel ?? "New Memorization"} · ${memSurah} · ${formatAyahRange(
          memAyahStart,
          memAyahEnd,
        )}${memPageLabel ? ` · ${memPageLabel}` : ""}`;
    const memCta =
      memStatus === "completed" ? "Done" : memStatus === "in_progress" ? "Continue" : "Start";

    const dueItems = reviews?.dueToday ?? [];
    const reviewedItems = reviews?.reviewedToday ?? [];
    const reviewsDueToday = reviews ? dueItems.length : dashboard.reviewsDueToday;
    const reviewCompletedToday = Math.max(
      todayProgress?.reviewCompletedCount ?? 0,
      reviewedItems.length,
    );
    const reviewTarget =
      todayProgress?.reviewTargetCount != null
        ? Math.max(todayProgress.reviewTargetCount, reviewCompletedToday)
        : reviewsDueToday + reviewCompletedToday;
    const reviewDone =
      todayProgress?.reviewStatus === "completed" ||
      (reviewsDueToday === 0 && reviewCompletedToday > 0);
    const reviewDetail = reviewDone
      ? `Today's review complete · ${reviewCompletedToday}/${Math.max(
          reviewTarget,
          reviewCompletedToday,
        )} done`
      : reviewsDueToday > 0
      ? `${reviewsDueToday} review${reviewsDueToday === 1 ? "" : "s"} due today${
          reviewCompletedToday > 0 ? ` · ${reviewCompletedToday} done` : ""
        }`
      : reviewError
      ? "Review queue could not refresh."
      : "No reviews due today.";
    const reviewCta = reviewDone ? "Done" : reviewsDueToday > 0 ? "Review" : "Open";

    const readingGoal = dashboard.readingGoal;
    const readingEnabled = !!readingGoal?.isEnabled;
    const readingDetail = !readingEnabled
      ? "No reading goal set yet."
      : readingGoal.status === "completed"
      ? `Today's reading complete · ${readingGoal.completedPages}/${readingGoal.targetPages} pages`
      : readingGoal.status === "in_progress"
      ? `${readingGoal.completedPages}/${readingGoal.targetPages} pages read · resume page ${
          readingGoal.lastPage ?? 1
        }`
      : `Read ${readingGoal.targetPages} page${
          readingGoal.targetPages === 1 ? "" : "s"
        } today${readingGoal.lastPage ? ` · saved page ${readingGoal.lastPage}` : ""}`;
    const readingCta =
      readingGoal?.status === "completed"
        ? "Done"
        : readingGoal?.status === "in_progress"
        ? "Resume"
        : "Read";

    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard("refresh")}
            tintColor="#2563eb"
          />
        }
      >
        <View style={styles.summaryBand}>
          <Text style={styles.summaryAvatar}>{child.avatarEmoji}</Text>
          <View style={styles.summaryText}>
            <Text style={styles.summaryKicker}>Today</Text>
            <Text style={styles.summaryName}>{child.name}</Text>
          </View>
          <View style={styles.summaryStats}>
            <Text style={styles.summaryStat}>{formatDayStreak(child.streakDays)}</Text>
            <Text style={styles.summaryStatMuted}>{child.totalPoints} pts</Text>
          </View>
        </View>

        {dashboardError && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Today's plan is temporarily unavailable. Pull down to refresh shortly.
            </Text>
          </View>
        )}

        {(dashboardError || reviewError) && (
          <DashboardDiagnosticPanel diagnostics={diagnostics} />
        )}

        <WorkCard
          title="Memorization"
          eyebrow={todaysMem?.isReviewOnly ? "Recitation focus" : "Today's work"}
          detail={memDetail}
          cta={memCta}
          tone={CARD_TONES.memorization}
          onPress={() => handleCardPress("memorization")}
        />

        <WorkCard
          title="Review"
          eyebrow="Review queue"
          detail={reviewDetail}
          cta={reviewCta}
          tone={CARD_TONES.review}
          onPress={() => handleCardPress("review")}
        >
          {dueItems.length > 0 && (
            <View style={styles.reviewPreviewList}>
              {dueItems.slice(0, 3).map((item) => (
                <ReviewPreviewItem key={item.id} item={item} />
              ))}
              {dueItems.length > 3 && (
                <Text style={styles.moreText}>+{dueItems.length - 3} more queued</Text>
              )}
            </View>
          )}
        </WorkCard>

        <WorkCard
          title="Reading"
          eyebrow="Mushaf"
          detail={readingDetail}
          cta={readingCta}
          tone={CARD_TONES.reading}
          onPress={() => handleCardPress("reading")}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{name ?? "Dashboard"}</Text>
        <Pressable style={styles.headerRight} onPress={handleTargetsPress}>
          <Text style={styles.targetsText}>Targets</Text>
        </Pressable>
      </View>

      {renderContent()}
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
    width: 70,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
  },
  headerRight: {
    width: 70,
    alignItems: "flex-end",
  },
  targetsText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "700",
  },
  list: {
    padding: 20,
    gap: 14,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: "#dc2626",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  summaryBand: {
    backgroundColor: "#111111",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 48,
    fontSize: 28,
  },
  summaryText: {
    flex: 1,
  },
  summaryKicker: {
    fontSize: 12,
    color: "#d1d5db",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryName: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "700",
    marginTop: 2,
  },
  summaryStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  summaryStat: {
    fontSize: 13,
    color: "#fbbf24",
    fontWeight: "700",
  },
  summaryStatMuted: {
    fontSize: 13,
    color: "#d1d5db",
    fontWeight: "600",
  },
  warningBanner: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  warningText: {
    color: "#92400e",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  diagnosticBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  diagnosticTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  diagnosticText: {
    color: "#334155",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  diagnosticFailed: {
    color: "#b91c1c",
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconText: {
    fontSize: 18,
    fontWeight: "800",
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardEyebrow: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111111",
    marginTop: 1,
  },
  cardAction: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardDetail: {
    fontSize: 14,
    color: "#444444",
    lineHeight: 20,
  },
  reviewPreviewList: {
    gap: 8,
    marginTop: 2,
  },
  reviewPreview: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  reviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reviewPreviewText: {
    flex: 1,
    minWidth: 0,
  },
  reviewSurah: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },
  reviewRange: {
    fontSize: 12,
    color: "#666666",
    marginTop: 1,
  },
  reviewPriority: {
    fontSize: 12,
    fontWeight: "700",
  },
  moreText: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
});
