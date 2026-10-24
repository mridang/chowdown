import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { DAILY_BUDGETS } from '@/lib/util/daily-budget';
import type { ImportUnit } from '@/lib/recipe/import-blob';
import type { ImportItem } from '@/lib/recipe/prepare-import';
import { APP_MIGRATIONS } from '../../../../lib/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { uid: number | null } = { uid: 7 };

// The sign-in gate has its own tests (test/lib/api/auth.test.ts); here it just
// says who is calling, in the shape the routes read.
const { problems } = await import('@/lib/rest-json/problem');
jest.unstable_mockModule('@/lib/api/auth', () => ({
  requireLiveUid: async () =>
    session.uid === null
      ? { ok: false, response: problems.unauthorized() }
      : { ok: true, value: session.uid },
}));

/** What the converter is asked to prepare, and what it answers. */
const prepareImport = jest.fn<
  (units: readonly ImportUnit[], env: unknown) => Promise<readonly ImportItem[]>
>(async (units) =>
  units.map(
    (unit): ImportItem => ({
      title: unit.kind === 'url' ? unit.url : 'Pasted recipe',
      status: 'DRAFT',
      cooklang: '>> title: T\n',
    }),
  ),
);

jest.unstable_mockModule('@/lib/recipe/prepare-import', () => ({
  prepareImport,
}));

const { GET, POST } = await import('@/app/api/recipes/imports/route');

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  prepareImport.mockClear();
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
});

afterEach(() => restore());

const URL = 'https://chowdown.test/api/recipes/imports';

/** A POST with the given body text. */
const post = (
  body: string,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) => POST(new Request(URL, { method: 'POST', headers, body }));

/** A POST of `{ input }`. */
const postInput = (input: string) => post(JSON.stringify({ input }));

/** `count` distinct links, one after another. */
const links = (count: number) =>
  Array.from({ length: count }, (_, i) => `https://a${i}.example.com/r`).join(
    '\n',
  );

/** The rows stored for a user. */
const stored = (uid: number) =>
  raw.prepare('SELECT * FROM recipe_imports WHERE user_id = ?').all(uid);

describe('POST /api/recipes/imports', () => {
  it('answers 401 when nobody is signed in, without doing any work', async () => {
    session.uid = null;
    expect((await postInput('https://a.example.com/r')).status).toBe(401);
    expect(prepareImport).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After once the day's import allowance is used, without doing the work", async () => {
    for (let i = 0; i < DAILY_BUDGETS.import.limit; i += 1) {
      expect((await postInput('https://a.example.com/r')).status).toBe(201);
    }
    prepareImport.mockClear();
    const res = await postInput('https://a.example.com/r');
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(prepareImport).not.toHaveBeenCalled();
  });

  it('counts the allowance per person', async () => {
    for (let i = 0; i < DAILY_BUDGETS.import.limit; i += 1) {
      await postInput('https://a.example.com/r');
    }
    session.uid = 8;
    expect((await postInput('https://a.example.com/r')).status).toBe(201);
  });

  it('answers 415 to a body that is not JSON', async () => {
    const res = await post('input=x', {
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(res.status).toBe(415);
  });

  it('answers 413 to a body over 1 MiB, before reading it', async () => {
    const res = await post(JSON.stringify({ input: 'x'.repeat(1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(prepareImport).not.toHaveBeenCalled();
  });

  it.each([
    ['text that is not JSON', '{nope'],
    ['no input', '{}'],
    ['an input that is not text', '{"input":5}'],
    ['a blank input', '{"input":"   "}'],
  ])('answers 400 to %s', async (_name, body) => {
    expect((await post(body)).status).toBe(400);
    expect(prepareImport).not.toHaveBeenCalled();
  });

  it('answers 400 to an input over 100,000 characters', async () => {
    const res = await postInput(
      `https://a.example.com/r ${'x'.repeat(100_000)}`,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ errors: ['input: too large.'] });
    expect(prepareImport).not.toHaveBeenCalled();
  });

  it('answers 400 when nothing in the input is a link or a recipe', async () => {
    const res = await postInput('hi');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      detail: 'No links or recipe text found in what you pasted.',
    });
    expect(prepareImport).not.toHaveBeenCalled();
    expect(stored(7)).toHaveLength(0);
  });

  it('turns away an eleventh unit before doing any of the work', async () => {
    const res = await postInput(links(11));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(await res.json()).toMatchObject({
      detail:
        'That is 11 links and recipes; one import takes at most 10. Split it into smaller imports.',
      errors: ['input: at most 10 links or recipes per import.'],
    });
    expect(prepareImport).not.toHaveBeenCalled();
    expect(stored(7)).toHaveLength(0);
  });

  it('turns away thousands of tiny links in one request just the same', async () => {
    const res = await postInput(
      Array.from({ length: 5000 }, (_, i) => `http://a.b/${i}`).join(' '),
    );
    expect(res.status).toBe(400);
    expect(prepareImport).not.toHaveBeenCalled();
  });

  it('counts pasted recipes as units too', async () => {
    const recipes = Array.from(
      { length: 6 },
      (_, i) => `Recipe ${i}: mix flour and water, then bake it for an hour.`,
    ).join('\n\n');
    const res = await postInput(`${links(5)}\n\n${recipes}`);
    expect(res.status).toBe(400);
  });

  it('prepares exactly ten units, links first, and stores the drafts', async () => {
    const res = await postInput(links(10));
    expect(res.status).toBe(201);
    const [units] = prepareImport.mock.calls[0] ?? [];
    expect(units).toHaveLength(10);
    expect(units?.[0]).toEqual({
      kind: 'url',
      url: 'https://a0.example.com/r',
    });
    const created = (await res.json()) as { id: string; items: unknown[] };
    expect(created.items).toHaveLength(10);
    expect(res.headers.get('location')).toBe(`${URL}/${created.id}`);
    expect(stored(7)).toHaveLength(1);
    expect(stored(8)).toHaveLength(0);
  });

  it('prepares a link and a pasted recipe together', async () => {
    const res = await postInput(
      'see https://a.example.com/r\n\nMix the flour and the water, then bake it for an hour.',
    );
    expect(res.status).toBe(201);
    const [units] = prepareImport.mock.calls[0] ?? [];
    expect(units).toEqual([
      { kind: 'url', url: 'https://a.example.com/r' },
      expect.objectContaining({ kind: 'text' }),
    ]);
  });
});

describe('GET /api/recipes/imports', () => {
  /** Store three imports for user 7 and one for user 8. */
  function seed(): void {
    const insert = raw.prepare(
      "INSERT INTO recipe_imports (id, user_id, status, items, created_at) VALUES (?, ?, 'COMPLETED', ?, ?)",
    );
    insert.run('i1', 7, '[{"title":"a"}]', '2026-01-01T00:00:00.000Z');
    insert.run(
      'i2',
      7,
      '[{"title":"a"},{"title":"b"}]',
      '2026-01-02T00:00:00.000Z',
    );
    insert.run('i3', 7, '[]', '2026-01-03T00:00:00.000Z');
    insert.run('i4', 8, '[]', '2026-01-04T00:00:00.000Z');
  }

  const list = (query = '') => GET(new Request(`${URL}${query}`));

  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect((await list()).status).toBe(401);
  });

  it("lists the person's imports, newest first, as summaries without drafts", async () => {
    seed();
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items).toEqual([
      expect.objectContaining({ id: 'i3', item_count: 0 }),
      expect.objectContaining({ id: 'i2', item_count: 2 }),
      expect.objectContaining({ id: 'i1', item_count: 1 }),
    ]);
    expect(body.items[0]).not.toHaveProperty('items');
  });

  it('pages with a cursor', async () => {
    seed();
    const first = (await (await list('?limit=2')).json()) as {
      items: { id: string }[];
      next?: string;
    };
    expect(first.items.map((i) => i.id)).toEqual(['i3', 'i2']);
    expect(first.next).toBeDefined();
    const cursor = new globalThis.URL(first.next ?? '').searchParams.get(
      'cursor',
    );
    const second = (await (await list(`?limit=2&cursor=${cursor}`)).json()) as {
      items: { id: string }[];
      next?: string;
    };
    expect(second.items.map((i) => i.id)).toEqual(['i1']);
    expect(second.next).toBeUndefined();
  });

  it.each(['?limit=0', '?limit=101', '?limit=x', '?cursor=%25%25'])(
    'answers 400 to %s',
    async (query) => {
      expect((await list(query)).status).toBe(400);
    },
  );
});
