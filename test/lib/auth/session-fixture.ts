import type { DatabaseSync } from 'node:sqlite';

import { generateKeyBase64 } from '../../../src/lib/crypto';
import { createSessionToken } from '../../../src/lib/auth/session';

/** The session secret every test environment uses. */
export const SESSION_SECRET = 'test-session-secret-value-0123456789';

/** The request cookies a test "browser" sends; tests set and clear entries. */
export const jar = new Map<string, string>();

/**
 * Stands in for Next's `cookies()`: answers from {@link jar}. Mock
 * `next/headers` with it before importing code that reads the session.
 */
export const fakeCookies = async () => ({
  get: (name: string) => {
    const value = jar.get(name);
    return value === undefined ? undefined : { name, value };
  },
});

/** The bindings and secrets a Worker would have, for `installCloudflareContext`. */
export function testEnv(): Record<string, unknown> {
  return {
    SESSION_SECRET,
    TOKEN_ENCRYPTION_KEY: generateKeyBase64(),
    GOOGLE_OAUTH_CLIENT_ID: 'client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
    // Embedding runs in the background after a write; a canned vector keeps it quiet.
    AI: { run: async () => ({ data: [[0.1, 0.2, 0.3]] }) },
  };
}

/** A signed session token for a person, optionally under a given epoch or expiry. */
export function sessionTokenFor(
  user: Readonly<{ id: number; email?: string }>,
  options: Readonly<{ ep?: number; exp?: number }> = {},
): Promise<string> {
  return createSessionToken(
    { uid: user.id, email: user.email ?? 'a@b.com', ...options },
    SESSION_SECRET,
  );
}

/** Insert a user row and return its id. */
export function insertUser(
  raw: DatabaseSync,
  fields: Readonly<{
    id?: number;
    email?: string;
    refresh_token_enc?: string | null;
    recipes_folder_id?: string | null;
    session_epoch?: number;
    google_sub?: string;
  }> = {},
): number {
  const id = fields.id ?? 1;
  raw
    .prepare(
      "INSERT INTO users (id, google_sub, email, refresh_token_enc, recipes_folder_id, session_epoch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'n', 'n')",
    )
    .run(
      id,
      fields.google_sub ?? `sub-${id}`,
      fields.email ?? 'a@b.com',
      fields.refresh_token_enc ?? null,
      fields.recipes_folder_id ?? null,
      fields.session_epoch ?? 0,
    );
  return id;
}
