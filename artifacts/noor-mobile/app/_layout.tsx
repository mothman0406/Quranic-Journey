import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AmiriQuran: require('../assets/fonts/AmiriQuran.ttf'),
    BayaanDigitalKhatt: require('../assets/fonts/bayaan/digital-khatt.otf'),
    BayaanQuranCommon: require('../assets/fonts/bayaan/quran-common.ttf'),
    BayaanSurahQCF: require('../assets/fonts/bayaan/surah-name-qcf.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false }} />
        <Stack.Screen name="profile/new" options={{ headerShown: false }} />
        <Stack.Screen name="child/[childId]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
