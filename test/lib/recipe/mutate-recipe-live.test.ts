import { describe, expect, it, jest } from '@jest/globals';

import type { Database } from '../../../src/lib/db/client';
import type { User } from '../../../src/lib/db/users';
import {
  mutateRecipeForUser,
  type MutateLiveDeps,
} from '../../../src/lib/recipe/mutate-recipe-live';

const db = {} as Database;
const user = { id: 4 } as unknown as User;

/** An edit that appends a line, or one that changes nothing. */
const append = (current: string) => ({
  ok: true as const,
  source: `${current}more\n`,
  value: 'v',
});
const unchanged = (current: string) => ({
  ok: true as const,
  source: current,
  value: 'same',
});

/** Fake collaborators: a Drive holding `files`, and the recipes the user owns. */
function fakes(
  files: Record<string, string>,
  owned: readonly string[] = Object.keys(files),
  overrides: Partial<MutateLiveDeps> = {},
) {
  const deps: MutateLiveDeps = {
    database: () => db,
    accessToken: async () => 'tok',
    findRecipe: async (_db, _uid, id) =>
      owned.includes(id) ? { name: `${id}.cook` } : undefined,
    readFile: jest.fn(async (id: string) => {
      const text = files[id];
      if (text === undefined) {
        throw new Error(`Drive GET /files/${id} -> 404 not found`);
      }
      return text;
    }),
    writeFile: jest.fn(async () => undefined),
    index: jest.fn(async () => undefined),
    ...overrides,
  };
  return deps;
}

describe('mutateRecipeForUser', () => {
  it('writes the edit to Drive and refreshes the cache under the recipe name', async () => {
    const deps = fakes({ a: 'one\n' });
    const out = await mutateRecipeForUser(user, 'a', null, append, deps);
    expect(out).toMatchObject({ kind: 'done', source: 'one\nmore\n' });
    expect(deps.writeFile).toHaveBeenCalledWith('a', 'one\nmore\n', 'tok');
    expect(deps.index).toHaveBeenCalledWith(
      db,
      4,
      'a',
      'a.cook',
      'one\nmore\n',
    );
  });

  it('writes nothing for an edit that changes nothing', async () => {
    const deps = fakes({ a: 'one\n' });
    expect(
      await mutateRecipeForUser(user, 'a', null, unchanged, deps),
    ).toMatchObject({ kind: 'done' });
    expect(deps.writeFile).not.toHaveBeenCalled();
    expect(deps.index).not.toHaveBeenCalled();
  });

  it('is not found for a recipe the user does not own, without reading Drive', async () => {
    const deps = fakes({ a: 'x' }, []);
    expect(await mutateRecipeForUser(user, 'a', null, append, deps)).toEqual({
      kind: 'not-found',
    });
    expect(deps.readFile).not.toHaveBeenCalled();
  });

  it('is not found when the file has gone from Drive', async () => {
    const deps = fakes({}, ['a']);
    expect(await mutateRecipeForUser(user, 'a', null, append, deps)).toEqual({
      kind: 'not-found',
    });
  });

  it('passes on any other Drive failure', async () => {
    const deps = fakes({}, ['a'], {
      readFile: async () => {
        throw new Error('Drive GET -> 500 boom');
      },
    });
    await expect(
      mutateRecipeForUser(user, 'a', null, append, deps),
    ).rejects.toThrow('500');
  });

  it('refuses a stale If-Match without writing', async () => {
    const deps = fakes({ a: 'one\n' });
    expect(
      await mutateRecipeForUser(user, 'a', '"stale"', append, deps),
    ).toEqual({ kind: 'precondition-failed' });
    expect(deps.writeFile).not.toHaveBeenCalled();
  });

  it('indexes under the file id when the cached row has vanished mid-write', async () => {
    let lookups = 0;
    const deps = fakes({ a: 'one\n' }, ['a'], {
      findRecipe: async () =>
        ++lookups === 1 ? { name: 'a.cook' } : undefined,
    });
    await mutateRecipeForUser(user, 'a', null, append, deps);
    expect(deps.index).toHaveBeenCalledWith(db, 4, 'a', 'a', 'one\nmore\n');
  });
});
