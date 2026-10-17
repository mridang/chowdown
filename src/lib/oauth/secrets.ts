/**
 * @packageDocumentation
 *
 * Opaque secrets (codes, access tokens, refresh tokens). Each is 256 random
 * bits with a readable prefix; only a SHA-256 hash is ever stored, so a leaked
 * database can't be replayed against the API. Because the secrets are random
 * and long, a plain fast hash is enough (no salt or slow KDF needed).
 */

import { base64url } from './pkce';

/** A new random secret such as `cdn_at_Qk3…`. */
export function newSecret(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${prefix}_${base64url(bytes)}`;
}

/** The hex SHA-256 of a secret — what the database stores and looks up. */
export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const CODE_PREFIX = 'cdn_code';
export const ACCESS_PREFIX = 'cdn_at';
export const REFRESH_PREFIX = 'cdn_rt';
