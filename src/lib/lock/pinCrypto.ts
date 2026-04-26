/**
 * PIN crypto for Chronicle App Lock.
 *
 * - Hashes a 4–6 digit PIN with PBKDF2-SHA256, 250k iterations, 16-byte random salt.
 * - The hash and salt live ONLY in localStorage on this device.
 * - The PIN itself is never stored, never transmitted, never written to IndexedDB.
 */

const ITERATIONS = 250_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

export interface PinHashRecord {
  version: 1;
  iterations: number;
  salt: string; // base64
  hash: string; // base64
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveBits(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const buf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    HASH_BITS,
  );
  return new Uint8Array(buf);
}

export async function hashPin(pin: string): Promise<PinHashRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(pin, salt, ITERATIONS);
  return {
    version: 1,
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(hash),
  };
}

/** Constant-time byte comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPin(pin: string, record: PinHashRecord): Promise<boolean> {
  const salt = base64ToBytes(record.salt);
  const expected = base64ToBytes(record.hash);
  const candidate = await deriveBits(pin, salt, record.iterations);
  return timingSafeEqual(candidate, expected);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
