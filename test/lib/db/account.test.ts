import { describe, expect, it } from '@jest/globals';

import { deleteAccountData } from '@/domain/db/account';
import { APP_MIGRATIONS } from './migrations';
import { sqliteDatabase } from './sqlite-db';

/** Rows per table belonging to each of two people, so a delete can be checked for scope. */
function seeded() {
  const made = sqliteDatabase(...APP_MIGRATIONS);
  const { raw } = made;
  const user = raw.prepare(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (?, ?, ?, 'n', 'n')",
  );
  user.run(1, 'sub-1', 'a@b.com');
  user.run(2, 'sub-2', 'c@d.com');
  [1, 2].forEach((id) => {
    raw
      .prepare(
        "INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES (?, ?, 'r.cook', 'src', 'n', 'n')",
      )
      .run(id, `file-${id}`);
    raw
      .prepare(
        "INSERT INTO embeddings (user_id, drive_file_id, title, vector) VALUES (?, ?, 't', '[]')",
      )
      .run(id, `file-${id}`);
    raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, ?, 'n')",
      )
      .run(id, `file-${id}`);
    raw
      .prepare(
        "INSERT INTO recipe_imports (id, user_id, status, items, created_at) VALUES (?, ?, 'COMPLETED', '[]', 'n')",
      )
      .run(`imp-${id}`, id);
    raw
      .prepare(
        "INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at) VALUES (?, 'dcr', 'c', '[]', 'n')",
      )
      .run(`client-${id}`);
    raw
      .prepare(
        "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES (?, ?, ?, 's', 'r', 'n')",
      )
      .run(`grant-${id}`, id, `client-${id}`);
    raw
      .prepare(
        "INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at) VALUES (?, 'access', ?, 1)",
      )
      .run(`token-${id}`, `grant-${id}`);
    raw
      .prepare(
        "INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at) VALUES (?, ?, ?, 'u', 'c', 's', 'r', 1)",
      )
      .run(`code-${id}`, `client-${id}`, id);
  });
  return made;
}

/** How many rows of `table` belong to `userId` (through its grants for tokens). */
function countFor(
  made: ReturnType<typeof seeded>,
  table: string,
  userId: number,
): number {
  const sql =
    table === 'oauth_tokens'
      ? 'SELECT count(*) AS n FROM oauth_tokens WHERE grant_id = ?'
      : table === 'users'
        ? 'SELECT count(*) AS n FROM users WHERE id = ?'
        : `SELECT count(*) AS n FROM ${table} WHERE user_id = ?`;
  const arg = table === 'oauth_tokens' ? `grant-${userId}` : userId;
  return Number(made.raw.prepare(sql).get(arg)?.['n']);
}

const TABLES = [
  'users',
  'recipes',
  'embeddings',
  'favourites',
  'recipe_imports',
  'oauth_grants',
  'oauth_tokens',
  'oauth_codes',
] as const;

describe('deleteAccountData', () => {
  it.each(TABLES)("removes the person's rows from %s", async (table) => {
    const made = seeded();
    await deleteAccountData(made.db, 1);
    expect(countFor(made, table, 1)).toBe(0);
  });

  it.each(TABLES)("leaves the other person's rows in %s", async (table) => {
    const made = seeded();
    await deleteAccountData(made.db, 1);
    expect(countFor(made, table, 2)).toBe(1);
  });

  it('does nothing, and does not fail, for an account that does not exist', async () => {
    const made = seeded();
    await deleteAccountData(made.db, 99);
    expect(countFor(made, 'users', 1)).toBe(1);
  });
});
