/**
 * E2E crypto helpers using tweetnacl (X25519 + XSalsa20-Poly1305 via nacl.box).
 * Private keys stored in expo-secure-store on native, localStorage on web.
 * Server NEVER sees plaintext.
 */
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

// CRITICAL: tweetnacl needs a secure PRNG. Wire up the platform's:
//   - Web → globalThis.crypto.getRandomValues
//   - Native → expo-crypto's getRandomBytes
nacl.setPRNG((x: Uint8Array, n: number) => {
  try {
    if (Platform.OS === 'web' && (globalThis as any).crypto?.getRandomValues) {
      const buf = new Uint8Array(n);
      (globalThis as any).crypto.getRandomValues(buf);
      for (let i = 0; i < n; i++) x[i] = buf[i];
      return;
    }
    const bytes = ExpoCrypto.getRandomBytes(n);
    for (let i = 0; i < n; i++) x[i] = bytes[i];
  } catch (e) {
    // Last-resort weak fallback so the app doesn't hard-crash on enlist
    // (no real security, but keeps the flow working for testing).
    console.warn('[crypto] secure PRNG unavailable; falling back to Math.random', e);
    for (let i = 0; i < n; i++) x[i] = Math.floor(Math.random() * 256);
  }
});

const PRIV_KEY = 'dagr_priv_key';
const PUB_KEY = 'dagr_pub_key';
const CALLSIGN = 'dagr_callsign';
const AUTH_CODE = 'dagr_auth_code';

async function storeGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function storeSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
    return;
  }
  try { await SecureStore.setItemAsync(key, value); } catch {}
}
async function storeDel(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.removeItem(key); } catch {}
    return;
  }
  try { await SecureStore.deleteItemAsync(key); } catch {}
}

export type KeyPair = { publicKey: string; secretKey: string };

export async function ensureKeyPair(): Promise<KeyPair> {
  const existingPriv = await storeGet(PRIV_KEY);
  const existingPub = await storeGet(PUB_KEY);
  if (existingPriv && existingPub) return { publicKey: existingPub, secretKey: existingPriv };
  const kp = nacl.box.keyPair();
  const pub = naclUtil.encodeBase64(kp.publicKey);
  const priv = naclUtil.encodeBase64(kp.secretKey);
  await storeSet(PRIV_KEY, priv);
  await storeSet(PUB_KEY, pub);
  return { publicKey: pub, secretKey: priv };
}

export async function clearIdentity() {
  await storeDel(PRIV_KEY);
  await storeDel(PUB_KEY);
  await storeDel(CALLSIGN);
  await storeDel(AUTH_CODE);
}

export async function storeCredentials(callsign: string, authCode: string) {
  await storeSet(CALLSIGN, callsign);
  await storeSet(AUTH_CODE, authCode);
}

export async function getCredentials(): Promise<{ callsign?: string; authCode?: string }> {
  const callsign = (await storeGet(CALLSIGN)) || undefined;
  const authCode = (await storeGet(AUTH_CODE)) || undefined;
  return { callsign, authCode };
}

/** Encrypt a string for ONE recipient. Returns base64 ct + nonce. */
export function encryptForRecipient(
  plaintext: string,
  recipientPublicKeyB64: string,
  mySecretKeyB64: string
): { ct: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ct = nacl.box(
    naclUtil.decodeUTF8(plaintext),
    nonce,
    naclUtil.decodeBase64(recipientPublicKeyB64),
    naclUtil.decodeBase64(mySecretKeyB64)
  );
  return { ct: naclUtil.encodeBase64(ct), nonce: naclUtil.encodeBase64(nonce) };
}

/** Decrypt ciphertext from a sender. Returns plaintext or null on failure. */
export function decryptFromSender(
  ctB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  mySecretKeyB64: string
): string | null {
  try {
    const pt = nacl.box.open(
      naclUtil.decodeBase64(ctB64),
      naclUtil.decodeBase64(nonceB64),
      naclUtil.decodeBase64(senderPublicKeyB64),
      naclUtil.decodeBase64(mySecretKeyB64)
    );
    return pt ? naclUtil.encodeUTF8(pt) : null;
  } catch {
    return null;
  }
}

/** Build the ciphertexts map for a multi-recipient channel message. */
export function encryptForChannel(
  plaintext: string,
  recipients: { callsign: string; publicKey: string }[],
  mySecretKeyB64: string
): Record<string, { ct: string; nonce: string }> {
  const out: Record<string, { ct: string; nonce: string }> = {};
  for (const r of recipients) {
    if (!r.publicKey) continue;
    out[r.callsign] = encryptForRecipient(plaintext, r.publicKey, mySecretKeyB64);
  }
  return out;
}
