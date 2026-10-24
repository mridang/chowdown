import { describe, expect, it, jest } from '@jest/globals';

import type { User } from '@/lib/db/users';
import {
  MAX_BODY_BYTES,
  MCP_RATE_LIMITS,
  PURGE_IDLE_SECONDS,
  PURGE_PROBABILITY,
  chargeRefusedBody,
  checkRateLimits,
  readJsonBody,
  type RateLimitDeps,
} from '@/lib/mcp/request-limits';
import type { RateLimitStore } from '@/lib/util/rate-limit';

const URL = 'https://chowdown.test/mcp';

/** A request whose body is `body`, with extra headers. */
const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request(URL, { method: 'POST', headers, body });

/** A request whose body arrives in the given pieces (so it has no Content-Length). */
const streamed = (pieces: readonly Uint8Array[]) =>
  new Request(URL, {
    method: 'POST',
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        pieces.forEach((piece) => controller.enqueue(piece));
        controller.close();
      },
    }),
    // Required by fetch when the body is a stream.
    duplex: 'half',
  } as RequestInit);

const encode = (text: string) => new TextEncoder().encode(text);

describe('readJsonBody', () => {
  it('reads a JSON body of any shape', async () => {
    expect(await readJsonBody(post('{"a":1}'))).toEqual({
      kind: 'ok',
      value: { a: 1 },
    });
    expect(await readJsonBody(post('[1,2]'))).toEqual({
      kind: 'ok',
      value: [1, 2],
    });
    expect(await readJsonBody(post('0'))).toEqual({ kind: 'ok', value: 0 });
    expect(await readJsonBody(post('null'))).toEqual({
      kind: 'ok',
      value: null,
    });
  });

  it('reads a body that arrives in pieces, even when a character is split between two', async () => {
    const bytes = encode('{"name":"crème brûlée"}');
    const result = await readJsonBody(
      streamed([bytes.slice(0, 11), bytes.slice(11)]),
    );
    expect(result).toEqual({ kind: 'ok', value: { name: 'crème brûlée' } });
  });

  it.each([
    ['text that is not JSON', encode('{nope')],
    ['an empty body', encode('')],
    ['bytes that are not UTF-8', Uint8Array.of(0x7b, 0x22, 0xff, 0x22, 0x7d)],
    ['a character cut off at the end', Uint8Array.of(0x22, 0xe2, 0x82)],
  ])('calls %s unparseable', async (_name, bytes) => {
    expect(await readJsonBody(streamed([bytes]))).toEqual({
      kind: 'unparseable',
    });
  });

  it('treats a request with no body at all as unparseable', async () => {
    expect(await readJsonBody(post(null))).toEqual({ kind: 'unparseable' });
  });

  it('refuses, without reading, a body that announces itself as too large', async () => {
    const request = post('{}', {
      'content-length': String(MAX_BODY_BYTES + 1),
    });
    expect(await readJsonBody(request)).toEqual({ kind: 'too-large' });
    expect(request.bodyUsed).toBe(false);
  });

  it('stops reading a body with no declared length once it passes the limit', async () => {
    const result = await readJsonBody(post('x'.repeat(MAX_BODY_BYTES + 1)));
    expect(result).toEqual({ kind: 'too-large' });
  });

  it('accepts a body of exactly the limit', async () => {
    const padding = 'x'.repeat(MAX_BODY_BYTES - 2);
    expect(await readJsonBody(post(`"${padding}"`))).toMatchObject({
      kind: 'ok',
    });
  });

  it('turns away a body dribbled in as thousands of tiny pieces', async () => {
    const pieces = Array.from({ length: 5000 }, () => encode(' '));
    expect(await readJsonBody(streamed(pieces))).toEqual({
      kind: 'too-large',
    });
  });
});

/** A fake set of counters: fixed windows held in a map. */
function memoryStore() {
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
  return { store, counters, purged };
}

const deps = (
  store: RateLimitStore,
  over: Partial<RateLimitDeps> = {},
): RateLimitDeps => ({
  store: () => store,
  now: () => 1000,
  random: () => 0.5,
  ...over,
});

const someone = { id: 7 } as User;
const call = { jsonrpc: '2.0' as const, id: 1, method: 'tools/call' };
const list = { jsonrpc: '2.0' as const, id: 1, method: 'tools/list' };
const note = { jsonrpc: '2.0' as const, method: 'notifications/initialized' };

describe('the rate limits', () => {
  it('give tool calls a tighter budget than everything else, and say so in one place', () => {
    expect(MCP_RATE_LIMITS.toolCall).toEqual({
      name: 'mcp-tool-call',
      limit: 120,
      windowSeconds: 60,
    });
    expect(MCP_RATE_LIMITS.request).toEqual({
      name: 'mcp-request',
      limit: 600,
      windowSeconds: 60,
    });
    expect(MCP_RATE_LIMITS.request.limit).toBeGreaterThan(
      MCP_RATE_LIMITS.toolCall.limit,
    );
  });
});

describe('checkRateLimits', () => {
  it('lets a user make their allowance of tool calls and refuses the next', async () => {
    const { store } = memoryStore();
    const outcomes = await Promise.all(
      Array.from({ length: 121 }, () =>
        checkRateLimits(someone, [call], deps(store)),
      ),
    );
    expect(outcomes.slice(0, 120).every((o) => o === null)).toBe(true);
    expect(outcomes[120]).toMatchObject({
      status: 429,
      headers: { 'Retry-After': '60' },
      body: {
        error: {
          code: -32603,
          data: { retryAfterSeconds: 60, limit: 120, windowSeconds: 60 },
        },
      },
    });
  });

  it('names the request it refuses, when there was just the one', async () => {
    const { store } = memoryStore();
    await Promise.all(
      Array.from({ length: 120 }, () =>
        checkRateLimits(someone, [call], deps(store)),
      ),
    );
    const one = await checkRateLimits(
      someone,
      [{ ...call, id: 'abc' }],
      deps(store),
    );
    expect(one?.body.id).toBe('abc');
    const many = await checkRateLimits(someone, [call, call], deps(store));
    expect(many?.body.id).toBeNull();
  });

  it('counts the rest separately, so listing is not starved by calling', async () => {
    const { store, counters } = memoryStore();
    await Promise.all(
      Array.from({ length: 121 }, () =>
        checkRateLimits(someone, [call], deps(store)),
      ),
    );
    expect(await checkRateLimits(someone, [list], deps(store))).toBeNull();
    expect([...counters.keys()].toSorted()).toEqual([
      'mcp-request:7',
      'mcp-tool-call:7',
    ]);
  });

  it('counts each user on their own', async () => {
    const { store } = memoryStore();
    await Promise.all(
      Array.from({ length: 121 }, () =>
        checkRateLimits(someone, [call], deps(store)),
      ),
    );
    expect(
      await checkRateLimits({ id: 8 } as User, [call], deps(store)),
    ).toBeNull();
  });

  it('tells the user how long is left in the window', async () => {
    const { store } = memoryStore();
    await Promise.all(
      Array.from({ length: 120 }, () =>
        checkRateLimits(someone, [call], deps(store)),
      ),
    );
    const refusal = await checkRateLimits(
      someone,
      [call],
      deps(store, { now: () => 1045 }),
    );
    expect(refusal?.headers).toEqual({ 'Retry-After': '15' });
    expect(refusal?.body.error.message).toContain('15 seconds');
  });

  it('counts every message in a batch', async () => {
    const { store, counters } = memoryStore();
    await checkRateLimits(someone, [call, call, list], deps(store));
    expect(counters.get('mcp-tool-call:7')?.count).toBe(2);
    expect(counters.get('mcp-request:7')?.count).toBe(1);
  });

  it('does not count notifications, and touches no counters for them', async () => {
    const { store, counters } = memoryStore();
    expect(await checkRateLimits(someone, [note], deps(store))).toBeNull();
    expect(counters.size).toBe(0);
  });

  it('sweeps idle counters on about one request in a hundred', async () => {
    const { store, purged } = memoryStore();
    await checkRateLimits(
      someone,
      [list],
      deps(store, { random: () => PURGE_PROBABILITY / 2 }),
    );
    expect(purged).toEqual([1000 - PURGE_IDLE_SECONDS]);
    await checkRateLimits(
      someone,
      [list],
      deps(store, { random: () => PURGE_PROBABILITY }),
    );
    expect(purged).toHaveLength(1);
  });

  it('lets the request through, and says so in the logs, when the counters cannot be reached', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken: RateLimitStore = {
      hit: async () => {
        throw new Error('D1 is down');
      },
      purge: async () => undefined,
    };
    expect(await checkRateLimits(someone, [call], deps(broken))).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('chargeRefusedBody', () => {
  it('counts a body that could not be read against the general allowance, never the tool-call one', async () => {
    const { store, counters } = memoryStore();
    expect(await chargeRefusedBody(someone, deps(store))).toBeNull();
    expect([...counters.keys()]).toEqual(['mcp-request:7']);
  });

  it('refuses with a 429 and Retry-After once the junk has used up the allowance', async () => {
    const { store } = memoryStore();
    const outcomes = await Promise.all(
      Array.from({ length: MCP_RATE_LIMITS.request.limit + 1 }, () =>
        chargeRefusedBody(someone, deps(store)),
      ),
    );
    expect(outcomes.slice(0, -1).every((o) => o === null)).toBe(true);
    expect(outcomes.at(-1)).toMatchObject({
      status: 429,
      headers: { 'Retry-After': '60' },
      body: { id: null, error: { code: -32603 } },
    });
  });

  it('counts each user on their own', async () => {
    const { store } = memoryStore();
    await Promise.all(
      Array.from({ length: MCP_RATE_LIMITS.request.limit + 1 }, () =>
        chargeRefusedBody(someone, deps(store)),
      ),
    );
    expect(await chargeRefusedBody({ id: 8 } as User, deps(store))).toBeNull();
  });

  it('lets the request go on being refused as before when the counters cannot be reached', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken: RateLimitStore = {
      hit: async () => {
        throw new Error('D1 is down');
      },
      purge: async () => undefined,
    };
    expect(await chargeRefusedBody(someone, deps(broken))).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
