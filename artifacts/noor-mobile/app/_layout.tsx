import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppThemeProvider, useAppTheme } from '@/src/lib/app-theme';

function RootStack() {
  const { colors, isDark } = useAppTheme();

  return (
    <>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false }} />
        <Stack.Screen name="mushaf" options={{ headerShown: false }} />
        <Stack.Screen name="notes-bookmarks" options={{ headerShown: false }} />
        <Stack.Screen name="profile/new" options={{ headerShown: false }} />
        <Stack.Screen name="child/[childId]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AmiriQuran: require('../assets/fonts/AmiriQuran.ttf'),
    BayaanDigitalKhatt: require('../assets/fonts/bayaan/digital-khatt.otf'),
    BayaanQuranCommon: require('../assets/fonts/bayaan/quran-common.ttf'),
    BayaanSurahQCF: require('../assets/fonts/bayaan/surah-name-qcf.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <RootStack />
    </AppThemeProvider>
  );
}
