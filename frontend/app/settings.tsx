/**
 * Settings & Accessibility — voice narration toggle, watchlist info, about.
 * Test ALL elements with TTS for blind users.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { theme, API } from '../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [voiceOn, setVoiceOn] = useState(true);
  const [premiumVoice, setPremiumVoice] = useState(false);
  const [animOn, setAnimOn] = useState(true);

  const testVoice = async () => {
    if (premiumVoice) {
      try {
        const r = await fetch(`${API}/tts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Greetings Architect. Premium narration is operational.', voice: 'nova' }),
        });
        if (!r.ok) throw new Error(`Server ${r.status}`);
        const j = await r.json();
        if (!j.audio_b64) throw new Error('No audio returned');
        // Write to a temp file — data: URIs are flaky on mobile expo-av
        const FileSystem = await import('expo-file-system/legacy');
        const path = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + `tts_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(path, j.audio_b64, { encoding: FileSystem.EncodingType.Base64 });
        const { Audio } = await import('expo-av');
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const sound = new Audio.Sound();
        await sound.loadAsync({ uri: path });
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate(s => {
          if ((s as any).didJustFinish) sound.unloadAsync().catch(() => {});
        });
      } catch (e: any) {
        Alert.alert('Premium voice unavailable', String(e?.message || e));
      }
    } else {
      Speech.speak('Greetings Architect. Voice narration is now active.', { rate: 0.95 });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="settings-back" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ACCESSIBILITY</Text>
          <Row label="Voice Narration" hint="Read content aloud" value={voiceOn} onChange={setVoiceOn} testID="toggle-voice" />
          <Row label="Premium Voice (OpenAI)" hint="High-quality TTS" value={premiumVoice} onChange={setPremiumVoice} testID="toggle-premium" />
          <Pressable onPress={testVoice} style={styles.testBtn} testID="test-voice-btn">
            <Ionicons name="volume-high-outline" size={16} color={theme.colors.neon} />
            <Text style={styles.testText}>TEST VOICE</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DISPLAY</Text>
          <Row label="Motion & Animations" hint="Pulse, sparklines, orbs" value={animOn} onChange={setAnimOn} testID="toggle-anim" />
        </View>

        <Pressable style={styles.card} onPress={() => router.push('/stocks')} testID="manage-watchlist">
          <View style={styles.linkRow}>
            <View>
              <Text style={styles.sectionLabel}>WATCHLIST</Text>
              <Text style={styles.linkHint}>Add or remove tracked tickers</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </View>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <Text style={styles.aboutText}>
            Project Inception · v1.0{'\n'}
            Civilian AI assistant for markets, intelligence, and documents.{'\n'}
            Powered by JARVIS (Claude Sonnet 4.5).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, hint, value, onChange, testID }: {
  label: string; hint: string; value: boolean; onChange: (v: boolean) => void; testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ false: '#222', true: theme.colors.glowNeon }}
        thumbColor={value ? theme.colors.neon : '#666'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: { padding: 4 },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 16, letterSpacing: 3 },
  card: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, padding: 16,
  },
  sectionLabel: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 2, marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle,
  },
  rowLabel: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  rowHint: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: 'rgba(212,255,0,0.35)',
  },
  testText: { color: theme.colors.neon, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkHint: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 4 },
  aboutText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 20 },
});
