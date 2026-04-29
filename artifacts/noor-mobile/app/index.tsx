import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { authClient } from "@/src/lib/auth-client";
import { apiFetch } from "@/src/lib/api";

type Child = {
  id: number;
  name: string;
  ageGroup: "toddler" | "child" | "preteen" | "teen";
  avatarEmoji: string;
  streakDays?: number;
  totalPoints?: number;
};

type ChildrenResponse = { children: Child[] };

const AGE_LABELS: Record<Child["ageGroup"], string> = {
  toddler: "Toddler",
  child: "Child",
  preteen: "Preteen",
  teen: "Teen",
};

function formatDayStreak(days: number) {
  return `${days} day${days === 1 ? "" : "s"} streak`;
}

export default function HomeScreen() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function loadChildren() {
    setFetchError(null);
    try {
      const data = await apiFetch<ChildrenResponse>("/api/children");
      setChildren(data.children);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load children.");
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadChildren();
    }
  }, [session?.user]);

  function openCreateProfile() {
    router.push("/profile/new");
  }

  if (sessionPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session?.user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NoorPath</Text>
        <Pressable onPress={() => authClient.signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {children === null && !fetchError ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : fetchError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <Pressable style={styles.retryButton} onPress={loadChildren}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : children!.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Add your first child</Text>
          <Text style={styles.emptyText}>
            Create a profile here, then choose any surahs they already know.
          </Text>
          <Pressable style={styles.primaryButton} onPress={openCreateProfile}>
            <Text style={styles.primaryButtonText}>Add Child</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.subtitle}>Select a child</Text>
              <Text style={styles.listHint}>
                {children!.length} profile{children!.length === 1 ? "" : "s"}
              </Text>
            </View>
            <Pressable style={styles.addButton} onPress={openCreateProfile}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
          {children!.map((child) => (
            <Pressable
              key={child.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/child/[childId]",
                  params: { childId: String(child.id), name: child.name },
                })
              }
            >
              <View style={styles.avatarBubble}>
                <Text style={styles.avatar}>{child.avatarEmoji}</Text>
              </View>
              <View style={styles.childText}>
                <View style={styles.childNameRow}>
                  <Text style={styles.childName} numberOfLines={1}>
                    {child.name}
                  </Text>
                  <Text style={styles.agePill}>{AGE_LABELS[child.ageGroup]}</Text>
                </View>
                <View style={styles.childMetaRow}>
                  <Text style={styles.childMeta}>
                    {formatDayStreak(child.streakDays ?? 0)}
                  </Text>
                  <Text style={styles.childMetaMuted}>
                    {child.totalPoints ?? 0} pts
                  </Text>
                </View>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </Pressable>
          ))}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
  },
  signOut: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "500",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    color: "#666666",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 21,
  },
  emptyTitle: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#111111",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  list: {
    padding: 20,
    gap: 12,
    paddingBottom: 32,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  addButton: {
    backgroundColor: "#111111",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
  },
  listHint: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    fontSize: 32,
  },
  childText: {
    flex: 1,
    minWidth: 0,
  },
  childNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  childName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
    flexShrink: 1,
  },
  agePill: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "700",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: "hidden",
  },
  childMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 5,
  },
  childMeta: {
    fontSize: 13,
    color: "#b45309",
    fontWeight: "600",
  },
  childMetaMuted: {
    fontSize: 13,
    color: "#666666",
    fontWeight: "600",
  },
  cardArrow: {
    fontSize: 24,
    color: "#999999",
  },
});
