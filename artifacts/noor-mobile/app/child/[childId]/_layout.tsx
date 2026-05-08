import { Stack } from "expo-router";
import { useAppTheme } from "@/src/lib/app-theme";

export default function ChildLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="mushaf" />
      <Stack.Screen name="review" />
      <Stack.Screen name="review-session" />
      <Stack.Screen name="memorization" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="plan" />
      <Stack.Screen name="notes-bookmarks" />
      <Stack.Screen name="duas/index" />
      <Stack.Screen name="duas/[categorySlug]" />
      <Stack.Screen name="duas/dua/[duaId]" />
      <Stack.Screen name="stories/index" />
      <Stack.Screen name="stories/[storyIdOrSlug]" />
      <Stack.Screen name="targets" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="more" />
    </Stack>
  );
}
