import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, LogBox } from 'react-native';
import * as Font from 'expo-font';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Rajdhani_500Medium,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { theme, BACKEND_URL } from '../constants/theme';

LogBox.ignoreLogs([
  '[expo-av]',
  'shadow*',
  'Calling `expoFont.loadAsync`',
  'Font file for ionicons',
  'ExpoFontLoader.loadAsync',
  'Possible Unhandled Promise',
]);

SplashScreen.hideAsync().catch(() => {});

async function loadIoniconsRobust() {
  const url = `${BACKEND_URL}/api/fonts/ionicons.ttf`;
  const localUri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + 'Ionicons.ttf';
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists || info.size < 100000) {
      await FileSystem.downloadAsync(url, localUri);
    }
    // Register under both names (vector-icons uses lowercase 'ionicons')
    await Font.loadAsync({
      ionicons: localUri,
      Ionicons: localUri,
    } as any);
    return true;
  } catch (e) {
    console.warn('[ionicons] download/load failed:', e);
    // Fallback to require()
    try {
      await Font.loadAsync({
        ionicons: require('../assets/fonts/Ionicons.ttf'),
        Ionicons: require('../assets/fonts/Ionicons.ttf'),
      });
      return true;
    } catch {}
    return false;
  }
}

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      await loadIoniconsRobust();
      try {
        await Font.loadAsync({
          Rajdhani_500Medium,
          Rajdhani_700Bold,
          SpaceGrotesk_400Regular,
          SpaceGrotesk_500Medium,
          SpaceGrotesk_700Bold,
        });
      } catch {}
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bg },
            animation: 'fade',
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({});
