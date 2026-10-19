/**
 * @packageDocumentation
 *
 * The MCP endpoint on its own, for the official conformance suite
 * (`npm run conformance`). It serves `respondToMcp` from `src/lib/mcp/http.ts`
 * (the same function `src/app/api/mcp/route.ts` hands every request to, so the
 * origin check, the 401 and 405 branches and the POST handling are the real
 * ones) on a plain Node HTTP server, with sign-in replaced by one fixed user and
 * counters kept in memory, so no database, Drive or token is needed.
 */

import { createServer, type IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

import type { User } from '../../src/lib/db/users';
import type { McpAuth } from '../../src/lib/mcp/auth';
import { respondToMcp } from '../../src/lib/mcp/http';
import type { RateLimitDeps } from '../../src/lib/mcp/request-limits';
import { SCOPE_READ, SCOPE_WRITE } from '../../src/lib/oauth/scopes';
import type { RateLimitStore } from '../../src/lib/util/rate-limit';

/** Whoever the suite is: signed in, with no Google Drive connected. */
const SUITE_USER = { id: 1, refresh_token_enc: null } as Readonly<User>;

/** Counters in memory, with the same fixed windows as the database ones. */
function memoryStore(): RateLimitStore {
  const windows = new Map<string, { count: number; windowStart: number }>();
  return {
    hit: async (key, now, windowSeconds) => {
      const current = windows.get(key);
      const next =
        current && current.windowStart > now - windowSeconds
          ? { count: current.count + 1, windowStart: current.windowStart }
          : { count: 1, windowStart: now };
      windows.set(key, next);
      return next;
    },
    purge: async () => {},
  };
}

/** The limiter's dependencies: memory, the real clock, and no sweeping. */
const RATE: RateLimitDeps = {
  store: memoryStore,
  now: () => Math.floor(Date.now() / 1000),
  random: () => 1,
};

/** A Node request as the web `Request` the handlers take. */
function toRequest(incoming: IncomingMessage, origin: string): Request {
  const hasBody = incoming.method !== 'GET' && incoming.method !== 'HEAD';
  return new Request(new URL(incoming.url ?? '/', origin), {
    method: incoming.method,
    headers: Object.fromEntries(
      Object.entries(incoming.headers).flatMap(([name, value]) =>
        typeof value === 'string' ? [[name, value]] : [],
      ),
    ),
    ...(hasBody
      ? { body: Readable.toWeb(incoming) as ReadableStream, duplex: 'half' }
      : {}),
  });
}

/** Every caller is the suite's user, with every scope. */
async function authenticateSuite(): Promise<McpAuth> {
  return { kind: 'ok', user: SUITE_USER, scope: [SCOPE_READ, SCOPE_WRITE] };
}

/** Answer `request` exactly as `src/app/api/mcp/route.ts` does, minus the token lookup. */
function respond(request: Request, origin: string): Promise<Response> {
  return respondToMcp(request, origin, authenticateSuite, RATE);
}

const port = Number(process.env['PORT'] ?? 0);

/**
 * The address the server is reached at, as the app would know its own: fixed,
 * not taken from the request's `Host` header, so a request that names another
 * host or origin (DNS rebinding) is refused rather than echoed back.
 */
function ownOrigin(): string {
  const address = server.address();
  return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`;
}

const server = createServer((incoming, outgoing) => {
  const origin = ownOrigin();
  respond(toRequest(incoming, origin), origin)
    .then(async (response) => {
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    })
    .catch((error: unknown) => {
      console.error(error);
      outgoing.writeHead(500).end();
    });
});

server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  const bound = typeof address === 'object' && address ? address.port : port;
  // The runner reads this line to learn where to point the suite.
  console.log(`LISTENING http://127.0.0.1:${bound}/api/mcp`);
});
