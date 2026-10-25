import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { listRecipes } from '@/domain/api/recipe-list';
import { encodeCursor, type ApiResponse } from '@/lib/core/api';
import type { RecipeSummary } from '@/domain/api/recipe-resource';
import { APP_MIGRATIONS } from '../../lib/db/migrations';
import { installCloudflareContext, sqliteD1 } from '../../lib/db/sqlite-d1';
import { insertUser } from '../../lib/auth/session-fixture';

/** The page a successful list produced, or a thrown failure for a refusal. */
function pageOf(result: ApiResponse<unknown> | Response): {
  readonly items: readonly RecipeSummary[];
  readonly next: string | undefined;
  readonly cacheControl: string | undefined;
} {
  if (result instanceof Response) {
    throw new Error(`expected a page, got a ${result.status} response`);
  }
  const page = result.page;
  if (!page) {
    throw new Error('expected a page result');
  }
  const items = page.items as readonly RecipeSummary[];
  return {
    items,
    next: page.next ? encodeCursor(page.next) : undefined,
    cacheControl: result.headers?.['Cache-Control'],
  };
}

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

/** Call the list as person 1 and return the raw result (a page or a refusal). */
async function list(
  query = '',
  forced: Record<string, string> = {},
  userId = 1,
): Promise<ApiResponse<unknown> | Response> {
  return listRecipes(
    new Request(`https://chowdown.test/api/recipes${query}`),
    userId,
    forced,
  );
}

/** The ids of the recipes on a successful page. */
async function ids(
  query = '',
  forced: Record<string, string> = {},
  userId = 1,
): Promise<string[]> {
  return pageOf(await list(query, forced, userId)).items.map((r) => r.id);
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
    const page = pageOf(await list());
    expect(page.cacheControl).toBe('private, no-cache');
    expect(page.items.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(page.items.map((r) => r.favourite)).toEqual([true, false, false]);
  });

  it('refuses a favourite filter, which belongs to the favourites list', async () => {
    const res = await list('?favourite=true');
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('still lets the favourites list force its own favourite filter', async () => {
    expect(await ids('', { favourite: 'true' })).toEqual(['a']);
  });

  it('sorts by the sort parameter, newest first with a minus', async () => {
    expect(await ids('?sort=-modified_at')).toEqual(['a', 'b', 'c']);
    expect(await ids('?sort=modified_at')).toEqual(['c', 'b', 'a']);
  });

  it('refuses a sort it does not know', async () => {
    const res = await list('?sort=colour');
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });

  it('filters by the free-text query', async () => {
    expect(await ids('?q=carrot')).toEqual(['c']);
  });

  it('filters by source site', async () => {
    expect(await ids('?source_site=cakes.example.com')).toEqual(['c']);
  });

  it('pages with a cursor that carries on where the page ended', async () => {
    const first = pageOf(await list('?limit=2'));
    expect(first.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(first.next).toBeDefined();
    const second = pageOf(await list(`?limit=2&cursor=${first.next ?? ''}`));
    expect(second.items.map((r) => r.id)).toEqual(['c']);
    expect(second.next).toBeUndefined();
  });

  it('refuses a limit out of range and a cursor it did not issue', async () => {
    const status = async (query: string): Promise<number | undefined> => {
      const res = await list(query);
      return res instanceof Response ? res.status : undefined;
    };
    expect(await status('?limit=0')).toBe(400);
    expect(await status('?limit=101')).toBe(400);
    expect(await status('?cursor=not-a-cursor')).toBe(400);
  });

  it('applies forced filters over whatever the client asked for', async () => {
    expect(await ids('?favourite=false', { favourite: 'true' })).toEqual(['a']);
  });

  it('is an empty page for a person with no recipes', async () => {
    insertUser(raw, { id: 3, email: 'e@f.com' });
    expect(await ids('', {}, 3)).toEqual([]);
  });
});
