/**
 * DAGRCMD Home — auth screen (register/login). After auth, routes to /dagrcmd/comms.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { dagrTheme as T } from '../../constants/dagrTheme';
import { API } from '../../constants/theme';
import {
  ensureKeyPair, storeCredentials, getCredentials, clearIdentity,
} from '../../lib/crypto';

const INVITE_KEY = 'dagr_pending_invite';

async function stashInvite(code: string) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(INVITE_KEY, code);
    else {
      const SS = await import('expo-secure-store');
      await SS.setItemAsync(INVITE_KEY, code);
    }
  } catch {}
}
async function readInvite(): Promise<string> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(INVITE_KEY) || '';
    const SS = await import('expo-secure-store');
    return (await SS.getItemAsync(INVITE_KEY)) || '';
  } catch { return ''; }
}
async function clearInvite() {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(INVITE_KEY);
    else {
      const SS = await import('expo-secure-store');
      await SS.deleteItemAsync(INVITE_KEY);
    }
  } catch {}
}

export default function DagrHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ invite?: string }>();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [callsign, setCallsign] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [rank, setRank] = useState('OPERATOR');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [pendingInvite, setPendingInvite] = useState('');

  useEffect(() => {
    (async () => {
      // Accept invite from URL param OR a previously stashed code
      const fromUrl = (params.invite || '').toString().toUpperCase().trim();
      if (fromUrl) await stashInvite(fromUrl);
      const stashed = fromUrl || (await readInvite());
      if (stashed) setPendingInvite(stashed);

      // Restore callsign for convenience, but REQUIRE auth-code entry every time.
      const { callsign: cs } = await getCredentials();
      if (cs) {
        setCallsign(cs);
        setMode('login');
      }
    })();
  }, [params.invite]);

  const submit = async () => {
    const cs = callsign.trim().toUpperCase();
    if (!cs || authCode.length < 4) {
      Alert.alert('Invalid', 'Callsign and 4+ char auth code required.');
      return;
    }
    setBusy(true);
    try {
      // Generate / load keypair — this used to silently fail on web/secure-store
      let kp;
      try {
        kp = await ensureKeyPair();
      } catch (e: any) {
        throw new Error('Could not generate encryption key. ' + (e?.message || ''));
      }
      if (!kp.publicKey || !kp.secretKey) {
        throw new Error('Empty key pair returned. PRNG failure?');
      }

      const url = mode === 'register'
        ? `${API}/dagrcmd/officers/register`
        : `${API}/dagrcmd/officers/login`;
      const body: any = { callsign: cs, auth_code: authCode };
      if (mode === 'register') {
        body.public_key = kp.publicKey;
        body.rank = rank.toUpperCase();
        body.unit = unit.toUpperCase();
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      // After login, rotate public_key on server so it matches local secret
      if (mode === 'login') {
        await fetch(`${API}/dagrcmd/officers/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign: cs, auth_code: authCode, public_key: kp.publicKey }),
        });
      }
      await storeCredentials(cs, authCode);

      // Auto-consume any pending invite code
      const inviteCode = pendingInvite || (await readInvite());
      if (inviteCode) {
        try {
          const jr = await fetch(`${API}/dagrcmd/channels/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callsign: cs, auth_code: authCode, join_code: inviteCode }),
          });
          if (jr.ok) {
            await clearInvite();
            const jj = await jr.json();
            const chId = (jj.channel || jj).id;
            if (chId) {
              router.replace(`/dagrcmd/channel/${chId}` as any);
              return;
            }
          } else {
            Alert.alert('Invite invalid', `Could not join with code ${inviteCode}. You can enter it manually in COMMS.`);
          }
        } catch {}
      }
      router.replace('/dagrcmd/comms');
    } catch (e: any) {
      Alert.alert('Auth failed', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const wipeIdentity = async () => {
    Alert.alert('Wipe identity', 'This destroys your private key. All channels will require re-key. Continue?', [
      { text: 'Cancel' },
      { text: 'WIPE', style: 'destructive', onPress: async () => {
        await clearIdentity(); setCallsign(''); setAuthCode(''); setRestored(false);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.replace('/')} testID="dagr-exit" style={styles.iconBtn}>
              <Icon name="chevron-back" size={22} color={T.colors.textPrimary} />
            </Pressable>
            <Text style={styles.brand}>[ DAGRCMD ]</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.classified}>
            <Text style={styles.classifiedText}>// CLASSIFIED 5EY TERMINAL //  NODE: NIGHTFALL</Text>
            <Text style={styles.classifiedSub}>END-TO-END ENCRYPTED · X25519 · NACL BOX</Text>
          </View>

          {/* Mode toggle */}
          <View style={styles.tabs}>
            {(['login', 'register'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.tab, mode === m && styles.tabActive]}
                testID={`tab-${m}`}
              >
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'login' ? 'AUTHENTICATE' : 'ENLIST'}
                </Text>
              </Pressable>
            ))}
          </View>

          {pendingInvite ? (
            <View style={styles.inviteBanner} testID="invite-banner">
              <Icon name="enter-outline" size={16} color={T.colors.amber} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteTitle}>INVITE PENDING</Text>
                <Text style={styles.inviteCode}>CODE · {pendingInvite}</Text>
                <Text style={styles.inviteHint}>
                  ENLIST below to auto-join this channel.
                </Text>
              </View>
            </View>
          ) : null}

          {restored && (
            <Text style={styles.hint}>Credentials restored from secure store. Tap AUTHENTICATE.</Text>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>CALLSIGN</Text>
            <TextInput
              style={styles.input}
              value={callsign}
              onChangeText={setCallsign}
              autoCapitalize="characters"
              placeholder="e.g. ALPHA-1"
              placeholderTextColor={T.colors.textMuted}
              maxLength={20}
              testID="callsign-input"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>AUTH CODE</Text>
            <TextInput
              style={styles.input}
              value={authCode}
              onChangeText={setAuthCode}
              placeholder="4+ chars (memorize)"
              placeholderTextColor={T.colors.textMuted}
              secureTextEntry
              maxLength={32}
              testID="authcode-input"
            />
          </View>

          {mode === 'register' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>RANK</Text>
                <TextInput style={styles.input} value={rank} onChangeText={setRank}
                  autoCapitalize="characters" maxLength={12} testID="rank-input" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>UNIT</Text>
                <TextInput style={styles.input} value={unit} onChangeText={setUnit}
                  autoCapitalize="characters" maxLength={20} placeholder="e.g. BRAVO-COMPANY"
                  placeholderTextColor={T.colors.textMuted} testID="unit-input" />
              </View>
            </>
          )}

          <Pressable onPress={submit} disabled={busy} style={[styles.submitBtn, busy && { opacity: 0.6 }]} testID="auth-submit">
            {busy ? <ActivityIndicator color={T.colors.bg} /> : (
              <>
                <Icon name="shield-checkmark" size={18} color={T.colors.bg} />
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'OPEN SECURE CHANNEL' : 'GENERATE KEY · ENLIST'}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={wipeIdentity} style={styles.wipeBtn} testID="wipe-btn">
            <Icon name="trash-outline" size={14} color={T.colors.textMuted} />
            <Text style={styles.wipeText}>WIPE LOCAL IDENTITY</Text>
          </Pressable>

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Your private key is generated on-device and stored in encrypted secure storage.
              Server only relays ciphertext. Loss of auth code or device wipes channel access.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.colors.bg },
  scroll: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  iconBtn: { padding: 4 },
  brand: {
    color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 22, letterSpacing: 4,
  },
  classified: {
    borderColor: T.colors.borderActive, borderWidth: 1, borderRadius: T.radius.sm,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 16,
    backgroundColor: 'rgba(255,26,26,0.05)',
  },
  classifiedText: { color: T.colors.red, fontFamily: T.fonts.mono, fontSize: 10, letterSpacing: 1.5 },
  classifiedSub: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: T.radius.sm, borderWidth: 1, borderColor: T.colors.border,
  },
  tabActive: { backgroundColor: 'rgba(255,26,26,0.1)', borderColor: T.colors.red },
  tabText: { color: T.colors.textMuted, fontFamily: T.fonts.heading, fontSize: 11, letterSpacing: 2 },
  tabTextActive: { color: T.colors.red },
  hint: { color: T.colors.amber, fontFamily: T.fonts.mono, fontSize: 11, marginBottom: 12 },
  field: { marginBottom: 14 },
  label: { color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  input: {
    backgroundColor: T.colors.surface, borderWidth: 1, borderColor: T.colors.border,
    borderRadius: T.radius.sm, paddingHorizontal: 12, paddingVertical: 12,
    color: T.colors.textPrimary, fontFamily: T.fonts.mono, fontSize: 14, letterSpacing: 1.5,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.colors.red, paddingVertical: 14, borderRadius: T.radius.sm,
    marginTop: 8,
  },
  submitText: { color: T.colors.bg, fontFamily: T.fonts.heading, fontSize: 13, letterSpacing: 2 },
  wipeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 16, paddingVertical: 10,
  },
  wipeText: { color: T.colors.textMuted, fontFamily: T.fonts.heading, fontSize: 10, letterSpacing: 2 },
  disclaimer: {
    marginTop: 24, padding: 12,
    borderTopWidth: 1, borderTopColor: T.colors.border,
  },
  disclaimerText: { color: T.colors.textMuted, fontFamily: T.fonts.body, fontSize: 11, lineHeight: 16 },
  inviteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,196,0,0.08)',
    borderWidth: 1, borderColor: T.colors.amber,
    borderRadius: T.radius.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12,
  },
  inviteTitle: { color: T.colors.amber, fontFamily: T.fonts.heading, fontSize: 11, letterSpacing: 2 },
  inviteCode: { color: T.colors.amber, fontFamily: T.fonts.mono, fontSize: 18, letterSpacing: 4, marginTop: 2 },
  inviteHint: { color: T.colors.textMuted, fontFamily: T.fonts.body, fontSize: 11, marginTop: 2 },
});
