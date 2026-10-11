/**
 * @packageDocumentation
 *
 * Stateless signed sessions. After OAuth we don't want to hit the database on
 * every request just to know who is logged in, so the user's id and email are
 * put in a compact token — `base64url(payload).base64url(HMAC-SHA256)` — and
 * stored in an httpOnly cookie. The HMAC (keyed by the `SESSION_SECRET`) makes
 * the token tamper-proof; a bad signature or past expiry yields no session.
 *
 * This is deliberately small: it carries identity only. Anything sensitive
 * (the Drive refresh token) stays encrypted in the database, never in the
 * cookie.
 */

/** Name of the session cookie. */
export const SESSION_COOKIE = 'chowdown_session';

/** How long a session stays valid, in seconds (30 days). */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** The claims carried in the session token. */
export interface SessionPayload {
  /** `users.id` primary key. */
  uid: number;
  email: string;
  /** Expiry as a Unix timestamp (seconds). */
  exp: number;
}

/** URL-safe base64 without padding. */
function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode URL-safe base64 back to bytes. */
function fromBase64url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '==='.slice((padded.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Re-wrap bytes as an ArrayBuffer-backed `BufferSource` for Web Crypto (see lib/crypto). */
function bufferSource(bytes: Uint8Array): BufferSource {
  return new Uint8Array(bytes);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bufferSource(new TextEncoder().encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Create a signed session token for a user. `exp` defaults to now +
 * {@link SESSION_TTL_SECONDS} but can be supplied (e.g. in tests).
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'> & { exp?: number },
  secret: string,
): Promise<string> {
  const full: SessionPayload = {
    uid: payload.uid,
    email: payload.email,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = base64url(new TextEncoder().encode(JSON.stringify(full)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      bufferSource(new TextEncoder().encode(body)),
    ),
  );
  return `${body}.${base64url(sig)}`;
}

/**
 * Verify a session token: checks the signature (constant-time via
 * `crypto.subtle.verify`) and the expiry. Returns the payload or null.
 */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = token.indexOf('.');
  if (dot <= 0) {
    return null;
  }
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await hmacKey(secret);
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      'HMAC',
      key,
      bufferSource(fromBase64url(sig)),
      bufferSource(new TextEncoder().encode(body)),
    );
  } catch {
    return null;
  }
  if (!ok) {
    return null;
  }
  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
  } catch {
    return null;
  }
  if (
    typeof payload.exp !== 'number' ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return payload;
}
