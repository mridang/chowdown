import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { s256 } from '../../../../src/lib/oauth/pkce';
import { installCloudflareContext, sqliteD1 } from '../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { uid: number | null } = { uid: 7 };

jest.unstable_mockModule('../../../../src/lib/auth/current-user', () => ({
  getSessionUid: async () => session.uid,
}));

const { POST } = await import('../../../../src/app/oauth/consent/route');

const ORIGIN = 'https://chowdown.test';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

let raw: DatabaseSync;
let restore: () => void;
let challenge: string;

beforeEach(async () => {
  session.uid = 7;
  const made = sqliteD1(
    '0008_oauth.sql',
    '0011_rate_limits.sql',
    '0012_oauth_housekeeping.sql',
  );
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  challenge = await s256(VERIFIER);
  raw
    .prepare(
      'INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      'dcr_abc',
      'dcr',
      'Assistant',
      JSON.stringify([
        'https://app.example/cb',
        'http://localhost:6274/oauth/callback',
        'http://example.com/old',
      ]),
      '2026-01-01T00:00:00.000Z',
    );
});

afterEach(() => restore());

/** A consent form post with the usual fields, overridable. */
function consent(
  fields: Record<string, string | undefined> = {},
  headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
): Promise<Response> {
  const form = new URLSearchParams(
    Object.entries({
      client_id: 'dcr_abc',
      redirect_uri: 'https://app.example/cb',
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'xyz',
      decision: 'approve',
      ...fields,
    }).flatMap(([k, v]): [string, string][] =>
      v === undefined ? [] : [[k, v]],
    ),
  );
  return POST(
    new Request(`${ORIGIN}/oauth/consent`, {
      method: 'POST',
      body: form,
      headers,
    }),
  );
}

describe('POST /oauth/consent', () => {
  it('sends an approval back to the redirect address with a code, the state and the issuer', async () => {
    const res = await consent();
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://app.example/cb',
    );
    expect(location.searchParams.get('state')).toBe('xyz');
    expect(location.searchParams.get('iss')).toBe(ORIGIN);
    expect(location.searchParams.get('code')).toMatch(/^cdn_/);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM oauth_codes').get()).toEqual({
      n: 1,
    });
  });

  it('sends a refusal back as access_denied and mints nothing', async () => {
    const res = await consent({ decision: 'deny' });
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('code')).toBeNull();
    expect(raw.prepare('SELECT COUNT(*) AS n FROM oauth_codes').get()).toEqual({
      n: 0,
    });
  });

  it('accepts a loopback redirect on a different port than the registered one', async () => {
    const res = await consent({
      redirect_uri: 'http://localhost:51234/oauth/callback',
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain(
      'http://localhost:51234/oauth/callback?',
    );
  });

  it('reports a problem with the request to the verified redirect address', async () => {
    const res = await consent({ response_type: 'token' });
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('error')).toBe(
      'unsupported_response_type',
    );
    expect(location.searchParams.get('state')).toBe('xyz');
    expect(location.searchParams.get('iss')).toBe(ORIGIN);
  });

  it('shows an error, with no redirect, for a redirect address the client never registered', async () => {
    const res = await consent({ redirect_uri: 'https://evil.example/cb' });
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  it('shows an error, with no redirect, for a stored address the rules no longer allow', async () => {
    const res = await consent({ redirect_uri: 'http://example.com/old' });
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  it('shows an error for a client that is not known', async () => {
    const res = await consent({ client_id: 'dcr_nobody' });
    expect(res.status).toBe(400);
  });

  it('refuses a cross-site post', async () => {
    const res = await consent({}, { 'sec-fetch-site': 'cross-site' });
    expect(res.status).toBe(403);
  });

  it('asks for sign-in when nobody is signed in', async () => {
    session.uid = null;
    const res = await consent();
    expect(res.status).toBe(401);
  });

  it('answers 400 for a body that is not a readable form', async () => {
    const res = await POST(
      new Request(`${ORIGIN}/oauth/consent`, {
        method: 'POST',
        body: 'not multipart',
        headers: {
          'sec-fetch-site': 'same-origin',
          'content-type': 'multipart/form-data',
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('answers 429 with Retry-After when too many client documents are being fetched', async () => {
    raw
      .prepare(
        'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)',
      )
      .run('oauth-cimd-all:all', Math.floor(Date.now() / 1000), 10_000);
    const res = await consent({
      client_id: 'https://claude.ai/oauth/metadata.json',
      redirect_uri: 'https://claude.ai/cb',
    });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
