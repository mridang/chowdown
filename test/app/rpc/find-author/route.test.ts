import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { DriveNotConnectedError } from '../../../../src/lib/auth/drive-access';
import { DAILY_BUDGETS } from '../../../../src/lib/util/daily-budget';
import { APP_MIGRATIONS } from '../../../lib/db/migrations';
import { installCloudflareContext, sqliteD1 } from '../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { user: { id: number } | null } = { user: { id: 7 } };

const { problems } = await import('../../../../src/lib/api/problem');
jest.unstable_mockModule('../../../../src/lib/api/auth', () => ({
  requireUser: async () =>
    session.user
      ? { ok: true, value: session.user }
      : { ok: false, response: problems.unauthorized() },
}));

const WITHOUT =
  '>> title: Soup\n>> source: https://a.test/soup\n\nBoil @water{1%l}.\n';
const WITH_AUTHOR = `${WITHOUT}>> author: Jane Cook\n`;

/** What each Drive file holds, by id. */
const files = new Map<string, string>();
const getUserAccessToken = jest.fn<(user: unknown) => Promise<string>>(
  async () => 'token',
);
const getFileContent = jest.fn<(id: string, token: string) => Promise<string>>(
  async (id) => files.get(id) ?? '',
);
const updateRecipeFile = jest.fn<
  (id: string, source: string, token: string) => Promise<undefined>
>(async () => undefined);
const indexRecipeWrite = jest.fn<
  (
    db: unknown,
    uid: number,
    id: string,
    name: string,
    source: string,
  ) => Promise<undefined>
>(async () => undefined);
/** The author the lookup finds for a recipe's source, or null for none. */
const found: { author: string | null } = { author: 'Maunika Gowardhan' };
const addMissingAuthor = jest.fn(async (source: string) =>
  found.author ? `${source}>> author: ${found.author}\n` : source,
);

jest.unstable_mockModule('../../../../src/lib/auth/current-user', () => ({
  getUserAccessToken,
}));
jest.unstable_mockModule('../../../../src/lib/drive/drive-client', () => ({
  getFileContent,
  updateRecipeFile,
}));
jest.unstable_mockModule('../../../../src/lib/recipe/tag-index', () => ({
  indexRecipeWrite,
}));
jest.unstable_mockModule('../../../../src/lib/recipe/to-cooklang', () => ({
  addMissingAuthor,
}));

const { GET, POST } = await import('../../../../src/app/rpc/find-author/route');

let raw: DatabaseSync;
let restore: () => void;

/** Add a recipe row for a user. */
function recipe(user: number, id: string, source: string): void {
  raw
    .prepare(
      "INSERT INTO recipes (user_id, drive_file_id, name, source, source_url, first_opened_at, last_opened_at) VALUES (?, ?, ?, ?, ?, 't', 't')",
    )
    .run(
      user,
      id,
      `${id}.cook`,
      source,
      /source:/.test(source) ? 'https://a.test/soup' : '',
    );
  files.set(id, source);
}

beforeEach(() => {
  session.user = { id: 7 };
  found.author = 'Maunika Gowardhan';
  files.clear();
  jest.clearAllMocks();
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  raw.exec(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 's7', 'a@b.c', 't', 't'), (8, 's8', 'd@e.f', 't', 't')",
  );
});

afterEach(() => restore());

const post = (body: string) =>
  POST(
    new Request('https://chowdown.test/rpc/find-author', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }),
  );
const get = (query = '') =>
  GET(new Request(`https://chowdown.test/rpc/find-author${query}`));

describe('POST /rpc/find-author', () => {
  it('answers 401 when nobody is signed in, without looking anything up', async () => {
    session.user = null;
    expect((await post('{"recipe_id":"a"}')).status).toBe(401);
    expect(addMissingAuthor).not.toHaveBeenCalled();
  });

  it.each(['{}', '{"recipe_id":""}', '{"recipe_id":5}'])(
    'answers 400 to %s',
    async (body) => {
      expect((await post(body)).status).toBe(400);
    },
  );

  it('answers 404 for a recipe the user does not have, and never touches Drive for it', async () => {
    recipe(8, 'theirs', WITHOUT);
    expect((await post('{"recipe_id":"theirs"}')).status).toBe(404);
    expect(getFileContent).not.toHaveBeenCalled();
  });

  it('writes the author it finds onto the file and into the cache', async () => {
    recipe(7, 'mine', WITHOUT);
    const res = await post('{"recipe_id":"mine"}');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      author: 'Maunika Gowardhan',
      saved: true,
    });
    expect(updateRecipeFile).toHaveBeenCalledWith(
      'mine',
      expect.stringContaining('>> author: Maunika Gowardhan'),
      'token',
    );
    expect(indexRecipeWrite).toHaveBeenCalled();
  });

  it('writes nothing when no credible name is found', async () => {
    recipe(7, 'mine', WITHOUT);
    found.author = null;
    const res = await post('{"recipe_id":"mine"}');
    expect(await res.json()).toEqual({ author: null, saved: false });
    expect(updateRecipeFile).not.toHaveBeenCalled();
  });

  it('leaves a recipe that already has an author alone and says who', async () => {
    recipe(7, 'mine', WITH_AUTHOR);
    const res = await post('{"recipe_id":"mine"}');
    expect(await res.json()).toEqual({ author: 'Jane Cook', saved: false });
    expect(addMissingAuthor).not.toHaveBeenCalled();
    expect(updateRecipeFile).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After once the day's lookups are used, before looking anything up", async () => {
    recipe(7, 'mine', WITHOUT);
    for (let i = 0; i < DAILY_BUDGETS.author.limit; i += 1) {
      expect((await post('{"recipe_id":"mine"}')).status).toBe(200);
    }
    addMissingAuthor.mockClear();
    const res = await post('{"recipe_id":"mine"}');
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(addMissingAuthor).not.toHaveBeenCalled();
  });

  it('answers 409 when Drive is not connected and 502 when it fails, changing nothing', async () => {
    recipe(7, 'mine', WITHOUT);
    getUserAccessToken.mockRejectedValueOnce(new DriveNotConnectedError());
    expect((await post('{"recipe_id":"mine"}')).status).toBe(409);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getFileContent.mockRejectedValueOnce(new Error('drive down'));
    expect((await post('{"recipe_id":"mine"}')).status).toBe(502);
    spy.mockRestore();
    expect(updateRecipeFile).not.toHaveBeenCalled();
  });
});

describe('GET /rpc/find-author', () => {
  it('answers 401 when nobody is signed in', async () => {
    session.user = null;
    expect((await get()).status).toBe(401);
  });

  it('looks up the next few recipes without an author, in a stable order, and says where to go on', async () => {
    for (const id of ['c', 'a', 'b', 'd', 'e']) {
      recipe(7, id, WITHOUT);
    }
    const first = await (await get('?limit=2')).json();
    expect(first).toEqual({ processed: 2, found: 2, remaining: 3, next: 'b' });
    const second = await (await get('?limit=2&after=b')).json();
    expect(second).toEqual({ processed: 2, found: 2, remaining: 1, next: 'd' });
    const third = await (await get('?limit=2&after=d')).json();
    expect(third).toEqual({ processed: 1, found: 1, remaining: 0, next: null });
  });

  it('skips recipes that have an author, have no source page, or belong to someone else', async () => {
    recipe(7, 'has', WITH_AUTHOR);
    recipe(7, 'nosource', '>> title: Soup\n\nBoil.\n');
    recipe(8, 'theirs', WITHOUT);
    recipe(7, 'wanted', WITHOUT);
    const body = await (await get()).json();
    expect(body).toEqual({ processed: 1, found: 1, remaining: 0, next: null });
    expect(getFileContent).toHaveBeenCalledTimes(1);
  });

  it('counts only the lookups that found a name', async () => {
    recipe(7, 'a', WITHOUT);
    recipe(7, 'b', WITHOUT);
    found.author = null;
    expect(await (await get()).json()).toMatchObject({
      processed: 2,
      found: 0,
      remaining: 0,
    });
  });

  it('does nothing, and does not ask Google for a token, when there is nothing to do', async () => {
    recipe(7, 'has', WITH_AUTHOR);
    expect(await (await get()).json()).toEqual({
      processed: 0,
      found: 0,
      remaining: 0,
      next: null,
    });
    expect(getUserAccessToken).not.toHaveBeenCalled();
  });

  it.each([
    ['', 3],
    ['?limit=0', 1],
    ['?limit=99', 5],
    ['?limit=x', 3],
  ])('looks at the right number of recipes for %p', async (query, expected) => {
    for (let i = 0; i < 8; i += 1) {
      recipe(7, `r${i}`, WITHOUT);
    }
    const body = (await (await get(query)).json()) as { processed: number };
    expect(body.processed).toBe(expected);
  });

  it("stops with 429 when the day's lookups run out part way through a batch", async () => {
    for (let i = 0; i < 5; i += 1) {
      recipe(7, `r${i}`, WITHOUT);
    }
    raw
      .prepare(
        'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)',
      )
      .run(
        `${DAILY_BUDGETS.author.name}:u:7`,
        Math.floor(Date.now() / 1000),
        DAILY_BUDGETS.author.limit - 1,
      );
    const res = await get('?limit=3');
    expect(res.status).toBe(429);
    expect(updateRecipeFile).toHaveBeenCalledTimes(1);
  });

  it('answers 409 when Drive is not connected', async () => {
    recipe(7, 'a', WITHOUT);
    getUserAccessToken.mockRejectedValueOnce(new DriveNotConnectedError());
    expect((await get()).status).toBe(409);
  });
});
