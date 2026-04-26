/**
 * WebAuthn helpers for biometric unlock.
 *
 * Uses platform authenticators (Face ID / Touch ID / Android biometric) with
 * `userVerification: 'required'`. The credential id is stored locally so the
 * unlock flow can request the same authenticator on subsequent unlocks.
 *
 * Notes:
 * - We use WebAuthn purely as a local "user-present + verified" check. We do
 *   not validate the assertion server-side; the security boundary is the
 *   device biometric itself.
 * - Falls back gracefully when WebAuthn or platform authenticators are not
 *   available (the Settings toggle is disabled in that case).
 */

const RP_NAME = 'Chronicle';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.credentials;
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register a new platform credential bound to this user. Returns the
 * credential id (base64url) that callers should persist locally.
 */
export async function registerBiometric(userId: string, userEmail: string): Promise<string> {
  if (!isWebAuthnSupported()) throw new Error('Biometric not supported on this device');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge as BufferSource,
      rp: { name: RP_NAME, id: window.location.hostname },
      user: {
        id: userIdBytes as BufferSource,
        name: userEmail,
        displayName: userEmail,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('Biometric registration cancelled');
  return bytesToBase64Url(new Uint8Array(credential.rawId));
}

/**
 * Verify with the previously-registered credential. Returns true on success.
 * Throws if the user cancels or the platform reports a hard failure.
 */
export async function verifyBiometric(credentialIdB64Url: string): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credId = base64UrlToBytes(credentialIdB64Url);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge as BufferSource,
      allowCredentials: [{ id: credId as BufferSource, type: 'public-key', transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60_000,
      rpId: window.location.hostname,
    },
  }) as PublicKeyCredential | null;

  return !!assertion;
}
