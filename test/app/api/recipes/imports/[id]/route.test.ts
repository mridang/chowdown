import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { APP_MIGRATIONS } from '../../../../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../../lib/core/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { uid: number | null } = { uid: 7 };

// The sign-in gate has its own tests (test/lib/api/auth.test.ts); here it just
// says who is calling, in the shape the routes read.
const { problems } = await import('@/lib/core/api');
jest.unstable_mockModule('@/domain/api/auth', () => ({
  requireLiveUid: async () =>
    session.uid === null
      ? { ok: false, response: problems.unauthorized() }
      : { ok: true, value: session.uid },
}));

const { DELETE, GET } = await import('@/app/api/recipes/imports/[id]/route');

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.uid = 7;
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  const insert = raw.prepare(
    "INSERT INTO recipe_imports (id, user_id, status, items, created_at) VALUES (?, ?, 'COMPLETED', ?, ?)",
  );
  insert.run(
    'mine',
    7,
    '[{"title":"Soup","status":"DRAFT"}]',
    '2026-01-01T00:00:00.000Z',
  );
  insert.run('theirs', 8, '[]', '2026-01-02T00:00:00.000Z');
});

afterEach(() => restore());

/** The route context for an import id. */
const context = (id: string) => ({ params: Promise.resolve({ id }) });

const URL = 'https://chowdown.test/api/recipes/imports';

describe('GET /api/recipes/imports/:id', () => {
  it('answers 401 when nobody is signed in', async () => {
    session.uid = null;
    expect(
      (await GET(new Request(`${URL}/mine`), context('mine'))).status,
    ).toBe(401);
  });

  it('returns the import with its drafts, for the person who made it only', async () => {
    const res = await GET(new Request(`${URL}/mine`), context('mine'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(await res.json()).toMatchObject({
      id: 'mine',
      status: 'COMPLETED',
      items: [{ title: 'Soup', status: 'DRAFT' }],
    });
  });

  it("answers 404 for another person's import and for one that does not exist", async () => {
    expect(
      (await GET(new Request(`${URL}/theirs`), context('theirs'))).status,
    ).toBe(404);
    expect(
      (await GET(new Request(`${URL}/nope`), context('nope'))).status,
    ).toBe(404);
  });
});

describe('DELETE /api/recipes/imports/:id', () => {
  const remove = (id: string) =>
    DELETE(new Request(`${URL}/${id}`, { method: 'DELETE' }), context(id));

  it('answers 401 when nobody is signed in, and deletes nothing', async () => {
    session.uid = null;
    expect((await remove('mine')).status).toBe(401);
    expect(raw.prepare('SELECT id FROM recipe_imports').all()).toHaveLength(2);
  });

  it('discards the import with 204', async () => {
    const res = await remove('mine');
    expect(res.status).toBe(204);
    expect(
      raw.prepare("SELECT id FROM recipe_imports WHERE id = 'mine'").all(),
    ).toHaveLength(0);
  });

  it("answers 404 for another person's import, and leaves it alone", async () => {
    expect((await remove('theirs')).status).toBe(404);
    expect(
      raw.prepare("SELECT id FROM recipe_imports WHERE id = 'theirs'").all(),
    ).toHaveLength(1);
  });

  it('answers 404 the second time', async () => {
    await remove('mine');
    expect((await remove('mine')).status).toBe(404);
  });
});
