/**
 * Document Library — list, share, delete previously generated docs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { theme, API } from '../constants/theme';

type Doc = { id: string; title: string; format: string; size_bytes: number; created_at: string };

export default function LibraryScreen() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/documents`);
      const j = await r.json();
      setDocs(j.documents || []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (d: Doc) => {
    setDownloadingId(d.id);
    try {
      const r = await fetch(`${API}/documents/${d.id}`);
      const j = await r.json();
      const safe = d.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'doc';
      const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + `${safe}.${d.format}`;
      await FileSystem.writeAsStringAsync(uri, j.file_b64, { encoding: FileSystem.EncodingType.Base64 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: d.format === 'pdf' ? 'application/pdf' :
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        });
      } else {
        Alert.alert('Saved', `File at ${uri}`);
      }
    } catch (e: any) { Alert.alert('Open failed', String(e?.message || e)); }
    finally { setDownloadingId(null); }
  };

  const del = (d: Doc) => {
    Alert.alert('Delete', `Delete "${d.title}"?`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await fetch(`${API}/documents/${d.id}`, { method: 'DELETE' });
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="library-back" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>LIBRARY</Text>
        <Pressable onPress={() => router.push('/document')} testID="library-new" style={styles.iconBtn}>
          <Ionicons name="add" size={22} color={theme.colors.green} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl tintColor={theme.colors.neon} refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.neon} style={{ marginTop: 24 }} />
        ) : docs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="documents-outline" size={56} color={theme.colors.textTertiary} />
            <Text style={styles.emptyText}>No documents yet</Text>
            <Text style={styles.emptyHint}>Ask JARVIS to draft your first PDF or PPTX.</Text>
            <Pressable onPress={() => router.push('/document')} style={styles.emptyBtn} testID="library-create">
              <Text style={styles.emptyBtnText}>CREATE FIRST DOCUMENT</Text>
            </Pressable>
          </View>
        ) : (
          docs.map((d) => (
            <View key={d.id} style={styles.row} testID={`doc-row-${d.id}`}>
              <Pressable onPress={() => open(d)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.iconBox, {
                  borderColor: d.format === 'pdf' ? 'rgba(0,255,102,0.4)' : 'rgba(0,229,255,0.4)',
                }]}>
                  <Ionicons
                    name={d.format === 'pdf' ? 'document-text-outline' : 'easel-outline'}
                    size={22}
                    color={d.format === 'pdf' ? theme.colors.green : theme.colors.blue}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle} numberOfLines={1}>{d.title}</Text>
                  <Text style={styles.docMeta}>
                    {d.format.toUpperCase()} · {(d.size_bytes / 1024).toFixed(1)} KB · {new Date(d.created_at).toLocaleString()}
                  </Text>
                </View>
                {downloadingId === d.id ? (
                  <ActivityIndicator size="small" color={theme.colors.neon} />
                ) : (
                  <Ionicons name="share-outline" size={20} color={theme.colors.textSecondary} />
                )}
              </Pressable>
              <Pressable onPress={() => del(d)} style={styles.delBtn} testID={`del-doc-${d.id}`}>
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
              </Pressable>
            </View>
          ))
        )}
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingVertical: 12,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg,
  },
  docTitle: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  docMeta: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 10, marginTop: 3 },
  delBtn: { padding: 8 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.heading, fontSize: 18, letterSpacing: 2, marginTop: 16 },
  emptyHint: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 8, textAlign: 'center' },
  emptyBtn: {
    marginTop: 24, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: 'rgba(0,255,102,0.4)',
  },
  emptyBtnText: { color: theme.colors.green, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
});
