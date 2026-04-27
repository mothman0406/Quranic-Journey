import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AmiriQuran: require('../assets/fonts/AmiriQuran.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="child/[childId]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
