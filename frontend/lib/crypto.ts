/**
 * E2E crypto helpers using tweetnacl (X25519 + XSalsa20-Poly1305 via nacl.box).
 * Private keys stored in expo-secure-store. Server NEVER sees plaintext.
 */
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';

const PRIV_KEY = 'dagr_priv_key';
const PUB_KEY = 'dagr_pub_key';
const CALLSIGN = 'dagr_callsign';
const AUTH_CODE = 'dagr_auth_code';

export type KeyPair = { publicKey: string; secretKey: string };

export async function ensureKeyPair(): Promise<KeyPair> {
  const existingPriv = await SecureStore.getItemAsync(PRIV_KEY);
  const existingPub = await SecureStore.getItemAsync(PUB_KEY);
  if (existingPriv && existingPub) return { publicKey: existingPub, secretKey: existingPriv };
  const kp = nacl.box.keyPair();
  const pub = naclUtil.encodeBase64(kp.publicKey);
  const priv = naclUtil.encodeBase64(kp.secretKey);
  await SecureStore.setItemAsync(PRIV_KEY, priv);
  await SecureStore.setItemAsync(PUB_KEY, pub);
  return { publicKey: pub, secretKey: priv };
}

export async function clearIdentity() {
  await SecureStore.deleteItemAsync(PRIV_KEY);
  await SecureStore.deleteItemAsync(PUB_KEY);
  await SecureStore.deleteItemAsync(CALLSIGN);
  await SecureStore.deleteItemAsync(AUTH_CODE);
}

export async function storeCredentials(callsign: string, authCode: string) {
  await SecureStore.setItemAsync(CALLSIGN, callsign);
  await SecureStore.setItemAsync(AUTH_CODE, authCode);
}

export async function getCredentials(): Promise<{ callsign?: string; authCode?: string }> {
  const callsign = (await SecureStore.getItemAsync(CALLSIGN)) || undefined;
  const authCode = (await SecureStore.getItemAsync(AUTH_CODE)) || undefined;
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
