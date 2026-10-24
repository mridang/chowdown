import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { listRecipes } from '@/lib/api/recipe-list';
import { APP_MIGRATIONS } from '../db/migrations';
import { installCloudflareContext, sqliteD1 } from '../db/sqlite-d1';
import { insertUser } from '../auth/session-fixture';

let raw: DatabaseSync;
let restore: () => void;

/** Cache a recipe for a person. */
function addRecipe(
  userId: number,
  id: string,
  title: string,
  extra: Readonly<{
    source?: string;
    modified?: string;
    hearted?: boolean;
  }> = {},
) {
  raw
    .prepare(
      "INSERT INTO recipes (user_id, drive_file_id, name, title, source, modified_time, first_opened_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?, 'n', 'n')",
    )
    .run(
      userId,
      id,
      `${title}.cook`,
      title,
      extra.source ?? `>> title: ${title}\n\nCook @onion{1}.\n`,
      extra.modified ?? null,
    );
  if (extra.hearted) {
    raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, ?, 'n')",
      )
      .run(userId, id);
  }
}

beforeEach(() => {
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  insertUser(raw, { id: 1 });
  insertUser(raw, { id: 2, email: 'c@d.com' });
});

afterEach(() => restore());

/** Call the list as person 1 and read the page back. */
async function list(
  query = '',
  forced: Record<string, string> = {},
  userId = 1,
) {
  const res = await listRecipes(
    new Request(`https://chowdown.test/api/recipes${query}`),
    userId,
    forced,
  );
  return {
    res,
    body: (await res.json()) as {
      self?: string;
      next?: string;
      items?: { id: string; title: string; favourite: boolean }[];
      status?: number;
    },
  };
}

describe('listRecipes', () => {
  beforeEach(() => {
    addRecipe(1, 'b', 'Banana bread', { modified: '2026-02-01T00:00:00.000Z' });
    addRecipe(1, 'a', 'Apple pie', {
      modified: '2026-03-01T00:00:00.000Z',
      hearted: true,
    });
    addRecipe(1, 'c', 'Carrot cake', {
      modified: '2026-01-01T00:00:00.000Z',
      source:
        '>> title: Carrot cake\n>> source: https://cakes.example.com/carrot\n\nGrate @carrot{2}.\n',
    });
    addRecipe(2, 'z', 'Someone else', {});
  });

  it("lists the person's recipes by title, with their hearts, and never anyone else's", async () => {
    const { res, body } = await list();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(body.items?.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(body.items?.map((r) => r.favourite)).toEqual([true, false, false]);
  });

  it('refuses a favourite filter, which belongs to the favourites list', async () => {
    const { res, body } = await list('?favourite=true');
    expect(res.status).toBe(400);
    expect(body.status).toBe(400);
  });

  it('still lets the favourites list force its own favourite filter', async () => {
    const { body } = await list('', { favourite: 'true' });
    expect(body.items?.map((r) => r.id)).toEqual(['a']);
  });

  it('sorts by the sort parameter, newest first with a minus', async () => {
    const { body } = await list('?sort=-modified_at');
    expect(body.items?.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(
      (await list('?sort=modified_at')).body.items?.map((r) => r.id),
    ).toEqual(['c', 'b', 'a']);
  });

  it('refuses a sort it does not know', async () => {
    const { res } = await list('?sort=colour');
    expect(res.status).toBe(400);
  });

  it('filters by the free-text query', async () => {
    const { body } = await list('?q=carrot');
    expect(body.items?.map((r) => r.id)).toEqual(['c']);
  });

  it('filters by source site', async () => {
    const { body } = await list('?source_site=cakes.example.com');
    expect(body.items?.map((r) => r.id)).toEqual(['c']);
  });

  it('pages with a cursor that carries on where the page ended', async () => {
    const first = await list('?limit=2');
    expect(first.body.items?.map((r) => r.id)).toEqual(['a', 'b']);
    expect(first.body.next).toBeDefined();
    const second = await list(
      `?limit=2&cursor=${new URL(first.body.next!).searchParams.get('cursor')}`,
    );
    expect(second.body.items?.map((r) => r.id)).toEqual(['c']);
    expect(second.body.next).toBeUndefined();
  });

  it('refuses a limit out of range and a cursor it did not issue', async () => {
    expect((await list('?limit=0')).res.status).toBe(400);
    expect((await list('?limit=101')).res.status).toBe(400);
    expect((await list('?cursor=not-a-cursor')).res.status).toBe(400);
  });

  it('applies forced filters over whatever the client asked for', async () => {
    const { body } = await list('?favourite=false', { favourite: 'true' });
    expect(body.items?.map((r) => r.id)).toEqual(['a']);
  });

  it('is an empty page for a person with no recipes', async () => {
    insertUser(raw, { id: 3, email: 'e@f.com' });
    const { body } = await list('', {}, 3);
    expect(body.items).toEqual([]);
  });
});
