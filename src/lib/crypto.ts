/**
 * @packageDocumentation
 *
 * Symmetric encryption for secrets we must store at rest — specifically each
 * user's Google OAuth **refresh token**, which lives in the D1 `users` table
 * and lets the app act on their Drive (and the headless MCP write tools fire)
 * while they are away. A refresh token is as good as a password, so it is
 * never stored in the clear: it is sealed with AES-GCM under a 256-bit key
 * that exists only as a Worker secret (`TOKEN_ENCRYPTION_KEY`), never in the
 * database. Compromise of the database alone therefore yields nothing usable.
 *
 * Everything here uses the Web Crypto API (`crypto.subtle`), which is a global
 * in both the Cloudflare Workers runtime and Node 24, so the same code runs in
 * production and under Jest with no polyfill.
 */

import { base64ToBytes, bufferSource, bytesToBase64 } from '@/lib/util/base64';

/** Length of the AES-GCM initialisation vector, in bytes (96 bits — the standard). */
const IV_BYTES = 12;

/** Required raw key length in bytes (256-bit AES). */
const KEY_BYTES = 32;

/**
 * Import the base64 master key into a non-extractable `CryptoKey`. The key is
 * validated to be exactly 256 bits so a misconfigured secret fails loudly at
 * the first use rather than producing subtly weak ciphertext.
 */
async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyBase64);
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (256-bit); got ${raw.length}`,
    );
  }
  return crypto.subtle.importKey(
    'raw',
    bufferSource(raw),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Generate a fresh 256-bit key, base64-encoded — a convenience for setup
 * scripts and tests. In production the key is generated once (e.g.
 * `openssl rand -base64 32`) and stored as the `TOKEN_ENCRYPTION_KEY` secret.
 */
export function generateKeyBase64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

/**
 * Encrypt `plaintext` under the base64 key. A random IV is generated per call
 * and prepended to the ciphertext, so the returned base64 blob (`iv || ct`) is
 * self-contained — {@link decryptSecret} needs nothing but the blob and the
 * key. GCM also authenticates, so tampering is detected on decrypt.
 */
export async function encryptSecret(
  plaintext: string,
  keyBase64: string,
): Promise<string> {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: bufferSource(iv) },
      key,
      bufferSource(new TextEncoder().encode(plaintext)),
    ),
  );
  return bytesToBase64(new Uint8Array([...iv, ...ciphertext]));
}

/**
 * Reverse {@link encryptSecret}. Throws if the key is wrong or the blob was
 * tampered with (GCM authentication failure), so callers can treat any thrown
 * error as "this secret is unusable, force re-authentication".
 */
export async function decryptSecret(
  packedBase64: string,
  keyBase64: string,
): Promise<string> {
  const key = await importKey(keyBase64);
  const packed = base64ToBytes(packedBase64);
  const iv = packed.slice(0, IV_BYTES);
  const ciphertext = packed.slice(IV_BYTES);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bufferSource(iv) },
    key,
    bufferSource(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
