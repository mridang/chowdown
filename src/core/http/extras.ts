/**
 * @packageDocumentation
 *
 * What this app adds to the shared edge code (`edge-limits.ts`, used by
 * `serve.ts`): which request counts against which rate limit, beyond the
 * classes every app has. It is the one place an app says what it is protecting.
 */

import { SESSION_COOKIE } from '@/lib/auth/app';
import {
  GENERIC_CLASSES,
  genericClass,
  type ClassSpec,
  type EdgeLimits,
} from '@/core/http/edge-limits';

/** The kinds of request this app counts besides the classes every app has. */
type OwnClass =
  | 'auth'
  | 'token'
  | 'register'
  | 'mcp'
  | 'mcpAnonymous'
  | 'import'
  | 'expensive';

/**
 * Every class this app counts, with its binding: sign-in and approval flows are
 * slow human actions, the token endpoint serves assistants that share egress
 * addresses, and imports and tagging each cost model calls.
 */
const CLASSES: Readonly<Record<OwnClass, ClassSpec>> = {
  auth: {
    binding: 'RL_AUTH',
    counted: 'address',
    periodSeconds: 60,
    style: 'text',
  },
  token: {
    binding: 'RL_TOKEN',
    counted: 'address',
    periodSeconds: 60,
    style: 'oauth',
  },
  register: {
    binding: 'RL_REGISTER',
    counted: 'address',
    periodSeconds: 60,
    style: 'oauth',
  },
  mcp: {
    binding: 'RL_MCP',
    counted: 'token',
    periodSeconds: 60,
    style: 'jsonrpc',
  },
  mcpAnonymous: {
    binding: 'RL_MCP_ANONYMOUS',
    counted: 'address',
    periodSeconds: 60,
    style: 'jsonrpc',
  },
  import: {
    binding: 'RL_IMPORT',
    counted: 'person',
    periodSeconds: 60,
    style: 'problem',
  },
  expensive: {
    binding: 'RL_EXPENSIVE',
    counted: 'person',
    periodSeconds: 60,
    style: 'problem',
  },
};

/**
 * The class of a request this app counts specially, or undefined when it is one
 * of the classes every app has. A request with no `Authorization` header sent to
 * the MCP endpoint is only probing, so it is counted in a much tighter class
 * than a real client.
 */
function ownClass(request: Request): OwnClass | undefined {
  const { pathname } = new URL(request.url);
  if (pathname === '/mcp') {
    return request.headers.has('authorization') ? 'mcp' : 'mcpAnonymous';
  }
  if (pathname === '/oauth/token') {
    return 'token';
  }
  if (pathname === '/oauth/register') {
    return 'register';
  }
  if (
    pathname.startsWith('/oauth/') ||
    pathname.startsWith('/auth/') ||
    pathname === '/api/sessions/self'
  ) {
    return 'auth';
  }
  if (pathname === '/api/recipes/imports' && request.method === 'POST') {
    return 'import';
  }
  if (pathname === '/api/recipes/suggestions') {
    return 'expensive';
  }
  return undefined;
}

/** What this app counts, and how a request is sorted into it. */
export const EDGE_LIMITS: EdgeLimits = {
  classes: { ...GENERIC_CLASSES, ...CLASSES },
  classify: (request) =>
    ownClass(request) ?? genericClass(new URL(request.url).pathname),
  sessionCookie: SESSION_COOKIE,
};
