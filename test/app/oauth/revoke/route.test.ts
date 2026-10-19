import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { OPTIONS, POST } from '../../../../src/app/oauth/revoke/route';
import { installCloudflareContext, sqliteD1 } from '../../../lib/db/sqlite-d1';

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  const made = sqliteD1('0008_oauth.sql', '0012_oauth_housekeeping.sql');
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
});

afterEach(() => restore());

const revoke = (body: URLSearchParams) =>
  POST(
    new Request('https://chowdown.test/oauth/revoke', { method: 'POST', body }),
  );

describe('POST /oauth/revoke', () => {
  it('answers 200 with {} for a token it does not know, like one it does', async () => {
    const res = await revoke(new URLSearchParams({ token: 'cdn_at_unknown' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it('ends the grant a known token belongs to', async () => {
    const { hashSecret } = await import('../../../../src/lib/oauth/secrets');
    raw
      .prepare(
        "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES ('g', 7, 'c', 'recipes:read', 'r', 'now')",
      )
      .run();
    raw
      .prepare(
        "INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at) VALUES (?, 'access', 'g', 99999999999)",
      )
      .run(await hashSecret('cdn_at_known'));
    const res = await revoke(new URLSearchParams({ token: 'cdn_at_known' }));
    expect(res.status).toBe(200);
    expect(
      raw
        .prepare('SELECT revoked_at FROM oauth_grants WHERE id = ?')
        .get('g')?.['revoked_at'],
    ).not.toBeNull();
  });

  it('answers 400 when there is no token', async () => {
    const res = await revoke(new URLSearchParams());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });
});

describe('OPTIONS /oauth/revoke', () => {
  it('answers the CORS preflight with 204', () => {
    expect(OPTIONS().status).toBe(204);
  });
});
