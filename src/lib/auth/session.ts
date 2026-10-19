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

import {
  base64UrlToBytes,
  bufferSource,
  bytesToBase64Url,
} from '../util/base64';

/** Name of the session cookie. */
export const SESSION_COOKIE = 'chowdown_session';

/** How long a session stays valid, in seconds (30 days). */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** The claims carried in the session token. */
export interface SessionPayload {
  /** `users.id` primary key. */
  readonly uid: number;
  readonly email: string;
  /**
   * The Google display name and profile photo address, so the header can greet
   * the person without a database read. Absent on sessions issued before they
   * were added; those fall back to a lookup.
   */
  readonly name?: string;
  readonly picture?: string;
  /**
   * Whether Google Drive was connected when the session was issued, so the
   * header can offer "Connect Google Drive" without a database read. A hint for
   * the header only: pages that need Drive check the database. Absent on
   * sessions issued before it was added; those fall back to a lookup.
   */
  readonly drive?: boolean;
  /** Expiry as a Unix timestamp (seconds). */
  readonly exp: number;
}

/** The HMAC-SHA-256 key for a session secret, usable for signing and verifying. */
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
  payload: Omit<SessionPayload, 'exp'> & { readonly exp?: number },
  secret: string,
): Promise<string> {
  const full: SessionPayload = {
    uid: payload.uid,
    email: payload.email,
    // Kept short: the whole token travels in a cookie on every request.
    ...(payload.name ? { name: payload.name.slice(0, 80) } : {}),
    ...(payload.picture && payload.picture.length <= 400
      ? { picture: payload.picture }
      : {}),
    ...(payload.drive !== undefined ? { drive: payload.drive } : {}),
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(full)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      bufferSource(new TextEncoder().encode(body)),
    ),
  );
  return `${body}.${bytesToBase64Url(sig)}`;
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
  if (!(await signatureValid(key, body, sig))) {
    return null;
  }
  const payload = parsePayload(body);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

/** Whether `sig` (URL-safe base64) is the HMAC of `body` under `key`; malformed signatures are simply invalid. */
async function signatureValid(
  key: CryptoKey,
  body: string,
  sig: string,
): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      'HMAC',
      key,
      bufferSource(base64UrlToBytes(sig)),
      bufferSource(new TextEncoder().encode(body)),
    );
  } catch {
    return false;
  }
}

/** The claims inside a token body, or null if it isn't JSON of the right shape. */
function parsePayload(body: string): SessionPayload | null {
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(body)),
    );
    return isSessionPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether a parsed value carries the claims every session token we issue has. */
function isSessionPayload(value: unknown): value is SessionPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'exp' in value &&
    typeof value.exp === 'number'
  );
}
