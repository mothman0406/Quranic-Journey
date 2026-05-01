import { Stack } from "expo-router";

export default function ChildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="mushaf" />
      <Stack.Screen name="review" />
      <Stack.Screen name="review-session" />
      <Stack.Screen name="memorization" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="targets" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="more" />
    </Stack>
  );
}
