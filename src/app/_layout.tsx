import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppTabs from '@/components/app-tabs';
import { startInitialSync } from '@/data/sync-store';
// Side-effect import: configures the locale before any screen renders.
import '@/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Kick the datasets off once, app-wide, rather than per screen.
    startInitialSync();
    // The sync happens behind the map, so there's nothing to wait for here —
    // reveal the UI as soon as navigation is mounted.
    void SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppTabs />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
