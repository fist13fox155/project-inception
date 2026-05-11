/**
 * JARVIS Chat — multi-turn with Claude Sonnet 4.5
 * Includes hold-to-speak voice input via Whisper STT
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { theme, API } from '../constants/theme';
import JarvisOrb from '../components/JarvisOrb';
import { getVoice } from '../lib/prefs';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };

const SESSION = `jarvis-${Date.now()}`;

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'sys', role: 'assistant', content: 'Standing by, Architect. How may I assist?' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((p) => [...p, userMsg]);
    setInput('');
    setSending(true);
    try {
      const r = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION, message: text }),
      });
      const j = await r.json();
      const reply = j.reply || 'Comms degraded. Standby.';
      const id = j.message_id || `a-${Date.now()}`;
      setMessages((p) => [...p, { id, role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages((p) => [...p, { id: `e-${Date.now()}`, role: 'assistant', content: 'Connection failed. Retry?' }]);
    } finally {
      setSending(false);
    }
  };

  const speakMsg = async (m: Msg) => {
    Speech.stop();
    if (speakingId === m.id) { setSpeakingId(null); return; }
    setSpeakingId(m.id);
    const v = await getVoice();
    if (v === 'system') {
      Speech.speak(m.content, {
        rate: 0.97,
        onDone: () => setSpeakingId(null),
        onStopped: () => setSpeakingId(null),
      });
      return;
    }
    try {
      const r = await fetch(`${API}/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: m.content, voice: v }),
      });
      const j = await r.json();
      if (!j.audio_b64) throw new Error('no audio');
      const FileSystem = await import('expo-file-system/legacy');
      const path = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + `chat_${m.id}.mp3`;
      await FileSystem.writeAsStringAsync(path, j.audio_b64, { encoding: FileSystem.EncodingType.Base64 });
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: path });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(s => {
        if ((s as any).didJustFinish) { setSpeakingId(null); sound.unloadAsync().catch(() => {}); }
      });
    } catch {
      setSpeakingId(null);
      Speech.speak(m.content, { rate: 0.97, onDone: () => setSpeakingId(null) });
    }
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch (e) { console.warn('rec start', e); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;
      const fd = new FormData();
      // @ts-ignore RN form data accepts uri
      fd.append('file', { uri, name: 'speech.m4a', type: 'audio/m4a' } as any);
      setSending(true);
      const r = await fetch(`${API}/stt`, { method: 'POST', body: fd });
      const j = await r.json();
      setSending(false);
      if (j.text) send(j.text);
    } catch (e) { setSending(false); console.warn('stt', e); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="chat-back" style={styles.iconBtn}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>JARVIS</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>SECURE CHANNEL · ONLINE</Text>
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        >
          {messages.map((m) => (
            <View key={m.id} style={[styles.msgRow, m.role === 'user' && styles.msgRowUser]}>
              {m.role === 'assistant' && (
                <View style={styles.miniOrb}>
                  <JarvisOrb size={32} />
                </View>
              )}
              <Pressable
                onLongPress={() => m.role === 'assistant' && speakMsg(m)}
                style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAsst]}
                testID={`msg-${m.id}`}
              >
                <Text style={[styles.bubbleText, m.role === 'user' && { color: theme.colors.text }]}>
                  {m.content}
                </Text>
                {m.role === 'assistant' && (
                  <Pressable onPress={() => speakMsg(m)} style={styles.speakBtn} testID={`speak-${m.id}`}>
                    <Ionicons
                      name={speakingId === m.id ? 'volume-high' : 'volume-medium-outline'}
                      size={14}
                      color={theme.colors.neon}
                    />
                  </Pressable>
                )}
              </Pressable>
            </View>
          ))}
          {sending && (
            <View style={styles.typing}>
              <ActivityIndicator color={theme.colors.neon} size="small" />
              <Text style={styles.typingText}>JARVIS THINKING…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <Pressable
            testID="mic-btn"
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[styles.micBtn, recording && styles.micBtnActive]}
          >
            <Icon name={recording ? 'radio' : 'mic-outline'} size={22} color={recording ? theme.colors.danger : theme.colors.neon} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder={recording ? 'Listening…' : 'Issue a command…'}
            placeholderTextColor={theme.colors.textTertiary}
            value={input}
            onChangeText={setInput}
            multiline
            testID="chat-input"
          />
          <Pressable
            testID="send-btn"
            disabled={!input.trim() || sending}
            onPress={() => send(input)}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
          >
            <Icon name="send" size={18} color={theme.colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  headerCenter: { alignItems: 'center' },
  title: { color: theme.colors.neon, fontFamily: theme.fonts.heading, fontSize: 20, letterSpacing: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.green },
  statusText: { color: theme.colors.textTertiary, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },
  scroll: { flex: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
  miniOrb: { width: 32, height: 32 },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: theme.radius.lg, borderWidth: 1,
  },
  bubbleAsst: { backgroundColor: theme.colors.surfaceElevated, borderColor: 'rgba(212,255,0,0.25)' },
  bubbleUser: { backgroundColor: theme.colors.surface, borderColor: 'rgba(176,38,255,0.35)' },
  bubbleText: { color: theme.colors.neon, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 },
  speakBtn: { alignSelf: 'flex-start', marginTop: 6, padding: 2 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginLeft: 40 },
  typingText: { color: theme.colors.textTertiary, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 2 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.bg,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { borderColor: theme.colors.danger, backgroundColor: 'rgba(255,51,102,0.1)' },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 15,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    backgroundColor: theme.colors.bg,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.neon,
    alignItems: 'center', justifyContent: 'center',
  },
});
