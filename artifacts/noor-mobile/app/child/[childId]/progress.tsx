import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type ColorValue,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import { ApiError, apiFetch } from "@/src/lib/api";
import {
  computeProjectedCompletionDate,
  fetchHafidhProjections,
  type ProjectionResponse,
} from "@/src/lib/projections";
import { APP_ADAPTIVE_COLORS as appColors } from "@/src/lib/app-theme";

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
  | {
      status: "ready";
      dashboard: DashboardResponse;
      progress: ProgressResponse;
      projection: ProjectionResponse | null;
    };

const STAT_CARDS: Array<{
  key: "streak" | "points" | "surahs" | "badges";
  label: string;
  icon: IconName;
  color: string;
  soft: ColorValue;
}> = [
  {
    key: "streak",
    label: "Streak",
    icon: "flame-outline",
    color: "#ea580c",
    soft: appColors.warningSoft,
  },
  {
    key: "points",
    label: "Points",
    icon: "star-outline",
    color: "#d97706",
    soft: appColors.warningSoft,
  },
  {
    key: "surahs",
    label: "Surahs",
    icon: "book-outline",
    color: "#2563eb",
    soft: appColors.primarySoft,
  },
  {
    key: "badges",
    label: "Badges",
    icon: "trophy-outline",
    color: "#be123c",
    soft: appColors.dangerSoft,
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

function formatProjectedDate(value: string | null) {
  if (!value) return "Not enough data";
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return "Not enough data";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getWeekDelta(firstValue: string | null, secondValue: string | null) {
  if (!firstValue || !secondValue) return null;
  const first = parseLocalDate(firstValue);
  const second = parseLocalDate(secondValue);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null;
  return Math.round((first.getTime() - second.getTime()) / (86_400_000 * 7));
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
        <Ionicons name="chevron-back" size={22} color={appColors.text as string} />
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
        <Ionicons name="settings-outline" size={21} color={appColors.text as string} />
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
  soft: ColorValue;
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
                          backgroundColor: day.totalActivityScore > 0 ? "#2563eb" : appColors.border,
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
          <Ionicons name="bar-chart-outline" size={24} color={appColors.textSubtle as string} />
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

function TrajectoryCard({ projection }: { projection: ProjectionResponse | null }) {
  if (!projection) return null;

  const activeTier =
    projection.tiers.find((tier) => tier.tier === projection.activeTier) ??
    projection.tiers.find((tier) => tier.tier === "full_hafidh") ??
    projection.tiers[projection.tiers.length - 1];
  if (!activeTier) return null;

  const recentPace = projection.recentPacePagesPerWeek;
  const actualDate =
    recentPace == null
      ? null
      : computeProjectedCompletionDate(activeTier.pagesRemaining, recentPace);
  const weekDelta = getWeekDelta(actualDate, activeTier.projectedCompletionDate);
  const statusText =
    recentPace == null
      ? "Actual pace appears after completed memorization days."
      : weekDelta == null || weekDelta === 0
      ? "Actual pace is tracking close to plan."
      : weekDelta < 0
      ? `Currently ahead of plan by ${Math.abs(weekDelta)} week${Math.abs(weekDelta) === 1 ? "" : "s"}.`
      : `Currently behind plan by ${weekDelta} week${weekDelta === 1 ? "" : "s"}.`;

  return (
    <View style={styles.trajectoryCard}>
      <View style={styles.trajectoryHeader}>
        <View style={styles.trajectoryHeadingText}>
          <Text style={styles.cardTitle}>Trajectory</Text>
          <Text style={styles.trajectoryDetail}>{activeTier.label}</Text>
        </View>
        <View style={styles.trajectoryIcon}>
          <Ionicons name="navigate-outline" size={18} color="#0f766e" />
        </View>
      </View>

      <View style={styles.trajectoryGrid}>
        <View style={styles.trajectoryMetric}>
          <Text style={styles.trajectoryMetricLabel}>Planned</Text>
          <Text style={styles.trajectoryMetricValue}>
            {projection.pacePagesPerWeek.toFixed(2).replace(/\.00$/, "")}
          </Text>
          <Text style={styles.trajectoryMetricDetail}>pages/week</Text>
        </View>
        <View style={styles.trajectoryMetric}>
          <Text style={styles.trajectoryMetricLabel}>Actual</Text>
          <Text style={styles.trajectoryMetricValue}>
            {recentPace == null ? "-" : recentPace.toFixed(2).replace(/\.00$/, "")}
          </Text>
          <Text style={styles.trajectoryMetricDetail}>last 4 weeks</Text>
        </View>
      </View>

      <View style={styles.trajectoryDates}>
        <View style={styles.trajectoryDateRow}>
          <Text style={styles.trajectoryDateLabel}>Plan date</Text>
          <Text style={styles.trajectoryDateValue}>
            {formatProjectedDate(activeTier.projectedCompletionDate)}
          </Text>
        </View>
        <View style={styles.trajectoryDateRow}>
          <Text style={styles.trajectoryDateLabel}>Actual date</Text>
          <Text style={styles.trajectoryDateValue}>{formatProjectedDate(actualDate)}</Text>
        </View>
      </View>

      <Text style={styles.trajectoryStatus}>{statusText}</Text>
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
        const [dashboard, progress, projection] = await Promise.all([
          apiFetch<DashboardResponse>(`/api/children/${childId}/dashboard?preview=true`),
          apiFetch<ProgressResponse>(`/api/children/${childId}/weekly-progress?range=${range}`),
          fetchHafidhProjections(childId).catch(() => null),
        ]);
        setState({ status: "ready", dashboard, progress, projection });
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

          <TrajectoryCard projection={state.projection} />

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
    backgroundColor: appColors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
    backgroundColor: appColors.surface,
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
    backgroundColor: appColors.surfaceSubtle,
    borderWidth: 1,
    borderColor: appColors.border,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 30,
    fontSize: 17,
  },
  headerChildName: {
    maxWidth: 185,
    color: appColors.text,
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
    borderColor: appColors.dangerBorder,
    borderRadius: 12,
    backgroundColor: appColors.dangerSoft,
    padding: 18,
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    color: appColors.danger,
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
    color: appColors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pageTitle: {
    color: appColors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },
  pageSubtitle: {
    color: appColors.textMuted,
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
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
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
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statValue: {
    color: appColors.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    marginTop: 1,
  },
  statDetail: {
    color: appColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  chartHeaderCard: {
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
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
    color: appColors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  chartHeadingDetail: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: appColors.surfaceSubtle,
    borderWidth: 1,
    borderColor: appColors.border,
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
    color: appColors.textMuted,
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
    color: appColors.text,
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
    borderBottomColor: appColors.border,
  },
  bar: {
    width: "76%",
    minHeight: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    minHeight: 14,
    color: appColors.textMuted,
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
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyChart: {
    minHeight: 154,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 12,
    backgroundColor: appColors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  emptyChartText: {
    color: appColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  trajectoryCard: {
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.successBorder,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  trajectoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trajectoryHeadingText: {
    flex: 1,
    minWidth: 0,
  },
  trajectoryDetail: {
    color: appColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 2,
  },
  trajectoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.successSoft,
  },
  trajectoryGrid: {
    flexDirection: "row",
    gap: 10,
  },
  trajectoryMetric: {
    flex: 1,
    minHeight: 90,
    borderWidth: 1,
    borderColor: appColors.successBorder,
    borderRadius: 12,
    backgroundColor: appColors.successSoft,
    padding: 12,
    justifyContent: "center",
  },
  trajectoryMetricLabel: {
    color: appColors.success,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  trajectoryMetricValue: {
    color: appColors.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    marginTop: 2,
  },
  trajectoryMetricDetail: {
    color: appColors.success,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  trajectoryDates: {
    borderTopWidth: 1,
    borderTopColor: appColors.border,
    paddingTop: 4,
  },
  trajectoryDateRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trajectoryDateLabel: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  trajectoryDateValue: {
    flexShrink: 0,
    maxWidth: 160,
    color: appColors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  trajectoryStatus: {
    color: appColors.success,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
  },
  achievementsCard: {
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  achievementGroup: {
    gap: 8,
  },
  groupTitle: {
    color: appColors.textMuted,
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
    backgroundColor: appColors.warningSoft,
    borderColor: appColors.warningBorder,
  },
  inProgressRow: {
    backgroundColor: appColors.surfaceSubtle,
    borderColor: appColors.border,
  },
  achievementIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  earnedIcon: {
    backgroundColor: appColors.warningSoft,
  },
  inProgressIcon: {
    backgroundColor: appColors.surfaceSubtle,
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
    color: appColors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  achievementDetail: {
    color: appColors.textMuted,
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
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: appColors.border,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
