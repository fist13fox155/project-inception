/**
 * App-wide preferences persisted in SecureStore (native) or localStorage (web).
 * NOTE: session is NOT persisted across app restarts — PIN is required every
 * time you open Project Inception or DAGRCMD, by design.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type VoiceId = 'system' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

const KEY_VOICE = 'pref_voice';
const KEY_NARRATE = 'pref_narrate';
const KEY_ARCHITECT = 'pref_architect_name';
const KEY_PIN = 'pref_inception_pin';
// Session lives ONLY in-memory for this run. Resets every app launch / reload.
let sessionActive = false;

async function get(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function set(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
    return;
  }
  try { await SecureStore.setItemAsync(key, value); } catch {}
}
async function remove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.removeItem(key); } catch {}
    return;
  }
  try { await SecureStore.deleteItemAsync(key); } catch {}
}

export async function getVoice(): Promise<VoiceId> {
  return ((await get(KEY_VOICE)) as VoiceId) || 'echo';
}
export async function setVoice(v: VoiceId) { await set(KEY_VOICE, v); }
export async function getNarrate(): Promise<boolean> { return (await get(KEY_NARRATE)) === '1'; }
export async function setNarrate(b: boolean) { await set(KEY_NARRATE, b ? '1' : '0'); }

export async function getArchitectName(): Promise<string> { return (await get(KEY_ARCHITECT)) || ''; }
export async function setArchitectName(n: string) { await set(KEY_ARCHITECT, n.trim()); }

export async function getPin(): Promise<string> { return (await get(KEY_PIN)) || ''; }
export async function setPin(pin: string) { await set(KEY_PIN, pin); }

export async function isAuthenticated(): Promise<boolean> {
  const name = await getArchitectName();
  const pin = await getPin();
  if (!name || !pin) return false;
  return sessionActive;
}
export async function setSession(active: boolean) { sessionActive = active; }

export async function clearInceptionAuth() {
  await remove(KEY_ARCHITECT);
  await remove(KEY_PIN);
  sessionActive = false;
}

export const VOICE_OPTIONS: { id: VoiceId; label: string; desc: string }[] = [
  { id: 'echo',    label: 'ECHO',          desc: 'Premium · Deep British male (JARVIS)' },
  { id: 'onyx',    label: 'ONYX',          desc: 'Premium · Deep male' },
  { id: 'fable',   label: 'FABLE',         desc: 'Premium · British storyteller' },
  { id: 'alloy',   label: 'ALLOY',         desc: 'Premium · Neutral' },
  { id: 'nova',    label: 'NOVA',          desc: 'Premium · Warm female' },
  { id: 'shimmer', label: 'SHIMMER',       desc: 'Premium · Bright female' },
  { id: 'system',  label: 'System (UK)',   desc: 'Free · On-device British English' },
];
