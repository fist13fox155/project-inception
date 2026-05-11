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
import { theme } from '../constants/theme';

LogBox.ignoreLogs([
  '[expo-av]',
  'shadow*',
  'Calling `expoFont.loadAsync`',
  'ExpoFontLoader.loadAsync',
  'Possible Unhandled Promise',
  'new NativeEventEmitter',
]);

SplashScreen.hideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    (async () => {
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
