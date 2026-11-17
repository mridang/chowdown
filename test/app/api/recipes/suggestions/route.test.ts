import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../../../lib/core/db/sqlite-d1';
import type { DriveFile } from '@/lib/google/drive';

const AI_ERROR = /AiError|99/u;

/** Who is signed in; null means nobody. */
interface SessionState {
  user: { id: number } | null;
}

const session: SessionState = { user: { id: 7 } };

// The sign-in gate has its own tests (test/lib/api/auth.test.ts); here it just
// says who is calling, in the shape the routes read.
const { problems } = await import('@/lib/core/api');
// eslint-disable-next-line tslop/no-module-mocking -- @/domain/api/auth is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/domain/api/auth', () => ({
  requireUser: async () =>
    session.user
      ? { ok: true, value: session.user }
      : { ok: false, response: problems.unauthorized() },
}));

const FILES: readonly DriveFile[] = [
  { id: 'f1', name: 'Lemon chicken.cook' },
  { id: 'f2', name: 'Pea soup.cook' },
];

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

// eslint-disable-next-line tslop/no-module-mocking -- @/domain/auth/user-access-token is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/domain/auth/user-access-token', () => ({
  getUserAccessToken,
}));
// eslint-disable-next-line tslop/no-module-mocking -- @/domain/drive/recipe-files is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/domain/drive/recipe-files', () => ({
  listRecipeFiles,
}));
// eslint-disable-next-line tslop/no-module-mocking -- @/domain/drive/recipes-folder is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/domain/drive/recipes-folder', () => ({
  recipesFolderFor,
}));
// eslint-disable-next-line tslop/no-module-mocking -- @/domain/recipe/embeddings is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/domain/recipe/embeddings', () => ({
  embedText,
}));
// eslint-disable-next-line tslop/no-module-mocking -- @/domain/recipe/similar is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/domain/recipe/similar', () => ({
  ensureEmbeddings,
  topSimilar,
}));

const { GET } = await import('@/app/api/recipes/suggestions/route');

let restore: () => void;

beforeEach(() => {
  session.user = { id: 7 };
  jest.clearAllMocks();
  restore = installCloudflareContext(sqliteD1().d1);
});

afterEach(() => restore());

const ask = async (query: string) =>
  GET(new Request(`https://chowdown.test/api/recipes/suggestions?${query}`));

describe('GET /api/recipes/suggestions', () => {
  it('answers 401 when nobody is signed in, touching nothing', async () => {
    session.user = null;
    const res = await ask('q=soup');
    expect(res.status).toBe(401);
    expect(getUserAccessToken).not.toHaveBeenCalled();
    expect(embedText).not.toHaveBeenCalled();
  });

  it.each([
    ['q is required', ''],
    ['q is blank', 'q=%20%20'],
  ])('answers 400 when %s', async (_name, query) => {
    const res = await ask(query);
    expect(res.status).toBe(400);
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
    const res = await ask(`q=${'x'.repeat(300)}`);
    expect(res.status).toBe(200);
  });

  it.each(['limit=0', 'limit=101', 'limit=x'])(
    'answers 400 to %s',
    async (limit) => {
      const res = await ask(`q=soup&${limit}`);
      expect(res.status).toBe(400);
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
    expect(JSON.stringify(await res.json())).not.toMatch(AI_ERROR);
  });
});
