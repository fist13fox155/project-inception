/**
 * App-wide preferences (voice choice, narration on/off) persisted in SecureStore.
 */
import * as SecureStore from 'expo-secure-store';

export type VoiceId = 'system' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

const KEY_VOICE = 'pref_voice';
const KEY_NARRATE = 'pref_narrate';

export async function getVoice(): Promise<VoiceId> {
  return ((await SecureStore.getItemAsync(KEY_VOICE)) as VoiceId) || 'system';
}
export async function setVoice(v: VoiceId) {
  await SecureStore.setItemAsync(KEY_VOICE, v);
}
export async function getNarrate(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_NARRATE)) === '1';
}
export async function setNarrate(b: boolean) {
  await SecureStore.setItemAsync(KEY_NARRATE, b ? '1' : '0');
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
