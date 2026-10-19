import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { APP_MIGRATIONS } from '../../../lib/db/migrations';
import { installCloudflareContext, sqliteD1 } from '../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { uid: number | null } = { uid: 7 };

jest.unstable_mockModule('../../../../src/lib/auth/current-user', () => ({
  getSessionUid: async () => session.uid,
}));

const { GET } = await import('../../../../src/app/api/cover-images/route');

const PHOTO = 'https://photos.example.org/soup.jpg';
const UNLISTED = 'https://photos.example.org/unlisted.jpg';

const realFetch = global.fetch;
const realCaches = Reflect.get(globalThis, 'caches');
let raw: DatabaseSync;
let restore: () => void;
let fetched: string[];

/** Make every fetch answer with a fresh response from `respond`. */
function serving(respond: () => Response): void {
  global.fetch = (async (url: string) => {
    fetched.push(String(url));
    return respond();
  }) as unknown as typeof fetch;
}

/** A small JPEG response. */
const jpeg = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'content-type': 'image/jpeg' },
  });

beforeEach(() => {
  session.uid = 7;
  fetched = [];
  serving(jpeg);
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  raw.exec(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 's7', 'a@b.c', 't', 't'), (8, 's8', 'd@e.f', 't', 't')",
  );
  const insert = raw.prepare(
    "INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES (?, ?, ?, ?, 't', 't')",
  );
  insert.run(
    7,
    'f1',
    'Soup.cook',
    `>> title: Soup\n>> images: ${PHOTO}\n\nBoil.`,
  );
  insert.run(
    8,
    'f2',
    'Stew.cook',
    `>> title: Stew\n>> images: ${UNLISTED}\n\nBoil.`,
  );
});

afterEach(() => {
  restore();
  global.fetch = realFetch;
  Reflect.set(globalThis, 'caches', realCaches);
});

const ask = (query: string) =>
  GET(new Request(`https://chowdown.test/api/cover-images?${query}`));

/** The query for a photo. */
const photo = (url: string, width = '640') =>
  `url=${encodeURIComponent(url)}&w=${width}`;

describe('GET /api/cover-images', () => {
  it('answers 401 first, before looking at the address or fetching anything', async () => {
    session.uid = null;
    expect((await ask(photo(PHOTO))).status).toBe(401);
    expect((await ask('url=http://127.0.0.1/')).status).toBe(401);
    expect(fetched).toEqual([]);
  });

  it('sends a photo one of the signed-in works lists, sealed and cacheable by the browser only', async () => {
    const res = await ask(photo(PHOTO));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe(
      'private, max-age=604800, immutable',
    );
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(fetched).toEqual([PHOTO]);
  });

  it('answers 404 for a photo none of their recipes lists, without fetching it', async () => {
    const res = await ask(photo(UNLISTED));
    expect(res.status).toBe(404);
    expect(fetched).toEqual([]);
  });

  it("answers 404 for a photo only someone else's recipe lists", async () => {
    session.uid = 8;
    expect((await ask(photo(PHOTO))).status).toBe(404);
    expect(fetched).toEqual([]);
  });

  it('answers 400 for an address that is not a public image, and for none', async () => {
    expect((await ask(photo('http://127.0.0.1/x.png'))).status).toBe(400);
    expect((await ask(photo('file:///etc/passwd'))).status).toBe(400);
    expect((await ask('w=640')).status).toBe(400);
    expect(fetched).toEqual([]);
  });

  it('answers 204, which is no error in the browser, when the photo is gone or its site fails', async () => {
    serving(() => new Response('', { status: 404 }));
    expect((await ask(photo(PHOTO))).status).toBe(204);
    serving(() => new Response('', { status: 500 }));
    expect((await ask(photo(PHOTO))).status).toBe(204);
    global.fetch = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect((await ask(photo(PHOTO))).status).toBe(204);
  });

  it('lets the browser keep a 204 for an hour, and says why in a header', async () => {
    serving(() => new Response('', { status: 403 }));
    const res = await ask(photo(PHOTO));
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(res.headers.get('x-cover-unavailable')).toBeTruthy();
    expect(await res.text()).toBe('');
  });

  it('answers 204 for something that is not a photo', async () => {
    serving(
      () =>
        new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    );
    expect((await ask(photo(PHOTO))).status).toBe(204);
  });

  it('refuses to be redirected to an address it should not reach', async () => {
    serving(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1:8080/admin' },
        }),
    );
    const res = await ask(photo(PHOTO));
    expect(res.status).toBe(204);
    expect(fetched).toEqual([PHOTO]);
  });

  describe('with an edge cache', () => {
    /** A cache that holds what it is given. */
    function installCache(initial?: Response) {
      const puts: string[] = [];
      Reflect.set(globalThis, 'caches', {
        default: {
          match: async () => initial,
          put: async (key: Request) => {
            puts.push(key.url);
          },
        },
      });
      return puts;
    }

    it('answers from the cache without asking about ownership or fetching', async () => {
      installCache(
        new Response('cached', { headers: { 'content-type': 'image/webp' } }),
      );
      const res = await ask(photo(UNLISTED));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('cached');
      expect(fetched).toEqual([]);
    });

    it('still answers 401 first when the cache has the photo', async () => {
      installCache(new Response('cached'));
      session.uid = null;
      expect((await ask(photo(PHOTO))).status).toBe(401);
    });

    it('keeps a copy of a photo it fetched', async () => {
      const puts = installCache();
      expect((await ask(photo(PHOTO))).status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(puts).toEqual([
        `https://covers.chowdown.invalid/640/${encodeURIComponent(PHOTO)}`,
      ]);
    });
  });

  describe('widths', () => {
    /** The widths the Images binding was asked for. */
    function installImages(): number[] {
      const widths: number[] = [];
      const holder = globalThis as unknown as Record<
        symbol,
        { env: Record<string, unknown> }
      >;
      const context = holder[Symbol.for('__cloudflare-context__')];
      if (context?.env) {
        Reflect.set(context.env, 'IMAGES', {
          input: () => ({
            transform: (options: { width: number }) => {
              widths.push(options.width);
              return {
                output: async () => ({
                  response: () => new Response(new Uint8Array([9])),
                }),
              };
            },
          }),
        });
      }
      return widths;
    }

    /** A photo big enough to be worth scaling. */
    const big = () =>
      new Response(new Uint8Array(100_000), {
        headers: { 'content-type': 'image/jpeg' },
      });

    it.each([
      ['500', 640],
      ['700', 960],
      ['5000', 1280],
      ['abc', 640],
      ['0', 640],
    ])('snaps w=%s to %i', async (w, expected) => {
      const widths = installImages();
      serving(big);
      expect((await ask(photo(PHOTO, w))).status).toBe(200);
      expect(widths).toEqual([expected]);
    });

    it('uses 640 when w is missing', async () => {
      const widths = installImages();
      serving(big);
      await ask(`url=${encodeURIComponent(PHOTO)}`);
      expect(widths).toEqual([640]);
    });
  });
});
