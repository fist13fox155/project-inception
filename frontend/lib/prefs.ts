/**
 * App-wide preferences persisted in SecureStore (native) or localStorage (web).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type VoiceId = 'system' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

const KEY_VOICE = 'pref_voice';
const KEY_NARRATE = 'pref_narrate';
const KEY_ARCHITECT = 'pref_architect_name';
const KEY_PIN = 'pref_inception_pin';
const KEY_SESSION = 'pref_session_active';

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
  return ((await get(KEY_VOICE)) as VoiceId) || 'nova';
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
  return (await get(KEY_SESSION)) === '1';
}
export async function setSession(active: boolean) { await set(KEY_SESSION, active ? '1' : '0'); }

export async function clearInceptionAuth() {
  await remove(KEY_ARCHITECT);
  await remove(KEY_PIN);
  await remove(KEY_SESSION);
}

export const VOICE_OPTIONS: { id: VoiceId; label: string; desc: string }[] = [
  { id: 'system',  label: 'System TTS',    desc: 'Free · on-device · fast' },
  { id: 'nova',    label: 'NOVA',          desc: 'Premium · warm female' },
  { id: 'shimmer', label: 'SHIMMER',       desc: 'Premium · bright female' },
  { id: 'alloy',   label: 'ALLOY',         desc: 'Premium · neutral' },
  { id: 'echo',    label: 'ECHO',          desc: 'Premium · British male' },
  { id: 'fable',   label: 'FABLE',         desc: 'Premium · storyteller' },
  { id: 'onyx',    label: 'ONYX',          desc: 'Premium · deep male' },
];
