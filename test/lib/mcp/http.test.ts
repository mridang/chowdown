import { describe, expect, it, jest } from '@jest/globals';

import type { User } from '@/lib/db/users';
import type { McpAuth } from '@/lib/mcp/auth';
import {
  corsFor,
  handleMcpPost,
  originRefusal,
  respondToMcp,
  unauthorizedResponse,
  type Authenticate,
} from '@/lib/mcp/http';
import { MAX_BODY_BYTES, type RateLimitDeps } from '@/lib/mcp/request-limits';
import { SERVER_INFO } from '@/lib/mcp/server-info';
import type { RateLimitStore } from '@/lib/util/rate-limit';

const ALL_SCOPES = ['recipes:read', 'recipes:write'];
const SELF = 'https://chowdown.test';
const META = 'io.modelcontextprotocol/protocolVersion';
const CAPS = 'io.modelcontextprotocol/clientCapabilities';

/** A POST to the endpoint with a JSON body. */
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SELF}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
/** A POST whose body is exactly this text. */
const postText = (body: string, headers: Record<string, string> = {}) =>
  new Request(`${SELF}/mcp`, { method: 'POST', headers, body });
const user = { id: 1 } as User;
const modern = (method: string, extra: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  params: { ...extra, _meta: { [META]: '2026-07-28', [CAPS]: {} } },
});
const modernHeaders = (method: string, name?: string) => ({
  'mcp-protocol-version': '2026-07-28',
  'mcp-method': method,
  ...(name === undefined ? {} : { 'mcp-name': name }),
});

/** Counters kept in a map, so no test reaches a database. */
function fakeRate(over: Partial<RateLimitDeps> = {}): {
  readonly deps: RateLimitDeps;
  readonly keys: () => readonly string[];
  readonly purged: number[];
} {
  const counters = new Map<string, { count: number; windowStart: number }>();
  const purged: number[] = [];
  const store: RateLimitStore = {
    async hit(key, now, windowSeconds) {
      const found = counters.get(key);
      const next =
        found && found.windowStart > now - windowSeconds
          ? { ...found, count: found.count + 1 }
          : { count: 1, windowStart: now };
      counters.set(key, next);
      return next;
    },
    async purge(before) {
      purged.push(before);
    },
  };
  return {
    deps: { store: () => store, now: () => 5000, random: () => 0.5, ...over },
    keys: () => [...counters.keys()].toSorted(),
    purged,
  };
}

/** What the endpoint answers: a result or an error, as JSON, or nothing. */
interface Reply {
  readonly jsonrpc?: string;
  readonly id?: unknown;
  readonly result?: Record<string, unknown>;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: Record<string, unknown>;
  };
}

/** Send a message through the real handler and read what came back. */
async function send(
  body: unknown,
  headers: Record<string, string> = {},
  scopes: readonly string[] = ALL_SCOPES,
  rate: RateLimitDeps = fakeRate().deps,
) {
  const res = await handleMcpPost(
    post(body, headers),
    user,
    scopes,
    SELF,
    rate,
  );
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    json: text ? (JSON.parse(text) as Reply) : undefined,
  };
}

describe('originRefusal / corsFor', () => {
  it('turns away an origin we do not know, before reading anything', async () => {
    const res = originRefusal(
      new Request(`${SELF}/mcp`, {
        headers: { origin: 'https://evil.example' },
      }),
      SELF,
    );
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Origin not allowed' },
    });
  });

  it('lets through no origin, our own and a known assistant', () => {
    expect(originRefusal(new Request(`${SELF}/mcp`), SELF)).toBeNull();
    for (const origin of [SELF, 'https://claude.ai']) {
      expect(
        originRefusal(
          new Request(`${SELF}/mcp`, { headers: { origin } }),
          SELF,
        ),
      ).toBeNull();
    }
  });

  it('echoes an allowed caller’s origin instead of allowing everyone', () => {
    const cors = corsFor(
      new Request(`${SELF}/mcp`, {
        headers: { origin: 'https://claude.ai' },
      }),
      SELF,
    );
    expect(cors['Access-Control-Allow-Origin']).toBe('https://claude.ai');
    expect(cors['Vary']).toBe('Origin');
  });

  it('refuses with no CORS headers, so a page from that origin sees only a network error', async () => {
    const res = originRefusal(
      new Request(`${SELF}/mcp`, {
        headers: { origin: 'https://evil.example' },
      }),
      SELF,
    );
    expect(res?.headers.get('access-control-allow-origin')).toBeNull();
    expect(res?.headers.get('cache-control')).toBe('no-store');
  });

  it('lets an origin through that the operator listed, including one the URL parser calls opaque', () => {
    const from = (origin: string, extra?: string) =>
      originRefusal(
        new Request(`${SELF}/mcp`, { headers: { origin } }),
        SELF,
        extra,
      );
    expect(from('chrome-extension://abcdef')?.status).toBe(403);
    expect(
      from('chrome-extension://abcdef', 'chrome-extension://abcdef'),
    ).toBeNull();
    expect(from('https://tool.example', 'https://tool.example')).toBeNull();
    expect(
      from('https://tool.example:8443', 'https://tool.example')?.status,
    ).toBe(403);
  });

  it('gives a caller with no Origin the open set, and one with a refused Origin none at all', () => {
    expect(corsFor(new Request(`${SELF}/mcp`), SELF)).toMatchObject({
      'Access-Control-Allow-Origin': '*',
    });
    expect(
      corsFor(
        new Request(`${SELF}/mcp`, {
          headers: { origin: 'https://evil.example' },
        }),
        SELF,
      ),
    ).toEqual({});
  });

  it('echoes the origin of a listed extension and reads the list from the argument', () => {
    const request = new Request(`${SELF}/mcp`, {
      headers: { origin: 'chrome-extension://abcdef' },
    });
    expect(corsFor(request, SELF)).toEqual({});
    expect(
      corsFor(request, SELF, 'chrome-extension://abcdef')[
        'Access-Control-Allow-Origin'
      ],
    ).toBe('chrome-extension://abcdef');
  });

  it('echoes the headers a preflight asks for, so one more header does not fail it', () => {
    const preflight = (requested: string) =>
      corsFor(
        new Request(`${SELF}/mcp`, {
          method: 'OPTIONS',
          headers: {
            origin: 'https://claude.ai',
            'access-control-request-headers': requested,
          },
        }),
        SELF,
      );
    const asked = preflight('authorization, content-type, mcp-param-region');
    expect(asked['Access-Control-Allow-Headers']).toBe(
      'authorization, content-type, mcp-param-region',
    );
    expect(asked['Vary']).toBe('Origin, Access-Control-Request-Headers');
    // Anything that is not a plain list of header names, or is absurdly long, is ignored.
    for (const odd of ['a b c', 'x;y', 'a,', 'a'.repeat(513)]) {
      const fallback = preflight(odd);
      expect(fallback['Access-Control-Allow-Headers']).toContain(
        'MCP-Protocol-Version',
      );
      expect(fallback['Vary']).toBe('Origin');
    }
  });

  it('puts the CORS headers on a normal reply, a refusal and a 202', async () => {
    const headers = { origin: 'https://claude.ai' };
    const reply = await send(
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      headers,
    );
    const refused = await send({ nope: true }, headers);
    const accepted = await send(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      headers,
    );
    for (const res of [reply, refused, accepted]) {
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://claude.ai',
      );
    }
  });
});

describe('handleMcpPost — scopes', () => {
  const write = {
    jsonrpc: '2.0',
    id: 'w1',
    method: 'tools/call',
    params: { name: 'set_measurement_system', arguments: { system: 'metric' } },
  };

  it('refuses a write tool to a token that may only read, and says which scope is missing', async () => {
    const res = await handleMcpPost(
      post(write),
      user,
      ['recipes:read'],
      SELF,
      fakeRate().deps,
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toContain('insufficient_scope');
    expect(res.headers.get('www-authenticate')).toContain('recipes:write');
  });

  it('names the request in the refusal, and uses no code from the legacy range', async () => {
    const { status, json } = await send(write, {}, ['recipes:read']);
    expect(status).toBe(403);
    expect(json).toEqual({
      jsonrpc: '2.0',
      id: 'w1',
      error: { code: -32600, message: 'Requires the recipes:write scope' },
    });
  });

  it('refuses a whole batch if any message in it needs a scope the token lacks, naming no id', async () => {
    const { status, json } = await send(
      [{ jsonrpc: '2.0', id: 2, method: 'ping' }, write],
      {},
      ['recipes:read'],
    );
    expect(status).toBe(403);
    expect(json?.id).toBeNull();
  });

  it('treats a token with no scopes as able to do nothing', async () => {
    expect((await send(write, {}, [])).status).toBe(403);
  });

  it('tells a read-only token that a tool does not exist, rather than that it lacks a scope for it', async () => {
    const { status, json } = await send(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'ghost' },
      },
      {},
      ['recipes:read'],
    );
    expect(status).toBe(200);
    expect(json).toMatchObject({ id: 3, error: { code: -32602 } });
  });
});

describe('handleMcpPost — malformed bodies', () => {
  const invalid = async (body: unknown) => {
    const { status, json } = await send(body);
    return { status, code: json?.error?.code, id: json?.id };
  };

  it('answers JSON that is not an object with Invalid Request, not a crash', async () => {
    for (const body of [[null], 7, 'ping', [[]], null, false, 0, '', true]) {
      expect(await invalid(body)).toEqual({
        status: 400,
        code: -32600,
        id: null,
      });
    }
  });

  it('answers text that is not JSON with Parse error', async () => {
    for (const text of ['{nope', '', 'undefined']) {
      const res = await handleMcpPost(
        postText(text),
        user,
        ALL_SCOPES,
        SELF,
        fakeRate().deps,
      );
      expect(res.status).toBe(400);
      expect(((await res.json()) as Reply).error?.code).toBe(-32700);
    }
  });

  it('refuses an empty batch and an oversized one', async () => {
    expect(await invalid([])).toMatchObject({ status: 400, code: -32600 });
    const many = Array.from({ length: 21 }, () => ({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping',
    }));
    expect(await invalid(many)).toMatchObject({ status: 400, code: -32600 });
  });

  it('still answers a batch within the limit', async () => {
    const { status, json } = await send([
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
    ]);
    expect(status).toBe(200);
    expect(json).toHaveLength(2);
  });

  it('gives any notification an empty 202, not an error', async () => {
    const res = await handleMcpPost(
      post({ jsonrpc: '2.0', method: 'notifications/cancelled' }),
      user,
      ALL_SCOPES,
      SELF,
      fakeRate().deps,
    );
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  it.each([
    ['no jsonrpc member', { id: 4, method: 'ping' }, 4],
    ['jsonrpc 1.0', { jsonrpc: '1.0', id: 4, method: 'ping' }, 4],
    ['a method that is not text', { jsonrpc: '2.0', id: 4, method: 9 }, 4],
    ['a null id', { jsonrpc: '2.0', id: null, method: 'ping' }, null],
    ['an object id', { jsonrpc: '2.0', id: { a: 1 }, method: 'ping' }, null],
    ['a boolean id', { jsonrpc: '2.0', id: true, method: 'ping' }, null],
    ['a fractional id', { jsonrpc: '2.0', id: 1.5, method: 'ping' }, null],
  ])(
    'refuses a message with %s as an invalid request',
    async (_name, body, id) => {
      expect(await invalid(body)).toEqual({ status: 400, code: -32600, id });
    },
  );

  it('refuses params that are not an object as invalid params, naming the request', async () => {
    const { status, json } = await send({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/list',
      params: [1],
    });
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: 5, error: { code: -32602 } });
  });

  it('accepts string and integer ids, including zero and the empty string', async () => {
    for (const id of ['abc', '', 0, -3, 2 ** 40]) {
      const { status, json } = await send({
        jsonrpc: '2.0',
        id,
        method: 'ping',
      });
      expect(status).toBe(200);
      expect(json?.id).toBe(id);
    }
  });

  it('does not run a request method sent without an id', async () => {
    const rate = fakeRate();
    const { status, json } = await send(
      { jsonrpc: '2.0', method: 'tools/list' },
      {},
      ALL_SCOPES,
      rate.deps,
    );
    expect(status).toBe(400);
    expect(json?.error?.code).toBe(-32600);
    expect(json?.result).toBeUndefined();
    // Refused unread, so only the general allowance is charged, once.
    expect(rate.keys()).toEqual(['mcp-request:1']);
  });

  it('gives a reply to something a server asked an empty 202, and runs nothing', async () => {
    for (const body of [
      { jsonrpc: '2.0', id: 3, result: {} },
      { jsonrpc: '2.0', id: 3, error: { code: -1, message: 'no' } },
      [{ jsonrpc: '2.0', id: 3, result: {} }],
    ]) {
      const res = await handleMcpPost(
        post(body),
        user,
        ALL_SCOPES,
        SELF,
        fakeRate().deps,
      );
      expect(res.status).toBe(202);
      expect(await res.text()).toBe('');
    }
  });

  it('refuses a reply from a client that speaks the newest revision, which must not send them', async () => {
    const { status, json } = await send(
      { jsonrpc: '2.0', id: 3, result: {} },
      { 'mcp-protocol-version': '2026-07-28' },
    );
    expect(status).toBe(400);
    expect(json?.error?.code).toBe(-32600);
  });

  it('answers the requests in a batch that also holds replies, and skips the replies', async () => {
    const { status, json } = await send([
      { jsonrpc: '2.0', id: 3, result: {} },
      { jsonrpc: '2.0', id: 4, method: 'ping' },
    ]);
    expect(status).toBe(200);
    expect(json).toEqual([{ jsonrpc: '2.0', id: 4, result: {} }]);
  });

  it('gives a batch of only notifications an empty 202', async () => {
    const res = await handleMcpPost(
      post([{ jsonrpc: '2.0', method: 'notifications/initialized' }]),
      user,
      ALL_SCOPES,
      SELF,
      fakeRate().deps,
    );
    expect(res.status).toBe(202);
  });
});

describe('handleMcpPost — request size', () => {
  it('refuses a body that announces itself as over the limit, before parsing it', async () => {
    const res = await handleMcpPost(
      postText('{}', { 'content-length': String(MAX_BODY_BYTES + 1) }),
      user,
      ALL_SCOPES,
      SELF,
      fakeRate().deps,
    );
    expect(res.status).toBe(413);
    expect(((await res.json()) as Reply).error?.code).toBe(-32600);
  });

  it('refuses a body with no announced length that turns out to be over the limit', async () => {
    const padding = 'x'.repeat(MAX_BODY_BYTES);
    const { status, json } = await send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'import_recipe', arguments: { content: padding } },
    });
    expect(status).toBe(413);
    expect(json?.error?.message).toMatch(/too large/);
  });

  it('accepts a sizeable body within the limit', async () => {
    const content = 'x'.repeat(200_000);
    const { status } = await send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'ghost', arguments: { content } },
    });
    expect(status).toBe(200);
  });

  it('charges a body it refused once against the general allowance only', async () => {
    const rate = fakeRate();
    await send(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        pad: 'x'.repeat(MAX_BODY_BYTES),
      },
      {},
      ALL_SCOPES,
      rate.deps,
    );
    expect(rate.keys()).toEqual(['mcp-request:1']);
  });
});

describe('handleMcpPost — protocol checks', () => {
  it('answers server/discover for a newest-era client', async () => {
    const { status, json } = await send(
      modern('server/discover'),
      modernHeaders('server/discover'),
    );
    expect(status).toBe(200);
    expect(json?.result?.['resultType']).toBe('complete');
    expect(json?.result?.['supportedVersions']).toContain('2026-07-28');
    expect(json?.result?.['supportedVersions']).toContain('2025-11-25');
    expect(json?.result?.['capabilities']).toMatchObject({
      extensions: { 'io.modelcontextprotocol/ui': {} },
    });
  });

  it('refuses a newest-era request whose headers disagree with its body, naming the request', async () => {
    const { status, json } = await send(
      modern('tools/list'),
      modernHeaders('ping'),
    );
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: 1, error: { code: -32020 } });
  });

  it('refuses a version we do not speak with the versions we do, naming the request', async () => {
    const { status, json } = await send(
      { jsonrpc: '2.0', id: 'v1', method: 'ping' },
      { 'mcp-protocol-version': '1999-01-01' },
    );
    expect(status).toBe(400);
    expect(json?.id).toBe('v1');
    expect(json?.error?.code).toBe(-32022);
    expect(json?.error?.data?.['supported']).toContain('2026-07-28');
    expect(json?.error?.data?.['requested']).toBe('1999-01-01');
  });

  it('refuses a Mcp-Name that is not the tool called, naming the request', async () => {
    const { status, json } = await send(
      modern('tools/call', { name: 'list_recipes' }),
      modernHeaders('tools/call', 'other'),
    );
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: 1, error: { code: -32020 } });
  });

  it('refuses a newest-era request that has no client capabilities, with 400 and invalid params', async () => {
    const { status, json } = await send(
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/list',
        params: { _meta: { [META]: '2026-07-28' } },
      },
      modernHeaders('tools/list'),
    );
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: 6, error: { code: -32602 } });
  });

  it('refuses a version that is not text', async () => {
    const { status, json } = await send(
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/list',
        params: { _meta: { [META]: 20260728, [CAPS]: {} } },
      },
      modernHeaders('tools/list'),
    );
    expect(status).toBe(400);
    expect(json?.error?.code).toBe(-32602);
  });

  it('refuses the newest-era header on a request that has no metadata to match it', async () => {
    const { status, json } = await send(
      { jsonrpc: '2.0', id: 7, method: 'tools/list' },
      modernHeaders('tools/list'),
    );
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: 7, error: { code: -32602 } });
  });

  it('does not take an older version named in the metadata for the newest era', async () => {
    const { status, json } = await send(
      {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/list',
        params: { _meta: { [META]: '2025-11-25', [CAPS]: {} } },
      },
      { 'mcp-protocol-version': '2025-11-25' },
    );
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: 8, error: { code: -32022 } });
  });

  it('serves an older client that sends no protocol headers at all', async () => {
    const { status, json } = await send({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/list',
    });
    expect(status).toBe(200);
    expect(json?.result).not.toHaveProperty('resultType');
    expect(json?.result).not.toHaveProperty('ttlMs');
  });

  it('answers an unknown method with 404 to a newest-era client, 200 to an older one', async () => {
    const newest = await send(modern('nope/nope'), modernHeaders('nope/nope'));
    expect(newest.status).toBe(404);
    expect(newest.json).toMatchObject({ id: 1, error: { code: -32601 } });
    const older = await send({ jsonrpc: '2.0', id: 1, method: 'nope/nope' });
    expect(older.status).toBe(200);
    expect(older.json?.error?.code).toBe(-32601);
  });

  it('negotiates an older client’s version in the initialize handshake', async () => {
    const { json } = await send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {} },
    });
    expect(json?.result).toMatchObject({
      protocolVersion: '2025-06-18',
      serverInfo: SERVER_INFO,
      capabilities: { extensions: { 'io.modelcontextprotocol/ui': {} } },
    });
  });

  it('adds resultType to a newest-era result and leaves an older one alone', async () => {
    const newest = await send(
      modern('tools/list'),
      modernHeaders('tools/list'),
    );
    expect(newest.json?.result?.['resultType']).toBe('complete');
    const older = await send({ jsonrpc: '2.0', id: 2, method: 'ping' });
    expect(older.json?.result).not.toHaveProperty('resultType');
  });

  it.each([
    ['tools/list', undefined, 'public'],
    ['resources/list', undefined, 'private'],
    ['resources/read', { uri: 'ui://recipe/card.html' }, 'public'],
  ])(
    'sends cache hints and the server’s identity with %s to a newest-era client (shared only when nothing in it is the person’s own)',
    async (method, params, scope) => {
      const { json } = await send(
        modern(method, params),
        modernHeaders(method, params?.uri),
      );
      expect(json?.result).toMatchObject({
        ttlMs: expect.any(Number),
        cacheScope: scope,
        resultType: 'complete',
        _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO },
      });
    },
  );

  it('refuses a request for a tool that is not advertised, with invalid params and the request id, without running anything', async () => {
    const { status, json } = await send(
      modern('tools/call', { name: 'ghost' }),
      modernHeaders('tools/call', 'ghost'),
    );
    expect(status).toBe(200);
    expect(json).toMatchObject({
      id: 1,
      error: { code: -32602, message: expect.stringContaining('ghost') },
    });
  });

  it('answers a view that is not there with invalid params and the address', async () => {
    const { json } = await send(
      modern('resources/read', { uri: 'ui://nope' }),
      modernHeaders('resources/read', 'ui://nope'),
    );
    expect(json?.error).toEqual({
      code: -32602,
      message: 'Resource not found',
      data: { uri: 'ui://nope' },
    });
  });

  it('answers a view address that is not text with invalid params', async () => {
    const { json } = await send(
      modern('resources/read', { uri: 7 }),
      modernHeaders('resources/read'),
    );
    expect(json?.error?.code).toBe(-32602);
  });

  it('answers an internal fault with -32603 and nothing about the cause', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // The tool needs Drive or a database, neither of which exists in a test.
    const { json } = await send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'list_recipes', arguments: {} },
    });
    spy.mockRestore();
    if (json?.error) {
      expect(json.error.code).toBe(-32603);
      expect(json.error.message).toBe('Something went wrong on the server.');
    } else {
      // A tool that reports its own failure as a result is also acceptable.
      expect(json?.result).toBeDefined();
    }
  });
});

describe('handleMcpPost — batches', () => {
  const legacy = (id: number) => ({ jsonrpc: '2.0', id, method: 'ping' });

  it('serves a batch to older clients and answers each request in it', async () => {
    const { status, json } = await send([legacy(1), legacy(2)], {
      'mcp-protocol-version': '2025-03-26',
    });
    expect(status).toBe(200);
    expect(json).toEqual([
      { jsonrpc: '2.0', id: 1, result: {} },
      { jsonrpc: '2.0', id: 2, result: {} },
    ]);
  });

  it('refuses a batch that says it is the newest revision in its header', async () => {
    const { status, json } = await send([legacy(1)], {
      'mcp-protocol-version': '2026-07-28',
    });
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: null, error: { code: -32600 } });
  });

  it('refuses a batch holding a newest-era message', async () => {
    const { status, json } = await send([legacy(1), modern('ping')]);
    expect(status).toBe(400);
    expect(json).toMatchObject({ id: null, error: { code: -32600 } });
  });

  it('names no request in the refusal of a batch', async () => {
    const { json } = await send([legacy(1), { jsonrpc: '2.0', id: 2 }]);
    expect(json?.id).toBeNull();
  });
});

describe('handleMcpPost — rate limiting', () => {
  const call = (id: number) => ({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: 'ghost' },
  });

  it('answers a user over their tool-call allowance with 429, Retry-After and a JSON-RPC error', async () => {
    const rate = fakeRate();
    for (let i = 0; i < 120; i++) {
      expect((await send(call(i), {}, ALL_SCOPES, rate.deps)).status).toBe(200);
    }
    const { status, headers, json } = await send(
      call(121),
      {},
      ALL_SCOPES,
      rate.deps,
    );
    expect(status).toBe(429);
    expect(headers.get('retry-after')).toBe('60');
    expect(json).toMatchObject({
      id: 121,
      error: {
        code: -32603,
        data: { retryAfterSeconds: 60 },
      },
    });
    expect(json?.error?.message).toMatch(/Rate limit/);
  });

  it('exposes Retry-After to browsers', async () => {
    const rate = fakeRate();
    for (let i = 0; i < 120; i++) {
      await send(call(i), {}, ALL_SCOPES, rate.deps);
    }
    const { headers } = await send(call(0), {}, ALL_SCOPES, rate.deps);
    expect(headers.get('access-control-expose-headers')).toContain(
      'Retry-After',
    );
  });

  it('keeps listing and the handshake available to a user who has used up their calls', async () => {
    const rate = fakeRate();
    for (let i = 0; i < 121; i++) {
      await send(call(i), {}, ALL_SCOPES, rate.deps);
    }
    for (const method of ['tools/list', 'resources/list', 'ping']) {
      const { status } = await send(
        { jsonrpc: '2.0', id: 1, method },
        {},
        ALL_SCOPES,
        rate.deps,
      );
      expect(status).toBe(200);
    }
  });

  it('counts each user on their own', async () => {
    const rate = fakeRate();
    for (let i = 0; i < 121; i++) {
      await send(call(i), {}, ALL_SCOPES, rate.deps);
    }
    const res = await handleMcpPost(
      post(call(1)),
      { id: 2 } as User,
      ALL_SCOPES,
      SELF,
      rate.deps,
    );
    expect(res.status).toBe(200);
    expect(rate.keys()).toEqual(['mcp-tool-call:1', 'mcp-tool-call:2']);
  });

  it('does not count a call that was refused for its scope', async () => {
    const rate = fakeRate();
    await send(
      { ...call(1), params: { name: 'set_measurement_system' } },
      {},
      ['recipes:read'],
      rate.deps,
    );
    expect(rate.keys()).toEqual([]);
  });

  it('counts every call in a batch', async () => {
    const rate = fakeRate();
    const { status } = await send(
      Array.from({ length: 20 }, (_, i) => call(i)),
      {},
      ALL_SCOPES,
      rate.deps,
    );
    expect(status).toBe(200);
    const again = await send(
      Array.from({ length: 20 }, (_, i) => call(i)),
      {},
      ALL_SCOPES,
      rate.deps,
    );
    expect(again.status).toBe(200);
    // 120 in six batches of twenty; the seventh goes over.
    for (let i = 0; i < 4; i++) {
      await send(
        Array.from({ length: 20 }, (_, j) => call(j)),
        {},
        ALL_SCOPES,
        rate.deps,
      );
    }
    const over = await send([call(1)], {}, ALL_SCOPES, rate.deps);
    expect(over.status).toBe(429);
    expect(over.json?.id).toBeNull();
  });

  it('sweeps idle counters on about one request in a hundred', async () => {
    const swept = fakeRate({ random: () => 0.001 });
    await send(call(1), {}, ALL_SCOPES, swept.deps);
    expect(swept.purged).toEqual([5000 - 3600]);
    const quiet = fakeRate({ random: () => 0.5 });
    await send(call(1), {}, ALL_SCOPES, quiet.deps);
    expect(quiet.purged).toEqual([]);
  });

  it('lets the request through when the counters cannot be reached', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken = fakeRate({
      store: () => {
        throw new Error('no database');
      },
    });
    expect((await send(call(1), {}, ALL_SCOPES, broken.deps)).status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('unauthorizedResponse', () => {
  it('starts the sign-in flow when there was no token', async () => {
    const res = unauthorizedResponse(SELF, false, {});
    expect(res.status).toBe(401);
    const challenge = res.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain(
      `resource_metadata="${SELF}/.well-known/oauth-protected-resource/mcp"`,
    );
    expect(challenge).not.toContain('invalid_token');
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Authorization required' },
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

describe('handleMcpPost — junk bodies and the rate limit', () => {
  const junk = (rate: RateLimitDeps) =>
    handleMcpPost(postText('{nope'), user, ALL_SCOPES, SELF, rate);

  it('answers a caller who keeps sending unparseable bodies with a 429 once they pass the general allowance', async () => {
    const rate = fakeRate();
    const statuses = await Array.from({ length: 601 }).reduce<
      Promise<readonly number[]>
    >(
      async (done) => [...(await done), (await junk(rate.deps)).status],
      Promise.resolve([]),
    );
    expect(statuses.slice(0, 600).every((status) => status === 400)).toBe(true);
    expect(statuses[600]).toBe(429);
    expect(rate.keys()).toEqual(['mcp-request:1']);
  });

  it('tells such a caller how long to wait', async () => {
    const rate = fakeRate();
    await Array.from({ length: 600 }).reduce<Promise<unknown>>(async (done) => {
      await done;
      return junk(rate.deps);
    }, Promise.resolve());
    const res = await junk(rate.deps);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(((await res.json()) as Reply).error?.code).toBe(-32603);
  });

  it.each([
    ['not JSON', () => postText('{nope')],
    ['not a message', () => post(7)],
    ['an empty batch', () => post([])],
    [
      'a batch of 21',
      () =>
        post(
          Array.from({ length: 21 }, () => ({
            jsonrpc: '2.0',
            id: 1,
            method: 'ping',
          })),
        ),
    ],
    [
      'a body over the limit',
      () => postText('{}', { 'content-length': String(MAX_BODY_BYTES + 1) }),
    ],
  ])('charges %s once against the general allowance', async (_name, make) => {
    const rate = fakeRate();
    const res = await handleMcpPost(make(), user, ALL_SCOPES, SELF, rate.deps);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(rate.keys()).toEqual(['mcp-request:1']);
  });

  it('does not charge a well-formed message that was refused for its headers', async () => {
    const rate = fakeRate();
    const { status } = await send(
      modern('tools/list'),
      { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'wrong' },
      ALL_SCOPES,
      rate.deps,
    );
    expect(status).toBe(400);
    expect(rate.keys()).toEqual([]);
  });
});

describe('every reply from the endpoint', () => {
  /** One request per kind of answer the endpoint gives. */
  const answers: readonly [
    string,
    number,
    () => Promise<{ readonly headers: Headers }>,
  ][] = [
    ['a result', 200, () => send({ jsonrpc: '2.0', id: 1, method: 'ping' })],
    [
      'a notification',
      202,
      () => send({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    ],
    ['a parse error', 400, () => send(7)],
    [
      'a scope refusal',
      403,
      () =>
        send(
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'set_measurement_system' },
          },
          {},
          ['recipes:read'],
        ),
    ],
    [
      'an unknown method',
      404,
      () =>
        send(modern('nope/nothing'), {
          'mcp-protocol-version': '2026-07-28',
          'mcp-method': 'nope/nothing',
        }),
    ],
    [
      'an oversized body',
      413,
      () =>
        handleMcpPost(
          postText('{}', { 'content-length': String(MAX_BODY_BYTES + 1) }),
          user,
          ALL_SCOPES,
          SELF,
          fakeRate().deps,
        ),
    ],
    [
      'a rate limit',
      429,
      async () => {
        const rate = fakeRate();
        await Array.from({ length: 120 }).reduce<Promise<unknown>>(
          async (done, _, i) => {
            await done;
            return send(
              {
                jsonrpc: '2.0',
                id: i,
                method: 'tools/call',
                params: { name: 'ghost' },
              },
              {},
              ALL_SCOPES,
              rate.deps,
            );
          },
          Promise.resolve(),
        );
        return send(
          {
            jsonrpc: '2.0',
            id: 0,
            method: 'tools/call',
            params: { name: 'ghost' },
          },
          {},
          ALL_SCOPES,
          rate.deps,
        );
      },
    ],
  ];

  it.each(answers)(
    'is marked no-store: %s (%i)',
    async (_name, status, make) => {
      const res = await make();
      expect('status' in res ? res.status : undefined).toBe(status);
      expect(res.headers.get('cache-control')).toBe('no-store');
    },
  );
});

describe('respondToMcp', () => {
  const GOOD: McpAuth = { kind: 'ok', user, scope: ALL_SCOPES };

  /** An authenticate that answers `auth` and remembers it was asked. */
  function authenticating(auth: McpAuth | Error) {
    const asked = jest.fn<Authenticate>(async () => {
      if (auth instanceof Error) {
        throw auth;
      }
      return auth;
    });
    return asked;
  }

  const ask = (
    method: string,
    asked: jest.Mock<Authenticate>,
    headers: Record<string, string> = {},
    body?: string,
  ) =>
    respondToMcp(
      new Request(`${SELF}/mcp`, { method, headers, body }),
      SELF,
      asked,
      fakeRate().deps,
    );

  const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });

  describe.each(['POST', 'GET', 'DELETE'])('%s', (method) => {
    const body = method === 'POST' ? ping : undefined;

    it('starts the sign-in flow when there is no token', async () => {
      const res = await ask(
        method,
        authenticating({ kind: 'no-token' }),
        {},
        body,
      );
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).not.toContain(
        'invalid_token',
      );
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('says so when the token is not valid', async () => {
      const res = await ask(
        method,
        authenticating({ kind: 'invalid-token' }),
        { origin: 'https://claude.ai' },
        body,
      );
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain(
        'error="invalid_token"',
      );
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://claude.ai',
      );
    });

    it('turns an unknown origin away before it looks at the token', async () => {
      const asked = authenticating(GOOD);
      const res = await ask(
        method,
        asked,
        { origin: 'https://evil.example' },
        body,
      );
      expect(res.status).toBe(403);
      expect(res.headers.get('www-authenticate')).toBeNull();
      expect(asked).not.toHaveBeenCalled();
    });

    it('does not let an authentication fault escape as a bare 500', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await ask(
        method,
        authenticating(new Error('D1 exploded: secret detail')),
        { origin: 'https://claude.ai' },
        body,
      );
      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('5');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://claude.ai',
      );
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Something went wrong on the server.' },
      });
      expect(text).not.toContain('secret detail');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it.each(['GET', 'DELETE'])(
    'answers a signed-in %s with 405 and what is allowed',
    async (method) => {
      const res = await ask(method, authenticating(GOOD), {
        origin: 'https://claude.ai',
      });
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST, OPTIONS');
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://claude.ai',
      );
      expect(res.headers.get('cache-control')).toBe('no-store');
    },
  );

  it('hands a signed-in POST to the handler with the user and the scopes of the token', async () => {
    const readOnly: McpAuth = { kind: 'ok', user, scope: ['recipes:read'] };
    const call = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'set_measurement_system' },
    });
    const res = await ask('POST', authenticating(readOnly), {}, call);
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toContain(
      'scope="recipes:write"',
    );
    const ok = await ask('POST', authenticating(GOOD), {}, ping);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ id: 1, result: {} });
  });

  it('asks to authenticate the request it was given, for this origin', async () => {
    const asked = authenticating(GOOD);
    await ask('POST', asked, {}, ping);
    expect(asked).toHaveBeenCalledTimes(1);
    const [request, origin] = asked.mock.calls[0] ?? [];
    expect(request?.method).toBe('POST');
    expect(origin).toBe(SELF);
  });

  describe('the CORS preflight', () => {
    it('answers an allowed origin with 204, echoing the origin and the headers it asks for, and never looks at a token', async () => {
      const asked = authenticating({ kind: 'no-token' });
      const res = await ask('OPTIONS', asked, {
        origin: 'https://claude.ai',
        'access-control-request-headers': 'authorization, mcp-method',
      });
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://claude.ai',
      );
      expect(res.headers.get('access-control-allow-headers')).toBe(
        'authorization, mcp-method',
      );
      expect(res.headers.get('allow')).toBe('POST, OPTIONS');
      expect(asked).not.toHaveBeenCalled();
    });

    it('refuses an origin that is not allowed', async () => {
      const res = await ask('OPTIONS', authenticating(GOOD), {
        origin: 'https://evil.example',
      });
      expect(res.status).toBe(403);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});
