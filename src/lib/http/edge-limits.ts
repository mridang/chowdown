/**
 * @packageDocumentation
 *
 * The first line of defence against floods and runaway scripts: Cloudflare's
 * Workers Rate Limiting bindings, checked in the Worker before the app (and so
 * before D1, Google, a model or an outbound fetch) is touched. A binding keeps
 * its counters in the Cloudflare location serving the request, with no database
 * write and no network wait, so refusing a flood costs almost nothing. It is
 * permissive and eventually consistent by design (a burst can slip a few
 * requests past, and each location counts for itself), which is what a cost
 * guard wants; the exact, durable counters that matter (the daily budgets, the
 * OAuth registration limit) stay in D1 in the app.
 *
 * Every request that is not a static file belongs to one {@link EdgeClass}.
 * Each class has its own binding, whose limit and period are declared in
 * `wrangler.jsonc` (a period is 10 or 60 seconds), and says who is counted:
 * the caller's network address, or, for the signed-in API, the person (a hash
 * of their session cookie, so many people behind one office address do not
 * share a budget). Because a cookie can be made up, those classes are also
 * counted per address in one roomy overall bucket.
 *
 * The limiter fails open: a missing binding (local development, tests) or one
 * that throws lets the request through.
 */

import { SESSION_COOKIE } from '../auth/session';
import { clientSubject } from './client-address';
import { CSP_REPORT_PATH } from './reporting';

/** One Workers Rate Limiting binding: `limit` says whether `key` may go ahead. */
export interface RateLimitBinding {
  limit(options: {
    readonly key: string;
  }): Promise<{ readonly success: boolean }>;
}

/** The kinds of request the edge counts separately. */
export type EdgeClass =
  | 'auth'
  | 'token'
  | 'register'
  | 'mcp'
  | 'mcpAnonymous'
  | 'import'
  | 'expensive'
  | 'cover'
  | 'api'
  | 'discovery'
  | 'reports'
  | 'site';

/** Who a class counts. */
type Counted = 'address' | 'person' | 'token';

/** What the edge knows about a class. */
interface ClassSpec {
  /** The name of the binding (in `wrangler.jsonc`) that counts it. */
  readonly binding: string;
  /** Who is counted. */
  readonly counted: Counted;
  /** The binding's period in seconds, which is also what a refused caller is told to wait. */
  readonly periodSeconds: 10 | 60;
}

/**
 * Every class, with its binding. The limits themselves are in `wrangler.jsonc`
 * (a test keeps the two in step): sign-in and approval flows are slow human
 * actions, the token endpoint serves assistants that share egress addresses,
 * and imports and tagging each cost model calls.
 */
export const EDGE_CLASSES: Readonly<Record<EdgeClass, ClassSpec>> = {
  auth: { binding: 'RL_AUTH', counted: 'address', periodSeconds: 60 },
  token: { binding: 'RL_TOKEN', counted: 'address', periodSeconds: 60 },
  register: { binding: 'RL_REGISTER', counted: 'address', periodSeconds: 60 },
  mcp: { binding: 'RL_MCP', counted: 'token', periodSeconds: 60 },
  mcpAnonymous: {
    binding: 'RL_MCP_ANONYMOUS',
    counted: 'address',
    periodSeconds: 60,
  },
  import: { binding: 'RL_IMPORT', counted: 'person', periodSeconds: 60 },
  expensive: { binding: 'RL_EXPENSIVE', counted: 'person', periodSeconds: 60 },
  cover: { binding: 'RL_COVER', counted: 'person', periodSeconds: 60 },
  api: { binding: 'RL_API', counted: 'person', periodSeconds: 60 },
  discovery: { binding: 'RL_DISCOVERY', counted: 'address', periodSeconds: 60 },
  reports: { binding: 'RL_REPORTS', counted: 'address', periodSeconds: 60 },
  site: { binding: 'RL_SITE', counted: 'address', periodSeconds: 60 },
};

/** The overall per-address bucket every request outside the static files also counts against. */
export const OVERALL_BINDING = 'RL_ADDRESS';

/** The bindings the Worker may have; absent ones are skipped. */
export type EdgeLimitEnv = Readonly<Record<string, unknown>>;

/** Paths served as static files: nothing to protect, and a page loads dozens of them. */
const STATIC_PREFIXES: readonly string[] = [
  '/_next/',
  '/icons/',
  '/screenshots/',
  '/recipes/',
];

/** The files at the root that are read by crawlers and installers and cost nothing to serve. */
const DISCOVERY_PATHS: ReadonlySet<string> = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/api/health',
]);

/**
 * Which class a request belongs to, or undefined for a static file that is not
 * counted at all.
 */
export function classify(
  method: string,
  pathname: string,
): EdgeClass | undefined {
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return undefined;
  }
  if (pathname === '/api/mcp') {
    return 'mcp';
  }
  if (pathname === CSP_REPORT_PATH) {
    return 'reports';
  }
  if (pathname === '/oauth/token') {
    return 'token';
  }
  if (pathname === '/oauth/register') {
    return 'register';
  }
  if (
    pathname.startsWith('/oauth/') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/sessions/self'
  ) {
    return 'auth';
  }
  if (pathname === '/api/recipe-imports' && method === 'POST') {
    return 'import';
  }
  if (pathname === '/api/recipe-suggestions') {
    return 'expensive';
  }
  if (pathname === '/api/img') {
    return 'cover';
  }
  if (pathname.startsWith('/api/') || pathname.startsWith('/rpc/')) {
    return DISCOVERY_PATHS.has(pathname) ? 'discovery' : 'api';
  }
  if (pathname.startsWith('/.well-known/') || DISCOVERY_PATHS.has(pathname)) {
    return 'discovery';
  }
  return 'site';
}

/** A request's `name` cookie, if it has one. */
function cookieValue(headers: Headers, name: string): string | undefined {
  return headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** The first 32 hex characters of the SHA-256 of `text`: a stable key that reveals nothing. */
async function digestKey(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(bytes)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The key a class counts a request under. A person is a hash of the session
 * cookie (falling back to the address when there is none, so a caller with no
 * cookie shares the address's budget), a token is a hash of the bearer token.
 */
export async function counterKey(
  counted: Counted,
  headers: Headers,
): Promise<string> {
  if (counted === 'person') {
    const session = cookieValue(headers, SESSION_COOKIE);
    return session
      ? `p:${await digestKey(session)}`
      : `a:${clientSubject(headers)}`;
  }
  if (counted === 'token') {
    const token = /^Bearer\s+(\S+)$/i.exec(
      headers.get('authorization') ?? '',
    )?.[1];
    return token
      ? `t:${await digestKey(token)}`
      : `a:${clientSubject(headers)}`;
  }
  return `a:${clientSubject(headers)}`;
}

/** Whether `value` is a usable binding. */
function isBinding(value: unknown): value is RateLimitBinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    'limit' in value &&
    typeof value.limit === 'function'
  );
}

/** Ask a binding whether `key` may go ahead; a missing or failing binding says yes. */
async function allowed(
  env: EdgeLimitEnv,
  binding: string,
  key: string,
): Promise<boolean> {
  const candidate = env[binding];
  if (!isBinding(candidate)) {
    return true;
  }
  try {
    return (await candidate.limit({ key })).success;
  } catch (error) {
    console.error(
      '[edge-limit] counter failed, letting the request through:',
      error,
    );
    return true;
  }
}

/** How a refusal is worded, so each kind of client can read it. */
type RefusalStyle = 'jsonrpc' | 'oauth' | 'problem' | 'text';

/** The wording style for a class. */
function styleFor(edgeClass: EdgeClass): RefusalStyle {
  switch (edgeClass) {
    case 'mcp':
    case 'mcpAnonymous':
      return 'jsonrpc';
    case 'token':
    case 'register':
      return 'oauth';
    case 'import':
    case 'expensive':
    case 'cover':
    case 'api':
      return 'problem';
    case 'auth':
    case 'discovery':
    case 'reports':
    case 'site':
      return 'text';
  }
}

/** The plain sentence every refusal carries. */
const TOO_MANY = 'Too many requests. Wait a moment and try again.';

/**
 * The 429 for a caller over a class's limit, worded for its kind of client:
 * a JSON-RPC error for MCP, an OAuth error for the token and registration
 * endpoints, a problem document for the API, plain text for pages. Always with
 * `Retry-After`, and open CORS for the machine-readable ones (their callers
 * are not browsers on our own pages, and a browser client must be able to read
 * the refusal to back off).
 */
export function tooManyRequests(
  edgeClass: EdgeClass,
  retryAfterSeconds: number,
): Response {
  const common = {
    'Retry-After': String(retryAfterSeconds),
    'Cache-Control': 'no-store',
  };
  const open = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Retry-After',
  };
  switch (styleFor(edgeClass)) {
    case 'jsonrpc':
      return Response.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: TOO_MANY,
            data: { retryAfterSeconds },
          },
        },
        { status: 429, headers: { ...common, ...open } },
      );
    case 'oauth':
      return Response.json(
        { error: 'temporarily_unavailable', error_description: TOO_MANY },
        { status: 429, headers: { ...common, ...open, Pragma: 'no-cache' } },
      );
    case 'problem':
      return new Response(
        JSON.stringify({
          type: '/problems/rate-limited',
          title: 'Too many requests',
          status: 429,
          detail: TOO_MANY,
        }),
        {
          status: 429,
          headers: { ...common, 'Content-Type': 'application/problem+json' },
        },
      );
    case 'text':
      return new Response(`${TOO_MANY}\n`, {
        status: 429,
        headers: { ...common, 'Content-Type': 'text/plain; charset=utf-8' },
      });
  }
}

/**
 * The refusal to send if the request is over a limit, or null if it may go on.
 * A request is counted in its own class and, when the class counts a person or
 * a token (which a caller can make up), in the overall bucket for its address
 * as well. A request with no `Authorization` header sent to the MCP endpoint is
 * only probing, so it is counted in a much tighter class than a real client.
 */
export async function edgeLimitRefusal(
  request: Request,
  env: EdgeLimitEnv,
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const found = classify(request.method, pathname);
  if (found === undefined || request.method === 'OPTIONS') {
    return null;
  }
  const edgeClass =
    found === 'mcp' && !request.headers.has('authorization')
      ? 'mcpAnonymous'
      : found;
  const spec = EDGE_CLASSES[edgeClass];
  if (
    !(await allowed(
      env,
      spec.binding,
      await counterKey(spec.counted, request.headers),
    ))
  ) {
    return tooManyRequests(edgeClass, spec.periodSeconds);
  }
  if (spec.counted !== 'address') {
    const overall = `a:${clientSubject(request.headers)}`;
    if (!(await allowed(env, OVERALL_BINDING, overall))) {
      return tooManyRequests(edgeClass, spec.periodSeconds);
    }
  }
  return null;
}
