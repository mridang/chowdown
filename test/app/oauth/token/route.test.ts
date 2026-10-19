import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { OPTIONS, POST } from '../../../../src/app/oauth/token/route';
import { createDatabase } from '../../../../src/lib/db/client';
import { createOAuthStore } from '../../../../src/lib/db/oauth';
import { s256 } from '../../../../src/lib/oauth/pkce';
import { issueAuthorizationCode } from '../../../../src/lib/oauth/token-endpoint';
import { installCloudflareContext, sqliteD1 } from '../../../lib/db/sqlite-d1';

const ORIGIN = 'https://chowdown.test';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

let raw: DatabaseSync;
let restore: () => void;
let database: ReturnType<typeof createDatabase>;

beforeEach(() => {
  const made = sqliteD1(
    '0008_oauth.sql',
    '0011_rate_limits.sql',
    '0012_oauth_housekeeping.sql',
  );
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  database = createDatabase(made.d1);
});

afterEach(() => restore());

/** A fresh authorization code for user 7 and client `client-1`. */
async function newCode(): Promise<string> {
  return issueAuthorizationCode(
    createOAuthStore(database),
    {
      clientId: 'client-1',
      userId: 7,
      redirectUri: 'https://app.example/cb',
      codeChallenge: await s256(VERIFIER),
      scope: ['recipes:read', 'recipes:write'],
      resource: `${ORIGIN}/api/mcp`,
    },
    Math.floor(Date.now() / 1000),
  );
}

/** A token request with the given form fields. */
const token = (
  fields: Record<string, string>,
  headers: Record<string, string> = { 'cf-connecting-ip': '203.0.113.7' },
) =>
  POST(
    new Request(`${ORIGIN}/oauth/token`, {
      method: 'POST',
      body: new URLSearchParams(fields),
      headers,
    }),
  );

/** Redeem a code for a token pair. */
async function redeem(): Promise<Record<string, string>> {
  const res = await token({
    grant_type: 'authorization_code',
    client_id: 'client-1',
    code: await newCode(),
    redirect_uri: 'https://app.example/cb',
    code_verifier: VERIFIER,
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, string>;
}

describe('POST /oauth/token', () => {
  it('redeems a code for a token pair, never cached', async () => {
    const res = await token({
      grant_type: 'authorization_code',
      client_id: 'client-1',
      code: await newCode(),
      redirect_uri: 'https://app.example/cb',
      code_verifier: VERIFIER,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toMatchObject({
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'recipes:read recipes:write',
    });
  });

  it('answers 400 invalid_grant for a wrong verifier', async () => {
    const res = await token({
      grant_type: 'authorization_code',
      client_id: 'client-1',
      code: await newCode(),
      redirect_uri: 'https://app.example/cb',
      code_verifier: `${VERIFIER}x`,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('answers 401 invalid_client without a client_id', async () => {
    const res = await token({ grant_type: 'refresh_token' });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_client' });
  });

  it('answers 400 invalid_request for a body that is not a form', async () => {
    const res = await POST(
      new Request(`${ORIGIN}/oauth/token`, {
        method: 'POST',
        body: 'x',
        headers: { 'content-type': 'multipart/form-data' },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers 400 unsupported_grant_type for another grant', async () => {
    const res = await token({ grant_type: 'password', client_id: 'client-1' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'unsupported_grant_type' });
  });

  it('rotates a refresh token, and answers a retry with the old one inside the grace window', async () => {
    const first = await redeem();
    const refresh = (value: string) =>
      token({
        grant_type: 'refresh_token',
        client_id: 'client-1',
        refresh_token: value,
      });
    const second = await refresh(first['refresh_token'] ?? '');
    expect(second.status).toBe(200);
    // The client lost that response and asks again with the token it still has.
    const retry = await refresh(first['refresh_token'] ?? '');
    expect(retry.status).toBe(200);
    expect(
      raw
        .prepare(
          'SELECT COUNT(*) AS n FROM oauth_grants WHERE revoked_at IS NULL',
        )
        .get(),
    ).toEqual({ n: 1 });
  });

  it('revokes the grant when a spent refresh token comes back after the grace window', async () => {
    const first = await redeem();
    const refresh = () =>
      token({
        grant_type: 'refresh_token',
        client_id: 'client-1',
        refresh_token: first['refresh_token'] ?? '',
      });
    await refresh();
    // Make the rotation look old by moving its "spent" mark back in time.
    raw
      .prepare(
        'UPDATE oauth_tokens SET used_at = used_at - 3600 WHERE used_at IS NOT NULL',
      )
      .run();
    const late = await refresh();
    expect(late.status).toBe(400);
    expect(await late.json()).toMatchObject({ error: 'invalid_grant' });
    expect(
      raw
        .prepare(
          'SELECT COUNT(*) AS n FROM oauth_grants WHERE revoked_at IS NULL',
        )
        .get(),
    ).toEqual({ n: 0 });
  });

  it('keeps one connection per user and client when the app is approved again', async () => {
    await redeem();
    await redeem();
    expect(
      raw
        .prepare(
          'SELECT COUNT(*) AS n FROM oauth_grants WHERE revoked_at IS NULL',
        )
        .get(),
    ).toEqual({ n: 1 });
  });

  it('answers 429 with Retry-After when an address asks too often, and counts addresses separately', async () => {
    const hit = (ip: string) =>
      token(
        { grant_type: 'password', client_id: 'c' },
        { 'cf-connecting-ip': ip },
      );
    for (let i = 0; i < 120; i += 1) {
      expect((await hit('203.0.113.7')).status).toBe(400);
    }
    const limited = await hit('203.0.113.7');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(await limited.json()).toMatchObject({
      error: 'temporarily_unavailable',
    });
    expect((await hit('198.51.100.9')).status).toBe(400);
  });
});

describe('OPTIONS /oauth/token', () => {
  it('answers the CORS preflight with 204', () => {
    expect(OPTIONS().status).toBe(204);
  });
});
