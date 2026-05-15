/**
 * Document Generator — prompt + format toggle (PDF/PPTX).
 * Calls /api/documents/generate which returns base64 file + outline preview.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { theme, API } from '../constants/theme';
import EtherealOrbBackground from '../components/EtherealOrbBackground';

const PRESETS = [
  'Pitch deck for an AI-powered finance app aimed at retail investors',
  'Quarterly market overview: top performing sectors and macro headwinds',
  'Training PDF: Personal cybersecurity basics for non-technical users',
  'PowerPoint introducing a new product line to executive stakeholders',
];

export default function DocumentScreen() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<'pdf' | 'pptx'>('pdf');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ title: string; outline: any; file_b64: string; id: string; format: string } | null>(null);

  const generate = async () => {
    if (!prompt.trim()) { Alert.alert('Hold on', 'Tell JARVIS what to build.'); return; }
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(`${API}/documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, format }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setResult(j);
    } catch (e: any) {
      Alert.alert('Generation failed', String(e?.message || e));
    } finally { setBusy(false); }
  };

  const share = async () => {
    if (!result) return;
    try {
      const safe = result.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'inception';
      const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + `${safe}.${result.format}`;
      await FileSystem.writeAsStringAsync(uri, result.file_b64, { encoding: FileSystem.EncodingType.Base64 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: result.format === 'pdf' ? 'application/pdf' :
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          dialogTitle: result.title,
        });
      } else {
        Alert.alert('Saved', `File saved to ${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Share failed', String(e?.message || e));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <EtherealOrbBackground />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="doc-back" style={styles.iconBtn}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>CREATE DOCUMENT</Text>
        <Pressable onPress={() => router.push('/library')} style={styles.iconBtn} testID="doc-library">
          <Icon name="folder-open-outline" size={22} color={theme.colors.green} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>WHAT SHALL I BUILD, ARCHITECT?</Text>
            <TextInput
              style={styles.textarea}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe the document you want JARVIS to generate…"
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              testID="doc-prompt"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {PRESETS.map((p, i) => (
                <Pressable key={i} onPress={() => setPrompt(p)} style={styles.chip} testID={`preset-${i}`}>
                  <Text style={styles.chipText}>{p.length > 38 ? p.slice(0, 36) + '…' : p}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>OUTPUT FORMAT</Text>
            <View style={styles.formatRow}>
              {(['pdf', 'pptx'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFormat(f)}
                  style={[styles.formatOpt, format === f && styles.formatOptActive]}
                  testID={`format-${f}`}
                >
                  <Icon
                    name={f === 'pdf' ? 'document-text-outline' : 'easel-outline'}
                    size={28}
                    color={format === f ? theme.colors.green : theme.colors.textTertiary}
                  />
                  <Text style={[styles.formatText, format === f && { color: theme.colors.green }]}>
                    {f.toUpperCase()}
                  </Text>
                  <Text style={styles.formatHint}>
                    {f === 'pdf' ? 'Report / Training' : 'Slide deck'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={generate}
            disabled={busy}
            style={({ pressed }) => [styles.generateBtn, busy && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.98 }] }]}
            testID="generate-btn"
          >
            {busy ? <ActivityIndicator color={theme.colors.bg} /> : (
              <>
                <Icon name="sparkles" size={18} color={theme.colors.bg} />
                <Text style={styles.generateText}>GENERATE WITH JARVIS</Text>
              </>
            )}
          </Pressable>

          {result && (
            <View style={[styles.card, { borderColor: 'rgba(0,255,102,0.4)' }]} testID="doc-result">
              <View style={styles.resultHeader}>
                <Icon name="checkmark-circle" size={20} color={theme.colors.green} />
                <Text style={styles.resultTitle}>{result.title}</Text>
              </View>
              <Text style={styles.resultMeta}>
                {result.format.toUpperCase()} · {result.outline?.slides?.length || result.outline?.sections?.length || 0} sections
              </Text>
              {result.outline?.summary && (
                <Text style={styles.summary}>{result.outline.summary}</Text>
              )}
              <View style={styles.outlineList}>
                {(result.outline?.slides || result.outline?.sections || []).slice(0, 8).map((item: any, i: number) => (
                  <View key={i} style={styles.outlineRow}>
                    <Text style={styles.outlineNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={styles.outlineTitle}>{item.title || item.heading}</Text>
                  </View>
                ))}
              </View>
              <Pressable onPress={share} style={styles.shareBtn} testID="share-btn">
                <Icon name="share-outline" size={18} color={theme.colors.bg} />
                <Text style={styles.shareText}>EXPORT / SHARE</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000814' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(127,252,255,0.18)',
    backgroundColor: 'rgba(0,8,20,0.55)',
  },
  iconBtn: { padding: 4 },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 16, letterSpacing: 3 },
  card: {
    backgroundColor: 'rgba(0,8,20,0.55)', borderWidth: 1, borderColor: 'rgba(127,252,255,0.22)',
    borderRadius: theme.radius.lg, padding: 16,
  },
  label: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 2, marginBottom: 10 },
  textarea: {
    color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 15,
    backgroundColor: 'rgba(0,8,20,0.6)', borderWidth: 1, borderColor: 'rgba(127,252,255,0.25)',
    borderRadius: theme.radius.md, padding: 14, minHeight: 110, textAlignVertical: 'top',
  },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,8,20,0.6)', borderWidth: 1, borderColor: 'rgba(127,252,255,0.25)',
  },
  chipText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 11 },
  formatRow: { flexDirection: 'row', gap: 10 },
  formatOpt: {
    flex: 1, paddingVertical: 18, alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,8,20,0.6)', borderWidth: 1, borderColor: 'rgba(127,252,255,0.25)', borderRadius: theme.radius.md,
  },
  formatOptActive: {
    borderColor: 'rgba(0,255,102,0.4)', backgroundColor: 'rgba(0,255,102,0.05)',
  },
  formatText: { color: theme.colors.textTertiary, fontFamily: theme.fonts.bodyBold, fontSize: 14, letterSpacing: 3 },
  formatHint: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 10 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.colors.neon, paddingVertical: 16, borderRadius: theme.radius.lg,
    shadowColor: theme.colors.neon, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  generateText: { color: theme.colors.bg, fontFamily: theme.fonts.bodyBold, fontSize: 14, letterSpacing: 3 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 15, flex: 1 },
  resultMeta: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 4, letterSpacing: 1 },
  summary: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19, marginTop: 12 },
  outlineList: { marginTop: 12, gap: 6 },
  outlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  outlineNum: { color: theme.colors.green, fontFamily: theme.fonts.bodyBold, fontSize: 11, width: 22 },
  outlineTitle: { color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 13, flex: 1 },
  shareBtn: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.green, paddingVertical: 12, borderRadius: theme.radius.md,
  },
  shareText: { color: theme.colors.bg, fontFamily: theme.fonts.bodyBold, fontSize: 12, letterSpacing: 2 },
});
