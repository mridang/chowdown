/**
 * @packageDocumentation
 *
 * PKCE (RFC 7636), `S256` only. The client sends a hash of a secret when it
 * starts the flow and the secret itself when it redeems the code, so a stolen
 * authorization code is useless on its own.
 */

/** URL-safe base64 without padding. */
export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** The `S256` code challenge for a verifier. */
export async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

/** A verifier is 43–128 characters from the unreserved set (RFC 7636 §4.1). */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

/** Whether `verifier` is well formed and hashes to `challenge`. */
export async function verifyPkce(
  verifier: string,
  challenge: string,
): Promise<boolean> {
  if (!VERIFIER.test(verifier)) {
    return false;
  }
  const computed = await s256(verifier);
  if (computed.length !== challenge.length) {
    return false;
  }
  // Compare every character so timing doesn't reveal how much matched.
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ challenge.charCodeAt(i);
  }
  return diff === 0;
}

/** A challenge is a base64url SHA-256: exactly 43 characters. */
export function isWellFormedChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9\-_]{43}$/.test(challenge);
}
