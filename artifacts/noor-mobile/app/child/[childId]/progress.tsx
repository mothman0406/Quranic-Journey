import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import { ApiError, apiFetch } from "@/src/lib/api";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ProgressRange = "week" | "month";

type ProgressChild = {
  name: string;
  avatarEmoji: string;
  streakDays: number;
  totalPoints: number;
};

type MemorizationStats = {
  totalSurahsMemorized: number;
  totalVersesMemorized: number;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string | null;
  progress?: number | null;
  target?: number | null;
};

type DashboardResponse = {
  child: ProgressChild;
  memorizationStats: MemorizationStats;
  achievements: Achievement[];
  reviewsDueToday: number;
};

type ProgressDay = {
  date: string;
  memorizationCompleted: boolean;
  reviewCompleted: boolean;
  readingPagesCompleted: number;
  totalActivityScore: number;
};

type ProgressResponse = {
  range: ProgressRange;
  days: ProgressDay[];
};

type ProgressState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dashboard: DashboardResponse; progress: ProgressResponse };

const STAT_CARDS: Array<{
  key: "streak" | "points" | "surahs" | "badges";
  label: string;
  icon: IconName;
  color: string;
  soft: string;
}> = [
  {
    key: "streak",
    label: "Streak",
    icon: "flame-outline",
    color: "#ea580c",
    soft: "#fff7ed",
  },
  {
    key: "points",
    label: "Points",
    icon: "star-outline",
    color: "#d97706",
    soft: "#fffbeb",
  },
  {
    key: "surahs",
    label: "Surahs",
    icon: "book-outline",
    color: "#2563eb",
    soft: "#eff6ff",
  },
  {
    key: "badges",
    label: "Badges",
    icon: "trophy-outline",
    color: "#be123c",
    soft: "#fff1f2",
  },
];

function isValidChildId(childId: string | undefined): childId is string {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message} (${error.path})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load progress.";
}

function parseLocalDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatChartLabel(value: string, range: ProgressRange, index: number, total: number) {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return "";

  if (range === "week") {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }

  if (index === 0 || index === total - 1 || index % 5 === 0) {
    return String(date.getDate());
  }

  return "";
}

function formatPercent(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function getAchievementPercent(achievement: Achievement) {
  if (achievement.earned) return 100;
  return formatPercent(achievement.progress ?? 0, achievement.target ?? 0);
}

function ProgressBar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

function Header({
  child,
  childId,
  fallbackName,
}: {
  child: ProgressChild | null;
  childId: string | undefined;
  fallbackName: string;
}) {
  const router = useRouter();
  const displayName = child?.name ?? fallbackName ?? "Progress";

  function goDashboard() {
    if (!isValidChildId(childId)) {
      router.back();
      return;
    }

    router.replace({
      pathname: "/child/[childId]",
      params: { childId, name: displayName },
    });
  }

  function openSettings() {
    if (!isValidChildId(childId)) return;
    router.push({
      pathname: "/child/[childId]/targets",
      params: { childId, name: displayName },
    });
  }

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to dashboard"
        hitSlop={8}
        style={styles.headerIconButton}
        onPress={goDashboard}
      >
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </Pressable>

      <View style={styles.headerIdentity}>
        <Text style={styles.headerAvatar}>{child?.avatarEmoji ?? "?"}</Text>
        <Text style={styles.headerChildName} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open child settings"
        hitSlop={8}
        style={styles.headerIconButton}
        onPress={openSettings}
      >
        <Ionicons name="settings-outline" size={21} color="#111827" />
      </Pressable>
    </View>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  color,
  soft,
}: {
  label: string;
  value: number;
  detail: string;
  icon: IconName;
  color: string;
  soft: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statDetail} numberOfLines={2}>
        {detail}
      </Text>
    </View>
  );
}

function RangeToggle({
  value,
  onChange,
}: {
  value: ProgressRange;
  onChange: (range: ProgressRange) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {(["week", "month"] as const).map((range) => {
        const selected = value === range;
        return (
          <Pressable
            key={range}
            accessibilityRole="button"
            style={[styles.segment, selected && styles.segmentActive]}
            onPress={() => onChange(range)}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
              {range === "week" ? "Week" : "Month"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActivityChart({
  days,
  range,
}: {
  days: ProgressDay[];
  range: ProgressRange;
}) {
  const maxScore = Math.max(1, ...days.map((day) => day.totalActivityScore));
  const hasActivity = days.some((day) => day.totalActivityScore > 0);

  return (
    <View style={styles.chartCard}>
      {hasActivity ? (
        <>
          <View style={styles.chartArea}>
            {days.map((day, index) => {
              const heightPercent = Math.max(
                day.totalActivityScore > 0 ? 8 : 2,
                (day.totalActivityScore / maxScore) * 100,
              );
              const label = formatChartLabel(day.date, range, index, days.length);
              return (
                <View key={day.date} style={styles.barColumn}>
                  <View style={styles.barSlot}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: day.totalActivityScore > 0 ? "#2563eb" : "#e5e7eb",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>Bars show daily completed activity.</Text>
          </View>
        </>
      ) : (
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={24} color="#94a3b8" />
          <Text style={styles.emptyChartText}>No activity yet - start memorizing today.</Text>
        </View>
      )}
    </View>
  );
}

function AchievementRow({
  achievement,
  earned,
}: {
  achievement: Achievement;
  earned: boolean;
}) {
  const progress = achievement.progress ?? 0;
  const target = achievement.target ?? 0;
  const percent = getAchievementPercent(achievement);

  return (
    <View style={[styles.achievementRow, earned ? styles.earnedRow : styles.inProgressRow]}>
      <View style={[styles.achievementIcon, earned ? styles.earnedIcon : styles.inProgressIcon]}>
        <Text style={[styles.achievementEmoji, !earned && styles.fadedEmoji]}>
          {achievement.icon}
        </Text>
      </View>
      <View style={styles.achievementBody}>
        <View style={styles.achievementTitleRow}>
          <Text style={styles.achievementTitle} numberOfLines={1}>
            {achievement.title}
          </Text>
          {earned ? (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={13} color="#ffffff" />
            </View>
          ) : null}
        </View>
        <Text style={styles.achievementDetail} numberOfLines={2}>
          {achievement.description}
        </Text>
        {!earned && target > 0 ? (
          <View style={styles.achievementProgressBlock}>
            <ProgressBar value={percent} color="#f59e0b" />
            <Text style={styles.achievementProgressText}>
              {progress}/{target}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AchievementsSection({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter((achievement) => achievement.earned);
  const inProgress = achievements.filter((achievement) => !achievement.earned);

  return (
    <View style={styles.achievementsCard}>
      <Text style={styles.cardTitle}>Achievements</Text>

      {earned.length > 0 ? (
        <View style={styles.achievementGroup}>
          <Text style={styles.groupTitle}>Earned</Text>
          <View style={styles.achievementList}>
            {earned.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} earned />
            ))}
          </View>
        </View>
      ) : null}

      {inProgress.length > 0 ? (
        <View style={styles.achievementGroup}>
          <Text style={styles.groupTitle}>In Progress</Text>
          <View style={styles.achievementList}>
            {inProgress.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} earned={false} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function ProgressScreen() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const [range, setRange] = useState<ProgressRange>("week");
  const [state, setState] = useState<ProgressState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const fallbackName = typeof name === "string" ? name : "Progress";

  const loadProgress = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!isValidChildId(childId)) {
        setState({
          status: "error",
          message: "This progress route is missing a valid child id.",
        });
        return;
      }

      if (mode === "initial") {
        setState((current) => current.status === "ready" ? current : { status: "loading" });
      } else {
        setRefreshing(true);
      }

      try {
        const [dashboard, progress] = await Promise.all([
          apiFetch<DashboardResponse>(`/api/children/${childId}/dashboard?preview=true`),
          apiFetch<ProgressResponse>(`/api/children/${childId}/weekly-progress?range=${range}`),
        ]);
        setState({ status: "ready", dashboard, progress });
      } catch (error) {
        setState({ status: "error", message: describeError(error) });
      } finally {
        setRefreshing(false);
      }
    },
    [childId, range],
  );

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const dashboard = state.status === "ready" ? state.dashboard : null;
  const child = dashboard?.child ?? null;
  const earnedCount = dashboard?.achievements.filter((achievement) => achievement.earned).length ?? 0;
  const statValues = useMemo(() => {
    const stats = dashboard?.memorizationStats;
    const achievements = dashboard?.achievements ?? [];
    return {
      streak: {
        value: child?.streakDays ?? 0,
        detail: "days in a row",
      },
      points: {
        value: child?.totalPoints ?? 0,
        detail: "points earned",
      },
      surahs: {
        value: stats?.totalSurahsMemorized ?? 0,
        detail: `${stats?.totalVersesMemorized ?? 0} total verses`,
      },
      badges: {
        value: earnedCount,
        detail: `of ${achievements.length} total`,
      },
    };
  }, [child?.streakDays, child?.totalPoints, dashboard?.achievements, dashboard?.memorizationStats, earnedCount]);

  return (
    <View style={styles.container}>
      <Header child={child} childId={childId} fallbackName={fallbackName} />

      {state.status === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : state.status === "error" ? (
        <View style={styles.center}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={24} color="#dc2626" />
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
          <Pressable style={styles.retryButton} onPress={() => loadProgress()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadProgress("refresh")}
              tintColor="#2563eb"
            />
          }
        >
          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>Progress</Text>
            <Text style={styles.pageTitle} numberOfLines={2}>
              {state.dashboard.child.name}'s Progress
            </Text>
            <Text style={styles.pageSubtitle}>Every small step is part of the journey.</Text>
          </View>

          <View style={styles.statGrid}>
            {STAT_CARDS.map((card) => {
              const stat = statValues[card.key];
              return (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={stat.value}
                  detail={stat.detail}
                  icon={card.icon}
                  color={card.color}
                  soft={card.soft}
                />
              );
            })}
          </View>

          <View style={styles.chartHeaderCard}>
            <View style={styles.chartHeaderRow}>
              <View style={styles.chartHeadingText}>
                <Text style={styles.chartHeading}>Activity</Text>
                <Text style={styles.chartHeadingDetail}>
                  {range === "week" ? "Last 7 days" : "Last 30 days"}
                </Text>
              </View>
              <RangeToggle value={range} onChange={setRange} />
            </View>
            <ActivityChart days={state.progress.days} range={range} />
          </View>

          <AchievementsSection achievements={state.dashboard.achievements} />
        </ScrollView>
      )}

      <ChildBottomNav
        active="more"
        childId={childId}
        name={child?.name ?? fallbackName}
        reviewCount={dashboard?.reviewsDueToday}
      />
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 30,
    fontSize: 17,
  },
  headerChildName: {
    maxWidth: 185,
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  scroll: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 112,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  errorCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    backgroundColor: "#fff7f7",
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  titleBlock: {
    gap: 3,
    paddingTop: 2,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pageTitle: {
    color: "#111827",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },
  pageSubtitle: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    minHeight: 96,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statValue: {
    color: "#111827",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    marginTop: 1,
  },
  statDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  chartHeaderCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chartHeadingText: {
    flex: 1,
    minWidth: 0,
  },
  chartHeading: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  chartHeadingDetail: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    minHeight: 30,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 9,
  },
  segmentActive: {
    backgroundColor: "#2563eb",
  },
  segmentText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  chartCard: {
    gap: 12,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  chartArea: {
    height: 154,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 3,
    paddingTop: 6,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 6,
  },
  barSlot: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  bar: {
    width: "76%",
    minHeight: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    minHeight: 14,
    color: "#64748b",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
  },
  legendText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyChart: {
    minHeight: 154,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  emptyChartText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  achievementsCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  achievementGroup: {
    gap: 8,
  },
  groupTitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  achievementList: {
    gap: 10,
  },
  achievementRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  earnedRow: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  inProgressRow: {
    backgroundColor: "#f8fafc",
    borderColor: "#e5e7eb",
  },
  achievementIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  earnedIcon: {
    backgroundColor: "#fef3c7",
  },
  inProgressIcon: {
    backgroundColor: "#f1f5f9",
  },
  achievementEmoji: {
    fontSize: 20,
  },
  fadedEmoji: {
    opacity: 0.42,
  },
  achievementBody: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  achievementTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  achievementTitle: {
    flex: 1,
    minWidth: 0,
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  achievementDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },
  achievementProgressBlock: {
    gap: 5,
    marginTop: 2,
  },
  achievementProgressText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
