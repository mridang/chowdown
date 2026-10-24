import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { DatabaseSync } from 'node:sqlite';

import { encryptSecret } from '@/lib/crypto';
import { SESSION_COOKIE } from '@/lib/auth/app';
import {
  insertUser,
  jar,
  sessionTokenFor,
  testEnv,
} from '../../lib/auth/session-fixture';
import { APP_MIGRATIONS } from '../../lib/db/migrations';
import {
  installCloudflareContext,
  settleBackground,
  sqliteD1,
} from '../../lib/db/sqlite-d1';

/** The address the app is served from in route tests. */
export const ORIGIN = 'https://chowdown.test';

/** A running test world: a migrated database in place of D1, and the Worker environment. */
export interface World {
  readonly raw: DatabaseSync;
  readonly env: Record<string, unknown>;
  /** Let background work finish, then put the globals back. */
  readonly close: () => Promise<void>;
}

/** Open a world: a fresh in-memory database with every migration, no browser cookies. */
export function openWorld(): World {
  jar.clear();
  const made = sqliteD1(...APP_MIGRATIONS);
  const env = testEnv();
  const restore = installCloudflareContext(made.d1, env);
  return {
    raw: made.raw,
    env,
    close: async () => {
      await settleBackground();
      restore();
      jest.restoreAllMocks();
    },
  };
}

/**
 * Add a person and sign this browser in as them. With `drive`, they have a
 * sealed Drive refresh token and a Recipes folder, so Drive-backed routes work.
 */
export async function signIn(
  world: World,
  options: Readonly<{
    id?: number;
    drive?: boolean;
    epoch?: number;
    email?: string;
  }> = {},
): Promise<number> {
  const id = options.id ?? 1;
  const sealed = options.drive
    ? await encryptSecret(
        'refresh-token',
        String(world.env['TOKEN_ENCRYPTION_KEY']),
      )
    : null;
  insertUser(world.raw, {
    id,
    email: options.email ?? `user${id}@example.com`,
    refresh_token_enc: sealed,
    recipes_folder_id: options.drive ? 'folder-1' : null,
    session_epoch: options.epoch ?? 0,
  });
  jar.set(
    SESSION_COOKIE,
    await sessionTokenFor({ id }, { ep: options.epoch ?? 0 }),
  );
  return id;
}

/** A request from our own pages (what the browser app sends). */
export function fromApp(
  method: string,
  path: string,
  options: Readonly<{
    json?: unknown;
    body?: string;
    type?: string;
    headers?: Readonly<Record<string, string>>;
  }> = {},
): Request {
  const body =
    options.json !== undefined ? JSON.stringify(options.json) : options.body;
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      'sec-fetch-site': 'same-origin',
      ...(body !== undefined
        ? { 'content-type': options.type ?? 'application/json' }
        : {}),
      ...options.headers,
    },
    ...(body !== undefined ? { body } : {}),
  });
}

/** Cache a recipe for a person, as a sync or a save would have. */
export function addRecipe(
  world: World,
  userId: number,
  fileId: string,
  source: string,
  name = `${fileId}.cook`,
): void {
  world.raw
    .prepare(
      "INSERT INTO recipes (user_id, drive_file_id, name, title, source, first_opened_at, last_opened_at) VALUES (?, ?, ?, ?, ?, 'n', 'n')",
    )
    .run(userId, fileId, name, name.replace(/\.cook$/, ''), source);
}

/** A stand-in for Google's token endpoint and the Drive API. */
export interface GoogleFake {
  /** The files in the fake Drive, by id. */
  readonly files: Map<string, { name: string; content: string }>;
  /** Every request made, as `METHOD url`. */
  readonly requests: string[];
}

/**
 * Replace `fetch` with a fake Google: the token endpoint answers an access
 * token, and Drive stores, reads, lists and trashes files in memory. Anything
 * else is a test mistake and throws.
 */
export function fakeGoogle(
  initial: Readonly<Record<string, { name: string; content: string }>> = {},
): GoogleFake {
  const files = new Map(Object.entries(initial));
  const requests: string[] = [];
  const counter = { created: 0 };
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push(`${method} ${url}`);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(
        JSON.stringify({ access_token: 'access-token', expires_in: 3599 }),
      );
    }
    if (url.startsWith('https://oauth2.googleapis.com/revoke')) {
      return new Response('{}');
    }
    const id = /\/files\/([\w-]+)/.exec(url)?.[1];
    if (method === 'GET' && url.includes('alt=media') && id) {
      const file = files.get(id);
      return file
        ? new Response(file.content)
        : new Response('not found', { status: 404 });
    }
    if (method === 'GET' && url.includes('/drive/v3/files?')) {
      return new Response(
        JSON.stringify({
          files: [...files].map(([fileId, f]) => ({
            id: fileId,
            name: f.name,
            modifiedTime: '2026-01-01T00:00:00.000Z',
          })),
        }),
      );
    }
    if (method === 'POST' && url.includes('uploadType=multipart')) {
      counter.created += 1;
      const text = String(init?.body ?? '');
      const name = /"name":"([^"]+)"/.exec(text)?.[1] ?? 'new.cook';
      const content =
        text
          .split('Content-Type: text/plain; charset=UTF-8\r\n\r\n')[1]
          ?.split('\r\n--chowdown-')[0] ?? '';
      const created = `created-${counter.created}`;
      files.set(created, { name, content });
      return new Response(
        JSON.stringify({
          id: created,
          name,
          modifiedTime: '2026-01-02T00:00:00.000Z',
        }),
      );
    }
    if (method === 'PATCH' && url.includes('uploadType=media') && id) {
      const file = files.get(id);
      if (!file) {
        return new Response('not found', { status: 404 });
      }
      files.set(id, { ...file, content: String(init?.body ?? '') });
      return new Response('{}');
    }
    if (method === 'PATCH' && url.includes('fields=id') && id) {
      const existed = files.delete(id);
      return existed
        ? new Response('{}')
        : new Response('not found', { status: 404 });
    }
    throw new Error(`Unexpected request in a test: ${method} ${url}`);
  });
  return { files, requests };
}

/** A Next request (the kind route handlers with cookies receive) carrying the given cookies. */
export function nextRequest(
  path: string,
  cookies: Readonly<Record<string, string>> = {},
): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

/** The address a redirect response points at, or undefined if it is not a redirect. */
export function locationOf(response: Response): URL | undefined {
  const target = response.headers.get('location');
  return target ? new URL(target) : undefined;
}

export { answerFetch } from '../../lib/auth/auth-test-kit';
