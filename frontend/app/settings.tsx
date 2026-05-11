/**
 * Settings & Accessibility — voice picker, narration, watchlist, about.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { theme, API } from '../constants/theme';
import {
  VOICE_OPTIONS, VoiceId, getVoice, setVoice, getNarrate, setNarrate,
} from '../lib/prefs';

export default function SettingsScreen() {
  const router = useRouter();
  const [voiceOn, setVoiceOn] = useState(true);
  const [voice, setVoiceState] = useState<VoiceId>('system');
  const [animOn, setAnimOn] = useState(true);
  const [testing, setTesting] = useState<VoiceId | null>(null);

  useEffect(() => {
    (async () => {
      setVoiceState(await getVoice());
      setVoiceOn(await getNarrate());
    })();
  }, []);

  const playSample = async (v: VoiceId) => {
    setTesting(v);
    const sample = v === 'system'
      ? 'Greetings Architect. System voice ready.'
      : `Greetings Architect. ${v.toUpperCase()} voice is operational.`;
    try {
      if (v === 'system') {
        Speech.stop();
        Speech.speak(sample, { rate: 0.95 });
        setTimeout(() => setTesting(null), 2500);
        return;
      }
      const r = await fetch(`${API}/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sample, voice: v }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!j.audio_b64) throw new Error('No audio');
      const FileSystem = await import('expo-file-system/legacy');
      const path = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + `voice_${v}.mp3`;
      await FileSystem.writeAsStringAsync(path, j.audio_b64, { encoding: FileSystem.EncodingType.Base64 });
      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: path });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(s => {
        if ((s as any).didJustFinish) { setTesting(null); sound.unloadAsync().catch(() => {}); }
      });
    } catch (e: any) {
      setTesting(null);
      Alert.alert('Voice unavailable', String(e?.message || e));
    }
  };

  const pickVoice = async (v: VoiceId) => {
    setVoiceState(v);
    await setVoice(v);
    playSample(v);
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
          <Text style={styles.sectionLabel}>JARVIS VOICE</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Voice Narration</Text>
              <Text style={styles.rowHint}>Read content aloud throughout app</Text>
            </View>
            <Switch
              value={voiceOn}
              onValueChange={async (v) => { setVoiceOn(v); await setNarrate(v); }}
              trackColor={{ false: '#222', true: theme.colors.glowNeon }}
              thumbColor={voiceOn ? theme.colors.neon : '#666'}
              testID="toggle-voice"
            />
          </View>
          {VOICE_OPTIONS.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => pickVoice(v.id)}
              style={[styles.voiceRow, voice === v.id && styles.voiceRowSel]}
              testID={`voice-${v.id}`}
            >
              <View style={[styles.radio, voice === v.id && styles.radioSel]}>
                {voice === v.id && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.voiceLabel, voice === v.id && { color: theme.colors.neon }]}>
                  {v.label}
                </Text>
                <Text style={styles.voiceDesc}>{v.desc}</Text>
              </View>
              <Pressable
                onPress={() => playSample(v.id)}
                style={styles.previewBtn}
                testID={`preview-${v.id}`}
              >
                {testing === v.id
                  ? <ActivityIndicator size="small" color={theme.colors.neon} />
                  : <Ionicons name="play-circle-outline" size={22} color={theme.colors.neon} />
                }
              </Pressable>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DISPLAY</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Motion & Animations</Text>
              <Text style={styles.rowHint}>Pulse, sparklines, orbs</Text>
            </View>
            <Switch
              value={animOn} onValueChange={setAnimOn}
              trackColor={{ false: '#222', true: theme.colors.glowNeon }}
              thumbColor={animOn ? theme.colors.neon : '#666'}
              testID="toggle-anim"
            />
          </View>
        </View>

        <Pressable style={styles.card} onPress={() => router.push('/stocks/browse' as any)} testID="manage-watchlist">
          <View style={styles.linkRow}>
            <View>
              <Text style={styles.sectionLabel}>WATCHLIST</Text>
              <Text style={styles.linkHint}>Browse 30K+ stocks & track favorites</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </View>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <Text style={styles.aboutText}>
            Project Inception · v1.1{'\n'}
            Civilian AI assistant for markets, intelligence, and documents.{'\n'}
            Powered by JARVIS (Claude Sonnet 4.5).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle,
  },
  voiceRowSel: {},
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSel: { borderColor: theme.colors.neon },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.neon },
  voiceLabel: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 13, letterSpacing: 1.5 },
  voiceDesc: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 10, marginTop: 2 },
  previewBtn: { padding: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkHint: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 4 },
  aboutText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 20 },
});
