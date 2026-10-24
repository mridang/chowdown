import { readdirSync } from 'node:fs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { DELETE, GET, OPTIONS, POST } from '@/app/mcp/route';
import { createDatabase } from '@/lib/db/client';
import { createOAuthStore } from '@/lib/db/oauth';
import { s256 } from '@/lib/oauth/pkce';
import {
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  type TokenResponse,
} from '@/lib/oauth/token-endpoint';
import { installCloudflareContext, sqliteD1 } from '../../lib/db/sqlite-d1';

const ORIGIN = 'https://chowdown.test';
const URL = `${ORIGIN}/mcp`;
const OTHER = 'https://evil.example';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

/** Every migration, in order: the route reads users, grants and rate-limit counters. */
const MIGRATIONS = readdirSync('migrations')
  .filter((file) => file.endsWith('.sql'))
  .toSorted();

let raw: DatabaseSync;
let restore: () => void;
let database: ReturnType<typeof createDatabase>;

beforeEach(() => {
  const made = sqliteD1(...MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  database = createDatabase(made.d1);
  // Minting a token logs a security event; keep the test output clean.
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  raw
    .prepare(
      'INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, ?, ?, ?, ?)',
    )
    .run('sub-7', 'cook@example.com', '2026-01-01', '2026-01-01');
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

/** A request to the endpoint. */
const request = (
  method: string,
  headers: Record<string, string> = {},
  body?: string,
) => new Request(URL, { method, headers, body });

/** A JSON-RPC message as a request body. */
const rpc = (method: string, params?: Record<string, unknown>) =>
  JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

/** Sign user 7 in through the real OAuth code exchange and return the access token. */
async function accessToken(
  scope: readonly string[] = ['recipes:read', 'recipes:write'],
): Promise<string> {
  const store = createOAuthStore(database);
  const now = Math.floor(Date.now() / 1000);
  const code = await issueAuthorizationCode(
    store,
    {
      clientId: 'client-1',
      userId: 7,
      redirectUri: 'https://app.example/cb',
      redirectUriSent: true,
      codeChallenge: await s256(VERIFIER),
      scope: [...scope],
      resource: URL,
    },
    now,
  );
  const issued = await exchangeAuthorizationCode(
    store,
    {
      code,
      clientId: 'client-1',
      redirectUri: 'https://app.example/cb',
      codeVerifier: VERIFIER,
      resource: URL,
    },
    (resource) => resource === URL,
    now,
  );
  expect(issued).toHaveProperty('access_token');
  return (issued as TokenResponse).access_token;
}

/** The headers of a signed-in caller. */
const bearer = (token: string, extra: Record<string, string> = {}) => ({
  authorization: `Bearer ${token}`,
  ...extra,
});

describe('OPTIONS /mcp', () => {
  it('answers a preflight from an allowed origin with 204 and echoes the origin', async () => {
    const res = await OPTIONS(
      request('OPTIONS', { origin: 'https://claude.ai' }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://claude.ai',
    );
    expect(res.headers.get('access-control-allow-headers')).toContain(
      'MCP-Protocol-Version',
    );
    expect(res.headers.get('access-control-allow-methods')).toContain('DELETE');
    expect(res.headers.get('allow')).toBe('POST, OPTIONS');
  });

  it('echoes the headers the preflight asks for', async () => {
    const res = await OPTIONS(
      request('OPTIONS', {
        origin: 'https://claude.ai',
        'access-control-request-headers': 'authorization, mcp-param-region',
      }),
    );
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'authorization, mcp-param-region',
    );
  });

  it('refuses a preflight from an origin we do not know', async () => {
    const res = await OPTIONS(request('OPTIONS', { origin: OTHER }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(
      -32600,
    );
  });
});

describe('without a token', () => {
  it.each([
    ['POST', POST],
    ['GET', GET],
    ['DELETE', DELETE],
  ])('answers %s with the 401 that starts sign-in', async (method, handler) => {
    const res = await handler(request(method));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain(
      'resource_metadata="https://chowdown.test/.well-known/oauth-protected-resource/mcp"',
    );
    expect(res.headers.get('www-authenticate')).not.toContain('invalid_token');
    expect(await res.json()).toMatchObject({
      id: null,
      error: { code: -32600 },
    });
  });

  it('turns away an unknown origin before it asks for a token', async () => {
    const res = await POST(request('POST', { origin: OTHER }, '{}'));
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toBeNull();
  });
});

describe('with a token that is not good', () => {
  it.each([
    ['a made-up string', 'nonsense'],
    ['a well-formed token nobody issued', `cdn_at_${'A'.repeat(43)}`],
  ])(
    'answers %s with a 401 that says the token is invalid',
    async (_n, token) => {
      const res = await POST(request('POST', bearer(token), rpc('ping')));
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain(
        'error="invalid_token"',
      );
    },
  );

  it('does not read the database for a token that cannot be one of ours', async () => {
    const spy = jest.spyOn(raw, 'prepare');
    const res = await POST(request('POST', bearer('nonsense'), rpc('ping')));
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('answers a token whose grant was revoked with a 401', async () => {
    const token = await accessToken();
    raw.prepare('UPDATE oauth_grants SET revoked_at = 1').run();
    const res = await POST(request('POST', bearer(token), rpc('ping')));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain(
      'error="invalid_token"',
    );
  });
});

describe('with a valid token', () => {
  it('runs a POST as the user the token belongs to', async () => {
    const token = await accessToken();
    const res = await POST(request('POST', bearer(token), rpc('tools/list')));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as {
      id: number;
      result: { tools: { name: string }[] };
    };
    expect(body.id).toBe(1);
    expect(body.result.tools.map((tool) => tool.name)).toContain('get_recipe');
  });

  it('counts the call against the rate limit of that user', async () => {
    const token = await accessToken();
    await POST(request('POST', bearer(token), rpc('ping')));
    expect(
      raw.prepare('SELECT key FROM rate_limits ORDER BY key').all(),
    ).toEqual([{ key: 'mcp-request:7' }]);
  });

  it('holds the user to the scopes they approved', async () => {
    const token = await accessToken(['recipes:read']);
    const res = await POST(
      request(
        'POST',
        bearer(token),
        rpc('tools/call', { name: 'set_measurement_system' }),
      ),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toContain(
      'error="insufficient_scope"',
    );
  });

  it('echoes an allowed origin on the reply', async () => {
    const token = await accessToken();
    const res = await POST(
      request(
        'POST',
        bearer(token, { origin: 'https://claude.ai' }),
        rpc('ping'),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://claude.ai',
    );
  });

  it.each([
    ['GET', GET],
    ['DELETE', DELETE],
  ])(
    'answers %s with 405, what is allowed and the CORS headers',
    async (method, handler) => {
      const token = await accessToken();
      const res = await handler(
        request(method, bearer(token, { origin: 'https://claude.ai' })),
      );
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST, OPTIONS');
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://claude.ai',
      );
    },
  );

  it.each([
    ['POST', POST],
    ['GET', GET],
    ['DELETE', DELETE],
  ])(
    'refuses %s from an unknown origin before it looks at the token',
    async (method, handler) => {
      const token = await accessToken();
      const spy = jest.spyOn(raw, 'prepare');
      const res = await handler(
        request(
          method,
          bearer(token, { origin: OTHER }),
          method === 'POST' ? rpc('ping') : undefined,
        ),
      );
      expect(res.status).toBe(403);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    },
  );
});

describe('when the database cannot be reached', () => {
  it('answers 503 with a JSON-RPC error and Retry-After, and leaks nothing', async () => {
    const token = await accessToken();
    restore();
    const broken = {
      prepare: () => {
        throw new Error('D1 is down: secret detail');
      },
      batch: async () => {
        throw new Error('D1 is down: secret detail');
      },
    } as unknown as D1Database;
    restore = installCloudflareContext(broken);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(
      request(
        'POST',
        bearer(token, { origin: 'https://claude.ai' }),
        rpc('ping'),
      ),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://claude.ai',
    );
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({
      id: null,
      error: { code: -32603 },
    });
    expect(text).not.toContain('secret detail');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
