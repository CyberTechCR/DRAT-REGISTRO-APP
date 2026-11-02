import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, StyleSheet, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SessionProvider } from '@/auth/SessionProvider';
import { OfflineProvider } from '@/offline/OfflineProvider';
import { SICAFColors as colors } from '@/constants/theme';
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const isHome = pathname === '/';
  return (
    <SessionProvider><OfflineProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar animated style={isHome ? 'light' : 'dark'} />
        <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </KeyboardAvoidingView>
      </ThemeProvider>
    </OfflineProvider></SessionProvider>
  );
}

const styles = StyleSheet.create({ app: { flex: 1 } });
