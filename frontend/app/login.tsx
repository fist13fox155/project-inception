/**
 * Project Inception Login — sets Architect Name + 4-digit PIN.
 * Two factors: (1) the name JARVIS uses to address you, (2) the PIN unlocks the app.
 * First run = REGISTER, subsequent runs = LOGIN.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from '../components/Icon';
import JarvisOrb from '../components/JarvisOrb';
import EtherealOrbBackground from '../components/EtherealOrbBackground';
import { theme } from '../constants/theme';
import {
  getArchitectName, setArchitectName, getPin, setPin, setSession,
} from '../lib/prefs';

export default function InceptionLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<'register' | 'login' | 'loading'>('loading');
  const [name, setName] = useState('');
  const [pin, setPinInput] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const existing = await getArchitectName();
      const savedPin = await getPin();
      if (existing && savedPin) {
        setMode('login');
        setName(existing);
      } else {
        setMode('register');
      }
    })();
  }, []);

  const handle = async () => {
    setBusy(true);
    try {
      if (mode === 'register') {
        if (name.trim().length < 2) {
          Alert.alert('Identity needed', 'Tell JARVIS your name (min 2 chars).');
          return;
        }
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
          Alert.alert('Invalid PIN', 'Choose a 4-digit numeric PIN.');
          return;
        }
        if (pin !== confirm) {
          Alert.alert('PIN mismatch', 'Confirm PIN does not match.');
          return;
        }
        await setArchitectName(name);
        await setPin(pin);
        await setSession(true);
        router.replace('/');
      } else {
        const saved = await getPin();
        if (pin !== saved) {
          Alert.alert('Access denied', 'Incorrect PIN.');
          setPinInput('');
          return;
        }
        await setSession(true);
        router.replace('/');
      }
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.colors.blue} style={{ marginTop: 120 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <EtherealOrbBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.body}>
          <JarvisOrb size={150} color={theme.colors.blue} speaking />
          <Text style={styles.title}>PROJECT INCEPTION</Text>
          <Text style={styles.subtitle}>
            {mode === 'register' ? 'INITIALIZE OPERATOR' : `WELCOME BACK, ${name.toUpperCase()}`}
          </Text>

          <View style={styles.card}>
            {mode === 'register' ? (
              <>
                <Text style={styles.label}>YOUR NAME (HOW JARVIS WILL ADDRESS YOU)</Text>
                <View style={styles.inputRow}>
                  <Icon name="enter-outline" size={16} color={theme.colors.blue} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Tony, Architect, Captain…"
                    placeholderTextColor={theme.colors.textTertiary}
                    autoCapitalize="words"
                    maxLength={32}
                    testID="login-name"
                    onSubmitEditing={() => pinRef.current?.focus()}
                    returnKeyType="next"
                  />
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>SET 4-DIGIT PIN</Text>
                <View style={styles.inputRow}>
                  <Icon name="lock-closed" size={16} color={theme.colors.blue} />
                  <TextInput
                    ref={pinRef}
                    style={styles.input}
                    value={pin}
                    onChangeText={(v) => setPinInput(v.replace(/[^\d]/g, '').slice(0, 4))}
                    placeholder="••••"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    testID="login-pin"
                  />
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>CONFIRM PIN</Text>
                <View style={styles.inputRow}>
                  <Icon name="lock-closed" size={16} color={theme.colors.blue} />
                  <TextInput
                    style={styles.input}
                    value={confirm}
                    onChangeText={(v) => setConfirm(v.replace(/[^\d]/g, '').slice(0, 4))}
                    placeholder="••••"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    testID="login-pin-confirm"
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>ENTER YOUR PIN</Text>
                <View style={styles.inputRow}>
                  <Icon name="lock-closed" size={16} color={theme.colors.blue} />
                  <TextInput
                    style={styles.input}
                    value={pin}
                    onChangeText={(v) => setPinInput(v.replace(/[^\d]/g, '').slice(0, 4))}
                    placeholder="••••"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    secureTextEntry
                    autoFocus
                    maxLength={4}
                    testID="login-pin"
                  />
                </View>
                <Text style={styles.hint}>
                  Forgot your PIN? You can reset and re-enroll from the device.
                </Text>
                <Pressable
                  onPress={() => setMode('register')}
                  style={styles.resetBtn}
                  testID="login-reset"
                >
                  <Text style={styles.resetText}>RESET IDENTITY</Text>
                </Pressable>
              </>
            )}

            <Pressable
              disabled={busy}
              onPress={handle}
              style={[styles.submit, busy && { opacity: 0.5 }]}
              testID="login-submit"
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.bg} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'register' ? 'INITIALIZE JARVIS' : 'AUTHENTICATE'}
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footer}>
            E2E SECURED · PIN ENCRYPTED ON DEVICE
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000814' },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    letterSpacing: 5,
    marginTop: 16,
    textShadowColor: 'rgba(0,229,255,0.6)',
    textShadowRadius: 12,
  },
  subtitle: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 3,
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(0,8,20,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.35)',
    borderRadius: theme.radius.lg,
    padding: 18,
    marginTop: 28,
  },
  label: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#000A14',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    letterSpacing: 1.5,
  },
  hint: {
    color: theme.colors.textTertiary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
  },
  resetBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  resetText: {
    color: theme.colors.textTertiary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
  },
  submit: {
    marginTop: 20,
    backgroundColor: theme.colors.blue,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    shadowColor: theme.colors.blue,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  submitText: {
    color: '#000814',
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    letterSpacing: 3,
  },
  footer: {
    color: theme.colors.textTertiary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 18,
  },
});
