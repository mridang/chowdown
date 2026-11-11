import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { DatabaseSync } from 'node:sqlite';

import { SESSION_COOKIE } from '@/domain/auth/app';
import type { User } from '@/domain/db/users';
import { SessionTokens } from '@/lib/session';
import { APP_MIGRATIONS } from '../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';

const SESSION_SECRET = 'test-session-secret-value-0123456789';
const URL = 'https://app.test/api/users/self';

let raw: DatabaseSync;
let restore: () => void;
/** The Cookie header of the signed-in caller. */
let cookie: string;

/** The ids left in a table, sorted. */
const left = (table: string, column = 'id') =>
  raw
    .prepare(`SELECT ${column} AS id FROM ${table} ORDER BY ${column}`)
    .all()
    .map((row) => String(row['id']));

/** Each time the app tidied up after a deleted account: whose, and which users were left then. */
const tidied: { id: number; users: string[] }[] = [];

jest.unstable_mockModule('@/domain/account/app', () => ({
  afterAccountDeleted: (user: Readonly<User>) => {
    tidied.push({ id: user.id, users: left('users') });
  },
}));

const { DELETE, GET, dynamic } = await import('@/app/api/users/self/route');

beforeEach(async () => {
  tidied.length = 0;
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1, { SESSION_SECRET });
  raw
    .prepare(
      "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 'g7', 'a@b.com', '2026-01-01', 'now'), (8, 'g8', 'c@d.com', 'now', 'now')",
    )
    .run();
  raw
    .prepare(
      "INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at) VALUES ('c', 'dcr', 'C', '[]', 'now')",
    )
    .run();
  raw
    .prepare(
      "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES ('g7', 7, 'c', 's', 'r', 'now'), ('g8', 8, 'c', 's', 'r', 'now')",
    )
    .run();
  raw
    .prepare(
      "INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at) VALUES ('t7', 'access', 'g7', 1), ('t8', 'access', 'g8', 1)",
    )
    .run();
  const token = await new SessionTokens(SESSION_SECRET).create({
    uid: 7,
    email: 'a@b.com',
    ep: 0,
  });
  cookie = `${SESSION_COOKIE}=${token}`;
});

afterEach(() => restore());

/** A GET of the account with the given headers. */
const read = (headers?: Record<string, string>) =>
  GET(new Request(URL, { headers: headers ?? { cookie } }));

/** A DELETE of the account with the given headers. */
const remove = (headers?: Record<string, string>) =>
  DELETE(
    new Request(URL, { method: 'DELETE', headers: headers ?? { cookie } }),
  );

describe('GET /api/users/self', () => {
  it('is never prerendered', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('answers the account the session cookie names', async () => {
    const res = await read();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: 'a@b.com' });
  });

  it('is never kept by a shared cache', async () => {
    const res = await read();
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('answers 401 without a session cookie', async () => {
    const res = await read({});
    expect(res.status).toBe(401);
  });

  it('answers 401 once the session has been ended everywhere', async () => {
    raw.prepare('UPDATE users SET session_epoch = 1 WHERE id = 7').run();
    const res = await read();
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/users/self', () => {
  it('answers 204', async () => {
    const res = await remove();
    expect(res.status).toBe(204);
  });

  it('clears the session cookie', async () => {
    const res = await remove();
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
  });

  it('ends the session: the same cookie no longer works', async () => {
    await remove();
    const res = await read();
    expect(res.status).toBe(401);
  });

  it('deletes the account and nobody else’s', async () => {
    await remove();
    expect(left('users')).toEqual(['8']);
  });

  it('deletes the person’s connected apps and nobody else’s', async () => {
    await remove();
    expect(left('oauth_grants')).toEqual(['g8']);
  });

  it('deletes the tokens of the person’s connected apps and nobody else’s', async () => {
    await remove();
    expect(left('oauth_tokens', 'token_hash')).toEqual(['t8']);
  });

  it('lets the app tidy up after the person, once the account is gone', async () => {
    await remove();
    expect(tidied).toEqual([{ id: 7, users: ['8'] }]);
  });

  it('answers 401 without a session cookie, and deletes nothing', async () => {
    const res = await remove({});
    expect(res.status).toBe(401);
    expect(left('users')).toEqual(['7', '8']);
    expect(tidied).toEqual([]);
  });

  it('answers 401 once the session has been ended everywhere', async () => {
    raw.prepare('UPDATE users SET session_epoch = 1 WHERE id = 7').run();
    const res = await remove();
    expect(res.status).toBe(401);
  });

  it('answers 403 for a request from another site, and deletes nothing', async () => {
    const res = await remove({ cookie, 'sec-fetch-site': 'cross-site' });
    expect(res.status).toBe(403);
    expect(left('users')).toEqual(['7', '8']);
    expect(tidied).toEqual([]);
  });
});
