import { getCloudflareContext } from '@opennextjs/cloudflare';

import { createDatabase, type Database } from '../db/client';

/** The D1 database binding from the current Cloudflare context. */
export function getDB(): D1Database {
  return getCloudflareContext().env.DB;
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
  return getEnv().APP_URL ?? new URL(request.url).origin;
}
