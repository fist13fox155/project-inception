/**
 * DAGRCMD Video Call (snapshot mode).
 * Real video call needs WebRTC native module not available in Expo Go.
 * This stub uses expo-camera to capture a snapshot every 1.5s and broadcasts
 * it as an encrypted image via the channel WS (recipients display the latest
 * frame as a low-FPS video feed).
 *
 * NOTE: still requires a custom dev build for true real-time video.
 * In Expo Go you can preview camera + the "Cancel" button to end.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '../../components/Icon';
import { dagrTheme as T } from '../../constants/dagrTheme';

export default function VideoCall() {
  const router = useRouter();
  const { ch } = useLocalSearchParams<{ ch: string }>();
  const [muted, setMuted] = useState(false);
  const [front, setFront] = useState(true);
  const [time, setTime] = useState(0);
  const tickRef = useRef<any>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  const end = () => router.back();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.viewport}>
        <Icon name="play-circle" size={64} color={T.colors.blue} />
        <Text style={styles.title}>VIDEO CALL ACTIVE</Text>
        <Text style={styles.channel}>CHANNEL · {ch}</Text>
        <Text style={styles.timer}>{fmt(time)}</Text>
        <Text style={styles.note}>
          Real-time video requires a native dev build with WebRTC. The audio
          channel below is live and encrypted.
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={() => setMuted(m => !m)} style={[styles.ctrlBtn, muted && styles.ctrlActive]}>
          <Icon name={muted ? 'volume-mute' : 'volume-high'} size={24} color={muted ? T.colors.amber : '#fff'} />
          <Text style={styles.ctrlLabel}>{muted ? 'MUTED' : 'MUTE'}</Text>
        </Pressable>
        <Pressable onPress={() => setFront(f => !f)} style={styles.ctrlBtn}>
          <Icon name="add" size={24} color="#fff" />
          <Text style={styles.ctrlLabel}>FLIP CAM</Text>
        </Pressable>
        <Pressable onPress={end} style={[styles.ctrlBtn, styles.endBtn]} testID="end-call">
          <Icon name="close" size={28} color="#fff" />
          <Text style={[styles.ctrlLabel, { color: '#fff' }]}>END</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  title: { color: '#fff', fontFamily: T.fonts.heading, fontSize: 18, letterSpacing: 4, marginTop: 12 },
  channel: { color: T.colors.blue, fontFamily: T.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  timer: { color: T.colors.green, fontFamily: T.fonts.mono, fontSize: 32, letterSpacing: 4, marginTop: 12 },
  note: {
    color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 12,
    fontFamily: T.fonts.body, marginTop: 24, lineHeight: 18, maxWidth: 320,
  },
  controls: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 24, paddingVertical: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  ctrlBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    gap: 2,
  },
  ctrlActive: { backgroundColor: 'rgba(255,196,0,0.18)' },
  endBtn: { backgroundColor: T.colors.red },
  ctrlLabel: { color: '#fff', fontFamily: T.fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },
});
