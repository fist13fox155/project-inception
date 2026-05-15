/**
 * DAGRCMD COMMS — channel list + create / join.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput,
  ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useRouter } from 'expo-router';
import { dagrTheme as T } from '../../constants/dagrTheme';
import { API, BACKEND_URL } from '../../constants/theme';
import { getCredentials, ensureKeyPair, clearIdentity } from '../../lib/crypto';

type Channel = { id: string; name: string; owner: string; members: string[]; join_code: string };

export default function CommsScreen() {
  const router = useRouter();
  const [me, setMe] = useState<{ callsign: string; authCode: string } | null>(null);
  const [pub, setPub] = useState<string>('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMembers, setNewMembers] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const cred = await getCredentials();
      const kp = await ensureKeyPair();
      setPub(kp.publicKey);
      if (!cred.callsign || !cred.authCode) {
        router.replace('/dagrcmd');
        return;
      }
      setMe({ callsign: cred.callsign, authCode: cred.authCode });
    })();
  }, []);

  const load = useCallback(async (callsign: string) => {
    try {
      const r = await fetch(`${API}/dagrcmd/channels/${callsign}`);
      const j = await r.json();
      setChannels(j.channels || []);
    } catch (e) { void (e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (me) load(me.callsign); }, [me, load]);

  const createChannel = async () => {
    if (!me || !newName.trim()) return;
    setBusy(true);
    try {
      const members = newMembers
        .split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      const r = await fetch(`${API}/dagrcmd/channels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, owner: me.callsign, auth_code: me.authCode, members }),
      });
      if (!r.ok) throw new Error(await r.text());
      const ch = await r.json();
      Alert.alert('Channel created', `Invite code: ${ch.join_code}\nShare with members.`);
      setShowCreate(false); setNewName(''); setNewMembers('');
      load(me.callsign);
    } catch (e: any) { Alert.alert('Failed', String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const joinChannel = async () => {
    if (!me || !joinCode.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/dagrcmd/channels/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign: me.callsign, auth_code: me.authCode, join_code: joinCode }),
      });
      if (!r.ok) throw new Error(await r.text());
      setShowJoin(false); setJoinCode('');
      load(me.callsign);
    } catch (e: any) { Alert.alert('Join failed', String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const deleteChannel = (ch: Channel) => {
    if (!me) return;
    const isOwner = ch.owner === me.callsign;
    const title = isOwner ? `DELETE ${ch.name}?` : `LEAVE ${ch.name}?`;
    const message = isOwner
      ? `You are the owner.\nThis will permanently delete the channel and ALL messages for every member (${ch.members.length} operators).`
      : `You will leave this channel.\nOwner: ${ch.owner}. Other members remain.`;
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isOwner ? 'Delete' : 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            const r = await fetch(
              `${API}/dagrcmd/channels/${ch.id}?callsign=${encodeURIComponent(me.callsign)}&auth_code=${encodeURIComponent(me.authCode)}`,
              { method: 'DELETE' }
            );
            if (!r.ok) throw new Error(await r.text());
            // Optimistic remove
            setChannels(prev => prev.filter(c => c.id !== ch.id));
          } catch (e: any) {
            Alert.alert('Failed', String(e?.message || e));
          }
        },
      },
    ]);
  };

  const logout = async () => {
    await clearIdentity();
    router.replace('/dagrcmd');
  };

  const shareInvite = async (ch: Channel) => {
    const url = `${BACKEND_URL}/api/join/${ch.join_code}`;
    const message =
      `🎯 You're invited to ${ch.name} on DAGRCMD\n\n` +
      `Tap to install + join:\n${url}\n\n` +
      `Or manually enter invite code: ${ch.join_code}\n` +
      `(End-to-end encrypted secure channel)`;
    try {
      await Share.share({ message, url, title: `Join ${ch.name}` });
    } catch (e) {
      Alert.alert('Invite', message);
    }
  };

  if (!me) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/dagrcmd')} testID="comms-back" style={styles.iconBtn}>
          <Icon name="chevron-back" size={22} color={T.colors.textPrimary} />
        </Pressable>
        <Pressable
          onLongPress={() => {
            Alert.prompt
              ? Alert.prompt('Rename callsign', `Current: ${me.callsign}\nEnter new callsign:`,
                  async (newName) => {
                    if (!newName || !newName.trim()) return;
                    const newCs = newName.trim().toUpperCase();
                    try {
                      const r = await fetch(`${API}/dagrcmd/officers/rename`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          old_callsign: me.callsign,
                          auth_code: me.authCode,
                          new_callsign: newCs,
                        }),
                      });
                      if (!r.ok) throw new Error(await r.text());
                      const { storeCredentials } = await import('../../lib/crypto');
                      await storeCredentials(newCs, me.authCode);
                      setMe({ callsign: newCs, authCode: me.authCode });
                      load(newCs);
                      Alert.alert('Renamed', `You are now ${newCs}`);
                    } catch (e: any) { Alert.alert('Rename failed', String(e?.message || e)); }
                  })
              : Alert.alert('Rename', 'Long-press supported on iOS only. Use Settings on Android.');
          }}
          style={styles.headerCenter}
          testID="callsign-tap"
        >
          <Text style={styles.brand}>COMMS</Text>
          <Text style={styles.callsign}>{me.callsign} · long-press to rename</Text>
        </Pressable>
        <Pressable onPress={logout} testID="comms-logout" style={styles.iconBtn}>
          <Icon name="log-out-outline" size={20} color={T.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.classified}>
        <View style={[styles.statusDot, { backgroundColor: T.colors.green }]} />
        <Text style={styles.classifiedText}>SECURE · E2E · LINK STABLE</Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => setShowCreate(true)} style={styles.actBtn} testID="create-channel-btn">
          <Icon name="add-circle-outline" size={16} color={T.colors.red} />
          <Text style={styles.actText}>NEW CHANNEL</Text>
        </Pressable>
        <Pressable onPress={() => setShowJoin(true)} style={styles.actBtn} testID="join-channel-btn">
          <Icon name="enter-outline" size={16} color={T.colors.red} />
          <Text style={styles.actText}>JOIN BY CODE</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/dagrcmd/map' as any)} style={styles.actBtn} testID="open-map-btn">
          <Icon name="map-outline" size={16} color={T.colors.red} />
          <Text style={styles.actText}>TAC MAP</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 8 }}
        refreshControl={<RefreshControl tintColor={T.colors.red} refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(me.callsign); }} />}
      >
        {loading ? (
          <ActivityIndicator color={T.colors.red} style={{ marginTop: 32 }} />
        ) : channels.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="radio-outline" size={48} color={T.colors.textMuted} />
            <Text style={styles.emptyText}>NO ACTIVE CHANNELS</Text>
            <Text style={styles.emptyHint}>
              Create a closed channel or join one with an invite code from another officer.
            </Text>
          </View>
        ) : (
          channels.map((c) => (
            <View key={c.id} style={styles.channelRow} testID={`channel-${c.id}`}>
              <Pressable
                onPress={() => router.push(`/dagrcmd/channel/${c.id}` as any)}
                onLongPress={() => deleteChannel(c)}
                delayLongPress={500}
                style={styles.channelLeft}
                testID={`channel-press-${c.id}`}
              >
                <View style={styles.channelIcon}>
                  <Icon name="lock-closed" size={16} color={T.colors.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.channelName}>{c.name}</Text>
                  <Text style={styles.channelMeta}>
                    {c.members.length} OPERATORS · OWNER {c.owner}
                  </Text>
                  <Text style={styles.joinCode}>INVITE: {c.join_code}</Text>
                  <Text style={styles.holdHint}>
                    HOLD TO {c.owner === me.callsign ? 'DELETE CHANNEL' : 'LEAVE'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => shareInvite(c)}
                onLongPress={() => deleteChannel(c)}
                delayLongPress={500}
                style={styles.shareBtn}
                testID={`share-${c.id}`}
              >
                <Icon name="share-social" size={18} color={T.colors.amber} />
                <Text style={styles.shareBtnText}>INVITE</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>NEW SECURE CHANNEL</Text>
            <Text style={styles.label}>NAME</Text>
            <TextInput style={styles.input} value={newName} onChangeText={setNewName}
              placeholder="e.g. OPERATION-NIGHTFALL" placeholderTextColor={T.colors.textMuted}
              autoCapitalize="characters" testID="new-channel-name" />
            <Text style={styles.label}>MEMBER CALLSIGNS (comma-separated)</Text>
            <TextInput style={styles.input} value={newMembers} onChangeText={setNewMembers}
              placeholder="BRAVO-2, CHARLIE-3" placeholderTextColor={T.colors.textMuted}
              autoCapitalize="characters" testID="new-channel-members" />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowCreate(false)} style={[styles.modalBtn, styles.modalBtnGhost]} testID="cancel-create">
                <Text style={styles.modalBtnTextGhost}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={createChannel} disabled={busy} style={[styles.modalBtn, styles.modalBtnPrimary, busy && { opacity: 0.5 }]} testID="confirm-create">
                {busy ? <ActivityIndicator color={T.colors.bg} /> : <Text style={styles.modalBtnText}>CREATE</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join modal */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>JOIN CHANNEL</Text>
            <Text style={styles.label}>INVITE CODE</Text>
            <TextInput style={styles.input} value={joinCode} onChangeText={setJoinCode}
              placeholder="6-char hex code" placeholderTextColor={T.colors.textMuted}
              autoCapitalize="characters" maxLength={12} testID="join-code-input" />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowJoin(false)} style={[styles.modalBtn, styles.modalBtnGhost]} testID="cancel-join">
                <Text style={styles.modalBtnTextGhost}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={joinChannel} disabled={busy} style={[styles.modalBtn, styles.modalBtnPrimary, busy && { opacity: 0.5 }]} testID="confirm-join">
                {busy ? <ActivityIndicator color={T.colors.bg} /> : <Text style={styles.modalBtnText}>JOIN</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: T.colors.border,
  },
  iconBtn: { padding: 6 },
  headerCenter: { alignItems: 'center' },
  brand: { color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 18, letterSpacing: 3 },
  callsign: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 10, letterSpacing: 1.5, marginTop: 1 },
  classified: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(0,255,102,0.05)', borderBottomWidth: 1, borderBottomColor: T.colors.border,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  classifiedText: { color: T.colors.green, fontFamily: T.fonts.mono, fontSize: 10, letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: 8, padding: 12 },
  actBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderWidth: 1, borderColor: T.colors.borderActive, borderRadius: T.radius.sm,
    backgroundColor: 'rgba(255,26,26,0.05)',
  },
  actText: { color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 11, letterSpacing: 2 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyText: { color: T.colors.textPrimary, fontFamily: T.fonts.heading, fontSize: 14, letterSpacing: 2, marginTop: 12 },
  emptyHint: { color: T.colors.textMuted, fontFamily: T.fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.colors.surface, borderWidth: 1, borderColor: T.colors.border,
    borderRadius: T.radius.sm, paddingHorizontal: 12, paddingVertical: 12,
  },
  channelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  channelIcon: {
    width: 36, height: 36, borderRadius: 6,
    backgroundColor: 'rgba(255,26,26,0.08)', borderWidth: 1, borderColor: T.colors.borderActive,
    alignItems: 'center', justifyContent: 'center',
  },
  channelName: { color: T.colors.textPrimary, fontFamily: T.fonts.heading, fontSize: 14, letterSpacing: 1.5 },
  channelMeta: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 10, marginTop: 2, letterSpacing: 1 },
  joinCode: { color: T.colors.amber, fontFamily: T.fonts.mono, fontSize: 10, marginTop: 2, letterSpacing: 1.5 },
  holdHint: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 9, marginTop: 4, letterSpacing: 1.5, opacity: 0.7 },
  shareBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: T.radius.sm,
    borderWidth: 1, borderColor: 'rgba(255,160,0,0.4)',
    backgroundColor: 'rgba(255,160,0,0.08)',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  shareBtnText: { color: T.colors.amber, fontFamily: T.fonts.heading, fontSize: 9, letterSpacing: 1.5 },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalCard: {
    backgroundColor: T.colors.bg, borderTopWidth: 1, borderTopColor: T.colors.borderActive,
    padding: 20, gap: 8,
  },
  modalTitle: { color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 18, letterSpacing: 3, marginBottom: 12 },
  label: { color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 10, letterSpacing: 2, marginTop: 8 },
  input: {
    backgroundColor: T.colors.surface, borderWidth: 1, borderColor: T.colors.border,
    borderRadius: T.radius.sm, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6,
    color: T.colors.textPrimary, fontFamily: T.fonts.mono, fontSize: 14, letterSpacing: 1,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: T.radius.sm },
  modalBtnPrimary: { backgroundColor: T.colors.red },
  modalBtnGhost: { borderWidth: 1, borderColor: T.colors.border },
  modalBtnText: { color: T.colors.bg, fontFamily: T.fonts.heading, fontSize: 12, letterSpacing: 2 },
  modalBtnTextGhost: { color: T.colors.textMuted, fontFamily: T.fonts.heading, fontSize: 12, letterSpacing: 2 },
});
