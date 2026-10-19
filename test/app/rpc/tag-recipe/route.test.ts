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
import { APP_MIGRATIONS } from '../../../lib/db/migrations';
import { installCloudflareContext, sqliteD1 } from '../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { user: { id: number } | null } = { user: { id: 7 } };

// The sign-in gate has its own tests (test/lib/api/auth.test.ts); here it just
// says who is calling, in the shape the routes read.
const { problems } = await import('../../../../src/lib/api/problem');
jest.unstable_mockModule('../../../../src/lib/api/auth', () => ({
  requireUser: async () =>
    session.user
      ? { ok: true, value: session.user }
      : { ok: false, response: problems.unauthorized() },
}));

const ORIGINAL = '>> title: Soup\n\nBoil @water{1%l}.\n';
const getUserAccessToken = jest.fn<(user: unknown) => Promise<string>>(
  async () => 'token',
);
const getFileContent = jest.fn<(id: string, token: string) => Promise<string>>(
  async () => ORIGINAL,
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
const tagCookSource = jest.fn<
  (
    source: string,
    filename: string,
    env: unknown,
  ) => Promise<{
    source: string;
    tags: readonly (readonly [string, string])[];
  }>
>(async (source) => ({
  source: `${source}>> cuisine: Thai\n`,
  tags: [['cuisine', 'Thai']],
}));
const addMissingCover = jest.fn(async (source: string) => source);

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
jest.unstable_mockModule('../../../../src/lib/recipe/tagging', () => ({
  tagCookSource,
}));
jest.unstable_mockModule('../../../../src/lib/recipe/to-cooklang', () => ({
  addMissingCover,
}));

const { POST } = await import('../../../../src/app/rpc/tag-recipe/route');

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  session.user = { id: 7 };
  jest.clearAllMocks();
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
  raw.exec(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (7, 's7', 'a@b.c', 't', 't'), (8, 's8', 'd@e.f', 't', 't')",
  );
  const insert = raw.prepare(
    "INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at) VALUES (?, ?, ?, ?, 't', 't')",
  );
  insert.run(7, 'mine', 'Soup.cook', ORIGINAL);
  insert.run(8, 'theirs', 'Stew.cook', ORIGINAL);
});

afterEach(() => restore());

/** A POST with the given body text. */
const post = (
  body: string,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) =>
  POST(
    new Request('https://chowdown.test/rpc/tag-recipe', {
      method: 'POST',
      headers,
      body,
    }),
  );

/** A POST of `{ recipe_id }`. */
const tag = (id: unknown) => post(JSON.stringify({ recipe_id: id }));

describe('POST /rpc/tag-recipe', () => {
  it('answers 401 when nobody is signed in, touching nothing', async () => {
    session.user = null;
    expect((await tag('mine')).status).toBe(401);
    expect(getUserAccessToken).not.toHaveBeenCalled();
  });

  it('answers 415 to a body that is not JSON', async () => {
    expect(
      (await post('recipe_id=mine', { 'content-type': 'text/plain' })).status,
    ).toBe(415);
  });

  it('answers 413 to a body over the limit', async () => {
    expect((await tag('x'.repeat(300_000))).status).toBe(413);
    expect(getUserAccessToken).not.toHaveBeenCalled();
  });

  it.each([
    ['text that is not JSON', '{nope'],
    ['no recipe_id', '{}'],
    ['a recipe_id that is not text', '{"recipe_id":5}'],
    ['an empty recipe_id', '{"recipe_id":""}'],
    ['a body that is not an object', '[]'],
  ])('answers 400 to %s', async (_name, body) => {
    expect((await post(body)).status).toBe(400);
    expect(getUserAccessToken).not.toHaveBeenCalled();
  });

  it("answers 404 for another person's recipe or an unknown one, never touching Drive", async () => {
    expect((await tag('theirs')).status).toBe(404);
    expect((await tag('nope')).status).toBe(404);
    expect(getUserAccessToken).not.toHaveBeenCalled();
    expect(getFileContent).not.toHaveBeenCalled();
    expect(updateRecipeFile).not.toHaveBeenCalled();
  });

  it('writes the tags to the file and the index, and says which', async () => {
    const res = await tag('mine');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tagged: true,
      tags: [['cuisine', 'Thai']],
    });
    expect(updateRecipeFile).toHaveBeenCalledWith(
      'mine',
      `${ORIGINAL}>> cuisine: Thai\n`,
      'token',
    );
    expect(indexRecipeWrite.mock.calls[0]?.slice(1)).toEqual([
      7,
      'mine',
      'Soup.cook',
      `${ORIGINAL}>> cuisine: Thai\n`,
    ]);
  });

  it('writes a missing cover even when nothing could be tagged', async () => {
    tagCookSource.mockResolvedValueOnce({ source: ORIGINAL, tags: [] });
    addMissingCover.mockResolvedValueOnce(
      `${ORIGINAL}>> images: https://a.com/p.jpg\n`,
    );
    const res = await tag('mine');
    expect(await res.json()).toEqual({ tagged: true, tags: [] });
    expect(updateRecipeFile).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when nothing could be tagged and there is no cover to add', async () => {
    tagCookSource.mockResolvedValueOnce({ source: ORIGINAL, tags: [] });
    const res = await tag('mine');
    expect(await res.json()).toEqual({ tagged: false, tags: [] });
    expect(updateRecipeFile).not.toHaveBeenCalled();
    expect(indexRecipeWrite).not.toHaveBeenCalled();
  });

  it('answers 409 when Drive is not connected', async () => {
    getUserAccessToken.mockRejectedValueOnce(new DriveNotConnectedError());
    const res = await tag('mine');
    expect(res.status).toBe(409);
    expect(updateRecipeFile).not.toHaveBeenCalled();
  });

  it('answers 502 when Drive fails, and changes nothing', async () => {
    getFileContent.mockRejectedValueOnce(new Error('Drive 500'));
    const res = await tag('mine');
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('Drive 500');
    expect(updateRecipeFile).not.toHaveBeenCalled();
    expect(indexRecipeWrite).not.toHaveBeenCalled();
  });
});
