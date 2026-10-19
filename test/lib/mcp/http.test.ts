import { describe, expect, it } from '@jest/globals';

import type { User } from '../../../src/lib/db/users';
import {
  corsFor,
  handleMcpPost,
  originRefusal,
  unauthorizedResponse,
} from '../../../src/lib/mcp/http';

const ALL_SCOPES = ['recipes:read', 'recipes:write'];
const SELF = 'https://chowdown.test';
const META = 'io.modelcontextprotocol/protocolVersion';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SELF}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const user = {} as User;
const modern = (method: string, extra: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  params: { ...extra, _meta: { [META]: '2026-07-28' } },
});
const modernHeaders = (method: string) => ({
  'mcp-protocol-version': '2026-07-28',
  'mcp-method': method,
});

describe('originRefusal / corsFor', () => {
  it('turns away an origin we do not know, before reading anything', async () => {
    const res = originRefusal(
      new Request(`${SELF}/api/mcp`, {
        headers: { origin: 'https://evil.example' },
      }),
      SELF,
    );
    expect(res?.status).toBe(403);
  });

  it('lets through no origin, our own and a known assistant', () => {
    expect(originRefusal(new Request(`${SELF}/api/mcp`), SELF)).toBeNull();
    for (const origin of [SELF, 'https://claude.ai']) {
      expect(
        originRefusal(
          new Request(`${SELF}/api/mcp`, { headers: { origin } }),
          SELF,
        ),
      ).toBeNull();
    }
  });

  it('echoes an allowed caller’s origin instead of allowing everyone', () => {
    const cors = corsFor(
      new Request(`${SELF}/api/mcp`, {
        headers: { origin: 'https://claude.ai' },
      }),
    );
    expect(cors['Access-Control-Allow-Origin']).toBe('https://claude.ai');
    expect(cors['Vary']).toBe('Origin');
  });
});

describe('handleMcpPost — scopes', () => {
  const write = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'set_measurement_system', arguments: { system: 'metric' } },
  };

  it('refuses a write tool to a token that may only read, and says which scope is missing', async () => {
    const res = await handleMcpPost(post(write), user, ['recipes:read'], SELF);
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toContain('insufficient_scope');
    expect(res.headers.get('www-authenticate')).toContain('recipes:write');
  });

  it('refuses a whole batch if any message in it needs a scope the token lacks', async () => {
    const res = await handleMcpPost(
      post([{ jsonrpc: '2.0', id: 2, method: 'ping' }, write]),
      user,
      ['recipes:read'],
      SELF,
    );
    expect(res.status).toBe(403);
  });

  it('treats a token with no scopes as able to do nothing', async () => {
    const res = await handleMcpPost(post(write), user, [], SELF);
    expect(res.status).toBe(403);
  });
});

describe('handleMcpPost — malformed bodies', () => {
  const invalid = async (body: unknown) => {
    const res = await handleMcpPost(post(body), user, ALL_SCOPES, SELF);
    return {
      status: res.status,
      code: ((await res.json()) as { error: { code: number } }).error.code,
    };
  };

  it('answers JSON that is not an object with Invalid Request, not a crash', async () => {
    expect(await invalid([null])).toEqual({ status: 400, code: -32600 });
    expect(await invalid(7)).toEqual({ status: 400, code: -32600 });
    expect(await invalid('ping')).toEqual({ status: 400, code: -32600 });
    expect(await invalid([[]])).toEqual({ status: 400, code: -32600 });
  });

  it('refuses an empty batch and an oversized one', async () => {
    expect(await invalid([])).toEqual({ status: 400, code: -32600 });
    const many = Array.from({ length: 21 }, () => ({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping',
    }));
    expect(await invalid(many)).toEqual({ status: 400, code: -32600 });
  });

  it('still answers a batch within the limit', async () => {
    const res = await handleMcpPost(
      post([
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { jsonrpc: '2.0', id: 2, method: 'ping' },
      ]),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(2);
  });

  it('gives any notification an empty 202, not an error', async () => {
    const res = await handleMcpPost(
      post({ jsonrpc: '2.0', method: 'notifications/cancelled' }),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(res.status).toBe(202);
  });
});

describe('handleMcpPost — protocol checks', () => {
  it('answers server/discover for a newest-era client', async () => {
    const res = await handleMcpPost(
      post(modern('server/discover'), modernHeaders('server/discover')),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: Record<string, unknown> };
    expect(body.result['resultType']).toBe('complete');
    expect(body.result['supportedVersions']).toContain('2026-07-28');
    expect(body.result['supportedVersions']).toContain('2025-11-25');
  });

  it('refuses a newest-era request whose headers disagree with its body', async () => {
    const res = await handleMcpPost(
      post(modern('tools/list'), modernHeaders('ping')),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(
      -32020,
    );
  });

  it('refuses a version we do not speak with the versions we do', async () => {
    const res = await handleMcpPost(
      post(
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { 'mcp-protocol-version': '1999-01-01' },
      ),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: number; data: { supported: string[] } };
    };
    expect(body.error.code).toBe(-32022);
    expect(body.error.data.supported).toContain('2026-07-28');
  });

  it('answers an unknown method with 404 to a newest-era client, 200 to an older one', async () => {
    const newest = await handleMcpPost(
      post(modern('nope/nope'), modernHeaders('nope/nope')),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(newest.status).toBe(404);
    expect(
      ((await newest.json()) as { error: { code: number } }).error.code,
    ).toBe(-32601);
    const older = await handleMcpPost(
      post({ jsonrpc: '2.0', id: 1, method: 'nope/nope' }),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(older.status).toBe(200);
  });

  it('negotiates an older client’s version in the initialize handshake', async () => {
    const res = await handleMcpPost(
      post({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {} },
      }),
      user,
      ALL_SCOPES,
      SELF,
    );
    const body = (await res.json()) as { result: { protocolVersion: string } };
    expect(body.result.protocolVersion).toBe('2025-06-18');
  });

  it('adds resultType to a newest-era result and leaves an older one alone', async () => {
    const newest = await handleMcpPost(
      post(modern('ping'), modernHeaders('ping')),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(
      ((await newest.json()) as { result: Record<string, unknown> }).result[
        'resultType'
      ],
    ).toBe('complete');
    const older = await handleMcpPost(
      post({ jsonrpc: '2.0', id: 2, method: 'ping' }),
      user,
      ALL_SCOPES,
      SELF,
    );
    expect(
      ((await older.json()) as { result: Record<string, unknown> }).result,
    ).not.toHaveProperty('resultType');
  });
});

describe('unauthorizedResponse', () => {
  it('starts the sign-in flow when there was no token', async () => {
    const res = unauthorizedResponse(SELF, false, {});
    expect(res.status).toBe(401);
    const challenge = res.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain(
      `resource_metadata="${SELF}/.well-known/oauth-protected-resource/api/mcp"`,
    );
    expect(challenge).not.toContain('invalid_token');
    expect(await res.json()).toMatchObject({
      error: { code: -32001, message: 'Authorization required' },
    });
  });

  it('says the token was bad when one was sent', () => {
    const res = unauthorizedResponse(SELF, true, {});
    expect(res.headers.get('www-authenticate')).toContain(
      'error="invalid_token"',
    );
  });

  it('carries the CORS headers it is given', () => {
    const res = unauthorizedResponse(SELF, false, {
      'Access-Control-Allow-Origin': 'https://claude.ai',
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://claude.ai',
    );
  });
});
