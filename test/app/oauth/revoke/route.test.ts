import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { OPTIONS, POST } from '@/app/oauth/revoke/route';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../lib/core/db/sqlite-d1';
import { quietSecurityLogs } from '../../../lib/oauth/quiet-logs';

quietSecurityLogs();

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  const made = sqliteD1(
    '0008_oauth.sql',
    '0011_rate_limits.sql',
    '0012_oauth_housekeeping.sql',
    '0016_oauth_redirect_uri_sent.sql',
    '0017_oauth_client_assertions.sql',
    '0018_oauth_client_logo.sql',
  );
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
});

afterEach(() => restore());

const revoke = (
  body: URLSearchParams,
  headers: Record<string, string> = { 'cf-connecting-ip': '203.0.113.7' },
) =>
  POST(
    new Request('https://chowdown.test/oauth/revoke', {
      method: 'POST',
      body,
      headers,
    }),
  );

describe('POST /oauth/revoke', () => {
  it('answers 200 with {} for a token it does not know, like one it does', async () => {
    const res = await revoke(new URLSearchParams({ token: 'cdn_at_unknown' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it('ends the grant a known token belongs to', async () => {
    const { hashSecret } = await import('@/lib/oauth');
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

describe('POST /oauth/revoke limits and body rules', () => {
  it('answers 429 with Retry-After when an address asks too often, and counts addresses separately', async () => {
    const hit = (ip: string) =>
      revoke(new URLSearchParams({ token: 'cdn_at_x' }), {
        'cf-connecting-ip': ip,
      });
    for (let i = 0; i < 60; i += 1) {
      expect((await hit('203.0.113.7')).status).toBe(200);
    }
    const limited = await hit('203.0.113.7');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect((await hit('198.51.100.9')).status).toBe(200);
  });

  it('answers 400 for a form over 16 KiB, a body that is not a form, and a body that is not text', async () => {
    const big = await revoke(
      new URLSearchParams({ token: 'x'.repeat(20_000) }),
    );
    expect(big.status).toBe(400);
    const json = await POST(
      new Request('https://chowdown.test/oauth/revoke', {
        method: 'POST',
        body: '{"token":"x"}',
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(json.status).toBe(400);
    const binary = await POST(
      new Request('https://chowdown.test/oauth/revoke', {
        method: 'POST',
        body: new Uint8Array([0xff, 0xfe]),
      }),
    );
    expect(binary.status).toBe(400);
  });
});

describe('OPTIONS /oauth/revoke', () => {
  it('answers the CORS preflight with 204', () => {
    expect(OPTIONS().status).toBe(204);
  });
});
