/**
 * DAGRCMD Home — auth screen (register/login). After auth, routes to /dagrcmd/comms.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { dagrTheme as T } from '../../constants/dagrTheme';
import { API } from '../../constants/theme';
import {
  ensureKeyPair, storeCredentials, getCredentials, clearIdentity,
} from '../../lib/crypto';

export default function DagrHome() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [callsign, setCallsign] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [rank, setRank] = useState('OPERATOR');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    (async () => {
      const { callsign: cs, authCode: ac } = await getCredentials();
      if (cs && ac) {
        setCallsign(cs); setAuthCode(ac); setRestored(true);
      }
    })();
  }, []);

  const submit = async () => {
    const cs = callsign.trim().toUpperCase();
    if (!cs || authCode.length < 4) {
      Alert.alert('Invalid', 'Callsign and 4+ char auth code required.');
      return;
    }
    setBusy(true);
    try {
      const kp = await ensureKeyPair();
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
              <Ionicons name="chevron-back" size={22} color={T.colors.textPrimary} />
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
                <Ionicons name="shield-checkmark" size={18} color={T.colors.bg} />
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'OPEN SECURE CHANNEL' : 'GENERATE KEY · ENLIST'}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={wipeIdentity} style={styles.wipeBtn} testID="wipe-btn">
            <Ionicons name="trash-outline" size={14} color={T.colors.textMuted} />
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
});
