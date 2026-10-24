import { describe, expect, it, jest } from '@jest/globals';

import { nonceOf } from '@/core/http/csp';
import { genericClass } from '@/core/http/edge-limits';
import { EDGE_LIMITS } from '@/core/http/extras';
import { serve, type ServeApp } from '@/core/http/serve';

/** A cache that keeps responses in memory, keyed by URL. */
function memoryCache(): Cache & { readonly stored: Map<string, Response> } {
  const stored = new Map<string, Response>();
  return {
    stored,
    match: async (request: RequestInfo | URL) => {
      const found = stored.get(
        request instanceof Request ? request.url : String(request),
      );
      return found?.clone();
    },
    put: async (request: RequestInfo | URL, response: Response) => {
      stored.set(
        request instanceof Request ? request.url : String(request),
        response,
      );
    },
  } as unknown as Cache & { readonly stored: Map<string, Response> };
}

const ctx = () => {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    context: {
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext,
  };
};

/** An app that answers every request with the given response factory and remembers what it was sent. */
function appAnswering(make: (request: Request) => Response): ServeApp & {
  readonly seen: Request[];
} {
  const seen: Request[] = [];
  return {
    seen,
    fetch: (request) => {
      seen.push(request);
      return make(request);
    },
  };
}

const page = (body: string, nonce: string) =>
  new Response(`<html><script nonce="${nonce}">${body}</script></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

describe('EDGE_LIMITS', () => {
  const classOf = (method: string, pathname: string) =>
    EDGE_LIMITS.classify(
      new Request(`https://app.test${pathname}`, { method }),
    );

  it.each<[string, string, string | undefined]>([
    ['GET', '/_next/static/chunks/a.js', undefined],
    ['GET', '/icons/icon-192.png', undefined],
    ['GET', '/screenshots/library-wide.png', undefined],
    ['GET', '/recipes/pasta.jpg', undefined],
    ['POST', '/csp/reports', 'reports'],
    ['POST', '/oauth/token', 'token'],
    ['POST', '/oauth/register', 'register'],
    ['GET', '/oauth/authorize', 'auth'],
    ['POST', '/oauth/consent', 'auth'],
    ['POST', '/oauth/revoke', 'auth'],
    ['GET', '/auth/callback', 'auth'],
    ['DELETE', '/api/sessions/self', 'auth'],
    ['POST', '/api/recipes/imports', 'import'],
    ['GET', '/api/recipes/imports', 'api'],
    ['GET', '/api/recipes/suggestions', 'expensive'],
    ['GET', '/img', 'cover'],
    ['GET', '/api/recipes', 'api'],
    ['PUT', '/api/recipes/abc', 'api'],
    ['GET', '/health', 'discovery'],
    ['GET', '/.well-known/oauth-authorization-server', 'discovery'],
    ['GET', '/robots.txt', 'discovery'],
    ['GET', '/', 'site'],
    ['GET', '/app', 'site'],
    ['GET', '/recipe/abc', 'site'],
  ])('puts %s %s in %s', (method, pathname, expected) => {
    expect(classOf(method, pathname)).toBe(expected);
  });

  it('counts an MCP request with a bearer token per token, and one without in the tight anonymous class', () => {
    expect(
      EDGE_LIMITS.classify(
        new Request('https://app.test/mcp', {
          method: 'POST',
          headers: { authorization: 'Bearer x' },
        }),
      ),
    ).toBe('mcp');
    expect(classOf('POST', '/mcp')).toBe('mcpAnonymous');
  });

  it('keeps the classes every app has, and tells a signed-in person by the session cookie', () => {
    expect(genericClass('/')).toBe('site');
    expect(EDGE_LIMITS.sessionCookie).toBe('chowdown_session');
  });

  it.each([
    ['mcp', 'jsonrpc'],
    ['token', 'oauth'],
    ['register', 'oauth'],
    ['import', 'problem'],
    ['api', 'problem'],
    ['auth', 'text'],
  ])('words a refusal in class %s as %s', (name, style) => {
    expect(EDGE_LIMITS.classes[name]?.style).toBe(style);
  });
});

describe('serve — no report-only policy', () => {
  it('sends only the enforced policy, with an HTML page or without', async () => {
    const { context } = ctx();
    const htmlApp = appAnswering(
      () => new Response('x', { headers: { 'content-type': 'text/html' } }),
    );
    const a = await serve(new Request('https://app.test/app'), {}, context, {
      app: htmlApp,
      cache: undefined,
    });
    expect(a.headers.has('content-security-policy')).toBe(true);
    expect(a.headers.has('content-security-policy-report-only')).toBe(false);
  });
});

describe('serve', () => {
  it('refuses a caller over a rate limit before the app is asked', async () => {
    const app = appAnswering(() => new Response('ok'));
    const { context } = ctx();
    const response = await serve(
      new Request('https://app.test/app'),
      { RL_SITE: { limit: async () => ({ success: false }) } },
      context,
      { app, cache: undefined },
    );
    expect(response.status).toBe(429);
    expect(app.seen).toEqual([]);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('passes the policy and its nonce to the app, and puts the policy on an HTML response', async () => {
    const app = appAnswering(
      () =>
        new Response('<p>hi</p>', {
          headers: { 'content-type': 'text/html' },
        }),
    );
    const { context } = ctx();
    const response = await serve(
      new Request('https://app.test/app'),
      {},
      context,
      {
        app,
        cache: undefined,
      },
    );
    const csp = response.headers.get('content-security-policy') ?? '';
    const nonce = nonceOf(csp);
    expect(nonce).toBeDefined();
    expect(app.seen[0]?.headers.get('x-nonce')).toBe(nonce);
    expect(app.seen[0]?.headers.get('content-security-policy')).toBe(csp);
  });

  it('replaces a policy or nonce the caller sent instead of forwarding it', async () => {
    const app = appAnswering(
      () => new Response('x', { headers: { 'content-type': 'text/html' } }),
    );
    const { context } = ctx();
    await serve(
      new Request('https://app.test/app', {
        headers: {
          'x-nonce': 'attacker',
          'content-security-policy': "script-src 'nonce-attacker'",
        },
      }),
      {},
      context,
      { app, cache: undefined },
    );
    expect(app.seen[0]?.headers.get('x-nonce')).not.toBe('attacker');
    expect(app.seen[0]?.headers.get('content-security-policy')).not.toContain(
      'attacker',
    );
  });

  it('leaves a policy the app set itself alone, and adds none to a response that is not HTML', async () => {
    const own = appAnswering(
      () =>
        new Response('x', {
          headers: {
            'content-type': 'text/html',
            'content-security-policy': 'default-src none',
          },
        }),
    );
    const json = appAnswering(() => Response.json({ a: 1 }));
    const { context } = ctx();
    const a = await serve(new Request('https://app.test/app'), {}, context, {
      app: own,
      cache: undefined,
    });
    expect(a.headers.get('content-security-policy')).toBe('default-src none');
    const b = await serve(new Request('https://app.test/api/x'), {}, context, {
      app: json,
      cache: undefined,
    });
    expect(b.headers.get('content-security-policy')).toContain(
      'frame-ancestors',
    );
    expect(b.headers.get('content-security-policy')).not.toContain('nonce-');
  });

  it('gives the approval screen the policy that forbids framing and omits form-action', async () => {
    const app = appAnswering(
      () => new Response('x', { headers: { 'content-type': 'text/html' } }),
    );
    const { context } = ctx();
    const response = await serve(
      new Request('https://app.test/oauth/authorize?x=1'),
      {},
      context,
      { app, cache: undefined },
    );
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('form-action');
  });

  it('stores a public page at the edge and answers the next visitor without the app', async () => {
    const cache = memoryCache();
    let renders = 0;
    const app = appAnswering(() => {
      renders += 1;
      return page('a', 'will-be-replaced');
    });
    const { context, pending } = ctx();
    const first = await serve(new Request('https://app.test/'), {}, context, {
      app,
      cache,
    });
    await Promise.all(pending);
    const second = await serve(new Request('https://app.test/'), {}, context, {
      app,
      cache,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(renders).toBe(1);
    expect(await second.text()).toContain('<script');
  });

  it('gives every visit to a cached page a nonce of its own, in the scripts and in the policy', async () => {
    const cache = memoryCache();
    const app = appAnswering((request) =>
      page('a', request.headers.get('x-nonce') ?? 'none'),
    );
    const { context, pending } = ctx();
    const first = await serve(new Request('https://app.test/'), {}, context, {
      app,
      cache,
    });
    await Promise.all(pending);
    const second = await serve(new Request('https://app.test/'), {}, context, {
      app,
      cache,
    });
    const third = await serve(new Request('https://app.test/'), {}, context, {
      app,
      cache,
    });
    const nonces = [first, second, third].map((r) =>
      nonceOf(r.headers.get('content-security-policy') ?? ''),
    );
    expect(new Set(nonces).size).toBe(3);
    for (const response of [second, third]) {
      const nonce = nonceOf(
        response.headers.get('content-security-policy') ?? '',
      );
      expect(await response.text()).toContain(`nonce="${nonce}"`);
    }
  });

  it.each([
    ['a page with a session cookie', { cookie: 'chowdown_session=abc' }, '/'],
    [
      'a page asked for with a bearer token',
      { authorization: 'Bearer x' },
      '/',
    ],
    ['a page with a query string', {}, '/?x=1'],
    ['a page that is not public', {}, '/app'],
  ])('does not store %s', async (_label, headers, url) => {
    const cache = memoryCache();
    const app = appAnswering(() => page('a', 'n'));
    const { context, pending } = ctx();
    await serve(
      new Request(`https://app.test${url}`, { headers }),
      {},
      context,
      { app, cache },
    );
    await Promise.all(pending);
    expect(cache.stored.size).toBe(0);
  });

  it('does not store a response that sets a cookie or is not a success', async () => {
    for (const make of [
      () =>
        new Response('x', {
          headers: { 'content-type': 'text/html', 'set-cookie': 'a=b' },
        }),
      () =>
        new Response('x', {
          status: 500,
          headers: { 'content-type': 'text/html' },
        }),
    ]) {
      const cache = memoryCache();
      const { context, pending } = ctx();
      await serve(new Request('https://app.test/'), {}, context, {
        app: appAnswering(make),
        cache,
      });
      await Promise.all(pending);
      expect(cache.stored.size).toBe(0);
    }
  });

  it('keys the edge copy by release, so a deploy never serves old HTML', async () => {
    const cache = memoryCache();
    const app = appAnswering(() => page('a', 'n'));
    const { context, pending } = ctx();
    await serve(
      new Request('https://app.test/'),
      { CF_VERSION_METADATA: { id: 'v1' } },
      context,
      { app, cache },
    );
    await Promise.all(pending);
    await serve(
      new Request('https://app.test/'),
      { CF_VERSION_METADATA: { id: 'v2' } },
      context,
      { app, cache },
    );
    expect(app.seen).toHaveLength(2);
  });

  it('runs without an edge cache', async () => {
    const app = appAnswering(() => page('a', 'n'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const response = await serve(
      new Request('https://app.test/'),
      {},
      ctx().context,
      {
        app,
        cache: undefined,
      },
    );
    expect(response.status).toBe(200);
    spy.mockRestore();
  });
});
