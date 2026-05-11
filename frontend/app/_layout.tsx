import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, LogBox } from 'react-native';
import * as Font from 'expo-font';
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

export default function RootLayout() {
  useEffect(() => {
    // Load fonts in background; UI renders immediately. Ionicons falls
    // back to system glyphs until loaded.
    (async () => {
      try {
        await Font.loadAsync({
          ionicons: { uri: `${BACKEND_URL}/api/fonts/ionicons.ttf` } as any,
          Rajdhani_500Medium,
          Rajdhani_700Bold,
          SpaceGrotesk_400Regular,
          SpaceGrotesk_500Medium,
          SpaceGrotesk_700Bold,
        });
      } catch {
        try {
          await Font.loadAsync({
            ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
          });
        } catch {}
      }
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
