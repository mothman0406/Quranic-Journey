import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { authClient } from "@/src/lib/auth-client";

export default function HomeScreen() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session?.user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.greeting}>Hello, {session.user.name}</Text>
      <Pressable style={styles.button} onPress={() => authClient.signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    backgroundColor: "#ffffff",
  },
  greeting: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111111",
  },
  button: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
