import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { uid: number | null } = { uid: 7 };

jest.unstable_mockModule('../../../../../../src/lib/auth/current-user', () => ({
  getSessionUid: async () => session.uid,
  getCurrentUser: async () => null,
}));

const { GET } =
  await import('../../../../../../src/app/api/users/self/connected-apps/route');

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1('0008_oauth.sql', '0012_oauth_housekeeping.sql');
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  const client = raw.prepare(
    'INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  client.run('c1', 'dcr', 'Claude', '[]', '2026-01-01T00:00:00.000Z');
  client.run('c2', 'dcr', 'ChatGPT', '[]', '2026-01-01T00:00:00.000Z');
  const grant = raw.prepare(
    "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at, last_used_at) VALUES (?, ?, ?, 'recipes:read', 'r', ?, ?)",
  );
  grant.run('g1-old', 7, 'c1', '2026-02-01T00:00:00.000Z', null);
  grant.run(
    'g1',
    7,
    'c1',
    '2026-03-01T00:00:00.000Z',
    '2026-03-02T00:00:00.000Z',
  );
  grant.run('g2', 7, 'c2', '2026-02-15T00:00:00.000Z', null);
  grant.run('g3', 8, 'c1', '2026-03-01T00:00:00.000Z', null);
});

afterEach(() => restore());

const URL = 'https://chowdown.test/api/users/self/connected-apps';

describe('GET /api/users/self/connected-apps', () => {
  it('lists each app once, newest first, with the latest use', async () => {
    const res = await GET(new Request(URL));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([
      {
        id: 'g1',
        name: 'Claude',
        scopes: ['recipes:read'],
        connected_at: '2026-03-01T00:00:00.000Z',
        last_used_at: '2026-03-02T00:00:00.000Z',
      },
      {
        id: 'g2',
        name: 'ChatGPT',
        scopes: ['recipes:read'],
        connected_at: '2026-02-15T00:00:00.000Z',
      },
    ]);
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await GET(new Request(URL))).status).toBe(401);
  });
});
