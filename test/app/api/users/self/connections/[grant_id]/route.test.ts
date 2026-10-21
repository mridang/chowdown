import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { quietSecurityLogs } from '../../../../../../lib/oauth/quiet-logs';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
/** `ended`: the person signed out everywhere, though the cookie itself still verifies. */
const session: { uid: number | null; ended: boolean } = {
  uid: 7,
  ended: false,
};

jest.unstable_mockModule(
  '../../../../../../../src/lib/auth/current-user',
  () => ({
    getSessionUid: async () => session.uid,
    getLiveSessionUid: async () => (session.ended ? null : session.uid),
    getCurrentUser: async () => null,
  }),
);

const { DELETE } =
  await import('../../../../../../../src/app/api/users/self/connections/[grant_id]/route');

quietSecurityLogs();

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  session.ended = false;
  const made = sqliteD1(
    '0008_oauth.sql',
    '0012_oauth_housekeeping.sql',
    '0016_oauth_redirect_uri_sent.sql',
  );
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

const URL = 'https://chowdown.test/api/users/self/connections';

describe('DELETE /api/users/self/connections/:grant_id', () => {
  const del = (id: string, headers: Record<string, string> = {}) =>
    DELETE(
      new Request(`${URL}/${id}`, {
        method: 'DELETE',
        headers: { 'sec-fetch-site': 'same-origin', ...headers },
      }),
      { params: Promise.resolve({ grant_id: id }) },
    );

  it('disconnects the app, including any older grant for it, with 204', async () => {
    expect((await del('g1')).status).toBe(204);
    expect(
      raw
        .prepare(
          'SELECT id FROM oauth_grants WHERE revoked_at IS NULL ORDER BY id',
        )
        .all()
        .map((row) => row['id']),
    ).toEqual(['g2', 'g3']);
  });

  it("answers 404 for another user's grant and leaves it alone", async () => {
    expect((await del('g3')).status).toBe(404);
    expect(
      raw
        .prepare("SELECT revoked_at FROM oauth_grants WHERE id = 'g3'")
        .get()?.['revoked_at'],
    ).toBeNull();
  });

  it('answers 404 for a grant that does not exist', async () => {
    expect((await del('nope')).status).toBe(404);
  });

  it('revokes an app with a newer read-only install and an older edit-capable one in one go', async () => {
    raw
      .prepare(
        "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES ('g1-edit', 7, 'c1', 'recipes:write', 'r', '2026-01-15T00:00:00.000Z')",
      )
      .run();
    expect((await del('g1')).status).toBe(204);
    expect(
      raw
        .prepare(
          "SELECT COUNT(*) AS n FROM oauth_grants WHERE client_id = 'c1' AND user_id = 7 AND revoked_at IS NULL",
        )
        .get(),
    ).toEqual({ n: 0 });
  });

  it('logs the disconnection', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    await del('g1');
    expect(
      info.mock.calls.map(([line]) => JSON.parse(String(line))),
    ).toContainEqual(
      expect.objectContaining({
        event: 'oauth.grant_revoked',
        grantId: 'g1',
        userId: 7,
        grants: 2,
        reason: 'disconnected_by_user',
      }),
    );
    info.mockRestore();
  });

  it('answers 401 for a session that was ended everywhere, and revokes nothing', async () => {
    session.ended = true;
    expect((await del('g1')).status).toBe(401);
    expect(
      raw
        .prepare(
          'SELECT COUNT(*) AS n FROM oauth_grants WHERE revoked_at IS NULL',
        )
        .get(),
    ).toEqual({ n: 4 });
  });

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await del('g1')).status).toBe(401);
  });

  it('answers 403 to a cross-site request', async () => {
    expect((await del('g1', { 'sec-fetch-site': 'cross-site' })).status).toBe(
      403,
    );
  });
});
