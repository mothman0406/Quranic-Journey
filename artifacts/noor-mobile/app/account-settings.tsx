import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/screen-primitives";

export default function AccountSettingsScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <ScreenHeader title="Account settings" onBack={() => router.back()} />
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Account settings</Text>
          <Text style={styles.detail}>
            Parent account details will live here. Profile-specific targets and defaults
            are still available from each child's settings.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 8,
  },
  title: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  detail: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
