import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { DriveNotConnectedError } from '../../../../../src/lib/auth/drive-access';
import type { DriveFile } from '../../../../../src/lib/drive/drive-client';
import { installCloudflareContext } from '../../../../lib/db/sqlite-d1';

/** Who is signed in; null means nobody. */
const session: { user: { id: number } | null } = { user: { id: 7 } };

// The sign-in gate has its own tests (test/lib/api/auth.test.ts); here it just
// says who is calling, in the shape the routes read.
const { problems } = await import('../../../../../src/lib/api/problem');
jest.unstable_mockModule('../../../../../src/lib/api/auth', () => ({
  requireUser: async () =>
    session.user
      ? { ok: true, value: session.user }
      : { ok: false, response: problems.unauthorized() },
}));

const FILES: readonly DriveFile[] = [
  { id: 'f1', name: 'Lemon chicken.cook' },
  { id: 'f2', name: 'Pea soup.cook' },
] as unknown as readonly DriveFile[];

const getUserAccessToken = jest.fn<(user: unknown) => Promise<string>>(
  async () => 'token',
);
const listRecipeFiles = jest.fn<
  (folder: string, token: string) => Promise<readonly DriveFile[]>
>(async () => FILES);
const recipesFolderFor = jest.fn(async () => 'folder-1');
const embedText = jest.fn<(env: unknown, text: string) => Promise<number[]>>(
  async () => [0.1, 0.2],
);
const ensureEmbeddings = jest.fn(async () => [] as unknown[]);
const topSimilar = jest.fn<
  (
    rows: unknown,
    vector: unknown,
    files: readonly DriveFile[],
    limit: number,
  ) => readonly DriveFile[]
>((_rows, _vector, files) => files.slice(0, 1));

jest.unstable_mockModule(
  '../../../../../src/lib/auth/user-access-token',
  () => ({
    getUserAccessToken,
  }),
);
jest.unstable_mockModule('../../../../../src/lib/drive/drive-client', () => ({
  listRecipeFiles,
}));
jest.unstable_mockModule('../../../../../src/lib/drive/recipes-folder', () => ({
  recipesFolderFor,
}));
jest.unstable_mockModule('../../../../../src/lib/recipe/embeddings', () => ({
  embedText,
}));
jest.unstable_mockModule('../../../../../src/lib/recipe/similar', () => ({
  ensureEmbeddings,
  topSimilar,
}));

const { GET } =
  await import('../../../../../src/app/api/recipes/suggestions/route');

let restore: () => void;

beforeEach(() => {
  session.user = { id: 7 };
  jest.clearAllMocks();
  restore = installCloudflareContext({} as D1Database);
});

afterEach(() => restore());

const ask = (query: string) =>
  GET(new Request(`https://chowdown.test/api/recipes/suggestions?${query}`));

describe('GET /api/recipes/suggestions', () => {
  it('answers 401 when nobody is signed in, touching nothing', async () => {
    session.user = null;
    expect((await ask('q=soup')).status).toBe(401);
    expect(getUserAccessToken).not.toHaveBeenCalled();
    expect(embedText).not.toHaveBeenCalled();
  });

  it.each([
    ['q is required', ''],
    ['q is blank', 'q=%20%20'],
  ])('answers 400 when %s', async (_name, query) => {
    expect((await ask(query)).status).toBe(400);
    expect(embedText).not.toHaveBeenCalled();
  });

  it('answers 400 to a wish over 300 characters, before the model sees it', async () => {
    const res = await ask(`q=${'x'.repeat(301)}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      detail: 'q must be at most 300 characters.',
    });
    expect(getUserAccessToken).not.toHaveBeenCalled();
    expect(embedText).not.toHaveBeenCalled();
  });

  it('accepts a wish of exactly 300 characters', async () => {
    expect((await ask(`q=${'x'.repeat(300)}`)).status).toBe(200);
  });

  it.each(['limit=0', 'limit=101', 'limit=x'])(
    'answers 400 to %s',
    async (limit) => {
      expect((await ask(`q=soup&${limit}`)).status).toBe(400);
      expect(embedText).not.toHaveBeenCalled();
    },
  );

  it('ranks the recipes by the wish and answers with ids and titles', async () => {
    const res = await ask('q=something%20light%20with%20chicken&limit=3');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(await res.json()).toMatchObject({
      items: [{ id: 'f1', title: 'Lemon chicken' }],
    });
    expect(embedText.mock.calls[0]?.[1]).toBe('something light with chicken');
    expect(topSimilar.mock.calls[0]?.[3]).toBe(3);
    expect(listRecipeFiles).toHaveBeenCalledWith('folder-1', 'token');
  });

  it('answers 409 when Drive is not connected', async () => {
    getUserAccessToken.mockRejectedValueOnce(new DriveNotConnectedError());
    const res = await ask('q=soup');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      type: '/problems/drive-not-connected',
    });
  });

  it('answers 502 when Drive or the model fails, without their words', async () => {
    embedText.mockRejectedValueOnce(new Error('AiError: 3040 for account 99'));
    const res = await ask('q=soup');
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/AiError|99/);
  });
});
