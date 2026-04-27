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
};

type ChildrenResponse = { children: Child[] };

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
          <Text style={styles.emptyText}>
            No children yet — add one in the web app
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.subtitle}>Select a child</Text>
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
              <Text style={styles.avatar}>{child.avatarEmoji}</Text>
              <View>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.ageGroup}>{child.ageGroup}</Text>
              </View>
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
  },
  list: {
    padding: 20,
    gap: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 4,
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
  avatar: {
    fontSize: 36,
  },
  childName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
  },
  ageGroup: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
    textTransform: "capitalize",
  },
});
