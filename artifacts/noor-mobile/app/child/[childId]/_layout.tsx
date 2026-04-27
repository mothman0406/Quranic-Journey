import { Stack } from "expo-router";

export default function ChildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="mushaf" />
    </Stack>
  );
}
