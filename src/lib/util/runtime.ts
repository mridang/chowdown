import { getCloudflareContext } from '@opennextjs/cloudflare';

import { createDatabase, type Database } from '../db/client';

/** The D1 database binding from the current Cloudflare context. */
export function getDB(): D1Database {
  return getCloudflareContext().env.DB;
}

/**
 * Whether the D1 binding can be reached from the current request context.
 * False (not an error) when there is no Cloudflare context or no binding, so
 * health checks can report it.
 */
export function isDatabaseBound(): boolean {
  try {
    return Boolean(getDB());
  } catch {
    return false;
  }
}

/** The full Cloudflare environment (bindings + secrets) — typed via env.d.ts. */
export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}

/** A typed Drizzle client bound to the request's D1 binding. */
export function getDatabase(): Database {
  return createDatabase(getDB());
}

/**
 * The app's public origin: the `APP_URL` secret when set, otherwise the origin
 * of the incoming request (so localhost and the custom domain both work with
 * no configuration).
 */
export function appOrigin(request: Request): string {
  return configuredOrigin() ?? new URL(request.url).origin;
}

/** The `APP_URL` setting, or `undefined` when it is not set or there is no Cloudflare context (tests, scripts). */
function configuredOrigin(): string | undefined {
  try {
    return getEnv().APP_URL;
  } catch {
    return undefined;
  }
}

/**
 * Like {@link appOrigin}, for Server Components, which get request headers
 * rather than a `Request`. The host is the request's own `Host` header, which
 * Cloudflare sets to the address the browser used; `x-forwarded-host` is
 * deliberately NOT read, because anyone can send it and the answer is shown to
 * people as "the address to add to your assistant". The scheme comes from
 * `x-forwarded-proto` only when it says `http` or `https`.
 */
export function appOriginFromHeaders(headers: Headers): string {
  const configured = configuredOrigin();
  if (configured) {
    return configured;
  }
  const host = headers.get('host') ?? 'localhost';
  const forwarded = headers.get('x-forwarded-proto');
  const proto =
    forwarded === 'http' || forwarded === 'https'
      ? forwarded
      : host.startsWith('localhost') || host.startsWith('127.')
        ? 'http'
        : 'https';
  return `${proto}://${host}`;
}

/**
 * Run work after the response has been sent, without blocking it. Failures are
 * swallowed (logged) because background work — embedding, cache warming — must
 * never turn a successful request into an error. Falls back to a floating
 * promise outside a Workers request (tests, scripts).
 */
export function runInBackground(work: Promise<unknown>): void {
  const guarded = work.catch((err: unknown) => {
    console.error('background task failed', err);
  });
  try {
    getCloudflareContext().ctx.waitUntil(guarded);
  } catch {
    // No request context: the promise already runs; nothing to extend.
  }
}
