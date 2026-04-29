import { useCallback, useEffect, type ComponentProps, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import {
  BadgePill,
  CardGroup,
  InlineError,
  ListRow,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
  SectionLabel,
} from "@/src/components/screen-primitives";
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
  | "/child/[childId]/profile"
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
    title: "Parent Settings",
    detail: "Targets, visibility, session defaults",
    icon: "flag-outline",
    tone: "#2563eb",
    route: "/child/[childId]/targets",
  },
  {
    title: "Profile Settings",
    detail: "Edit profile or delete",
    icon: "settings-outline",
    tone: "#4f46e5",
    route: "/child/[childId]/profile",
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
    <ScreenContainer>
      <ScreenHeader title="More" onBack={() => router.back()} />

      {child === null && !error ? (
        <LoadingState />
      ) : (
        <ScreenScrollView>
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
            <InlineError message={error} onRetry={loadChild} />
          )}

          <SectionLabel>Open now</SectionLabel>
          <CardGroup>
            {OPEN_ITEMS.map((item) => {
              const route = item.route;
              return (
                <ListRow
                  key={item.title}
                  title={item.title}
                  detail={item.detail}
                  iconName={item.icon}
                  iconColor={item.tone}
                  onPress={route ? () => openRoute(route) : undefined}
                />
              );
            })}
          </CardGroup>

          <SectionLabel>Next</SectionLabel>
          <CardGroup>
            {PLANNED_ITEMS.map((item) => (
              <ListRow
                key={item.title}
                title={item.title}
                detail={item.detail}
                iconName={item.icon}
                iconColor={item.tone}
                disabled
                trailing={item.badge ? <BadgePill label={item.badge} /> : undefined}
                showChevron={!item.badge}
              />
            ))}
          </CardGroup>
        </ScreenScrollView>
      )}

      <ChildBottomNav
        active="more"
        childId={childId}
        name={child?.name ?? name ?? ""}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
});
