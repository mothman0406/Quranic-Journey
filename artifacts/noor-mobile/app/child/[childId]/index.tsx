import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

const FEATURE_CARDS = [
  { key: "memorization", label: "Memorization" },
  { key: "review", label: "Review" },
  { key: "reading", label: "Reading" },
] as const;

export default function ChildDashboard() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();

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
    } else {
      Alert.alert("Coming in Phase 2");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{name ?? "Dashboard"}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {FEATURE_CARDS.map((card) => (
          <Pressable
            key={card.key}
            style={styles.card}
            onPress={() => handleCardPress(card.key)}
          >
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardArrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
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
  list: {
    padding: 20,
    gap: 12,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111111",
  },
  cardArrow: {
    fontSize: 20,
    color: "#666666",
  },
});
