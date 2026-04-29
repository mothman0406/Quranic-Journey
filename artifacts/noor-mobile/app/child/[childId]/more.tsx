import { useCallback, useEffect, type ComponentProps, type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import { apiFetch } from "@/src/lib/api";

type IconName = ComponentProps<typeof Ionicons>["name"];

type ChildSummary = {
  name: string;
  avatarEmoji: string;
  age?: number;
  streakDays: number;
  totalPoints: number;
};

type MoreRoute =
  | "/"
  | "/child/[childId]"
  | "/child/[childId]/mushaf"
  | "/child/[childId]/targets";

type MoreItem = {
  title: string;
  detail: string;
  icon: IconName;
  tone: string;
  route?: MoreRoute;
  badge?: string;
};

const OPEN_ITEMS: MoreItem[] = [
  {
    title: "Full Quran",
    detail: "Mushaf reader",
    icon: "reader-outline",
    tone: "#0f766e",
    route: "/child/[childId]/mushaf",
  },
  {
    title: "Targets",
    detail: "Daily page goals",
    icon: "flag-outline",
    tone: "#2563eb",
    route: "/child/[childId]/targets",
  },
  {
    title: "Profiles",
    detail: "Parent dashboard",
    icon: "people-outline",
    tone: "#7c3aed",
    route: "/",
  },
];

const PLANNED_ITEMS: MoreItem[] = [
  {
    title: "Progress",
    detail: "Stats and badges",
    icon: "bar-chart-outline",
    tone: "#16a34a",
    badge: "2J",
  },
  {
    title: "Learning Plan",
    detail: "Milestones and goals",
    icon: "map-outline",
    tone: "#ea580c",
    badge: "2I",
  },
  {
    title: "Stories",
    detail: "Islamic stories",
    icon: "library-outline",
    tone: "#be123c",
    badge: "2I",
  },
  {
    title: "Du'aas",
    detail: "Practice and learned status",
    icon: "heart-outline",
    tone: "#0891b2",
    badge: "2I",
  },
];

function isValidChildId(childId: string | undefined) {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function formatDayStreak(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function MoreRow({
  item,
  disabled,
  onPress,
  children,
}: {
  item: MoreItem;
  disabled?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      disabled={disabled || !onPress}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${item.tone}14` }]}>
        <Ionicons name={item.icon} size={21} color={item.tone} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDetail}>{item.detail}</Text>
      </View>
      {children}
      {item.badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      )}
    </Pressable>
  );
}

export default function MoreScreen() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();
  const [child, setChild] = useState<ChildSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadChild = useCallback(async () => {
    if (!isValidChildId(childId)) {
      setError("This child route is missing a valid child id.");
      return;
    }

    setError(null);
    try {
      const data = await apiFetch<ChildSummary>(`/api/children/${childId}`);
      setChild(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load child profile.");
    }
  }, [childId]);

  useEffect(() => {
    loadChild();
  }, [loadChild]);

  function openRoute(route: MoreRoute) {
    if (route === "/") {
      router.replace("/");
      return;
    }

    if (!isValidChildId(childId)) return;
    router.push({
      pathname: route,
      params: { childId, name: child?.name ?? name ?? "" },
    });
  }

  const displayName = child?.name ?? name ?? "Child";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>More</Text>
        <View style={styles.headerSpacer} />
      </View>

      {child === null && !error ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.summaryBand}>
            <Text style={styles.summaryAvatar}>{child?.avatarEmoji ?? "?"}</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryKicker}>NoorPath</Text>
              <Text style={styles.summaryName}>{displayName}</Text>
            </View>
            <View style={styles.summaryStats}>
              <Text style={styles.summaryStat}>{formatDayStreak(child?.streakDays ?? 0)}</Text>
              <Text style={styles.summaryStatMuted}>{child?.totalPoints ?? 0} pts</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
              <Pressable style={styles.inlineRetry} onPress={loadChild}>
                <Text style={styles.inlineRetryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionHeader}>Open now</Text>
          <View style={styles.card}>
            {OPEN_ITEMS.map((item) => {
              const route = item.route;
              return (
                <MoreRow
                  key={item.title}
                  item={item}
                  onPress={route ? () => openRoute(route) : undefined}
                />
              );
            })}
          </View>

          <Text style={styles.sectionHeader}>Next</Text>
          <View style={styles.card}>
            {PLANNED_ITEMS.map((item) => (
              <MoreRow key={item.title} item={item} disabled />
            ))}
          </View>
        </ScrollView>
      )}

      <ChildBottomNav
        active="more"
        childId={childId}
        name={child?.name ?? name ?? ""}
      />
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
  headerSpacer: {
    width: 70,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 32,
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
    minWidth: 0,
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
  sectionHeader: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowDisabled: {
    opacity: 0.62,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
  },
  rowDetail: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "800",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  errorBannerText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
  },
  inlineRetry: {
    alignSelf: "flex-start",
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  inlineRetryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
