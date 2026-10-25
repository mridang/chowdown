import { describe, expect, it, jest } from '@jest/globals';

import type { Database } from '@/domain/db/client';
import type { User } from '@/domain/db/users';
import {
  deleteRecipe,
  deleteRecipeForUser,
  type DeleteDeps,
  type DeleteLiveDeps,
} from '@/domain/recipe/delete-recipe';

/** Fake dependencies; `overrides` swap individual behaviours. */
function deps(overrides: Partial<DeleteDeps> = {}) {
  const calls = {
    owns: jest.fn<DeleteDeps['owns']>(async () => true),
    trash: jest.fn<DeleteDeps['trash']>(async () => 'trashed'),
    forget: jest.fn<DeleteDeps['forget']>(async () => undefined),
  };
  return { ...calls, ...overrides, calls } as DeleteDeps & {
    calls: typeof calls;
  };
}

describe('deleteRecipe', () => {
  it('trashes the Drive file, then forgets the cache', async () => {
    const d = deps();
    expect(await deleteRecipe(d, 'abc')).toBe('deleted');
    expect(d.calls.trash).toHaveBeenCalledWith('abc');
    expect(d.calls.forget).toHaveBeenCalledWith('abc');
  });

  it('touches nothing for a recipe the user does not have', async () => {
    const d = deps({ owns: async () => false });
    expect(await deleteRecipe(d, 'abc')).toBe('not-found');
    expect(d.calls.trash).not.toHaveBeenCalled();
    expect(d.calls.forget).not.toHaveBeenCalled();
  });

  it('still cleans the cache when the Drive file is already gone', async () => {
    const d = deps({ trash: async () => 'missing' });
    expect(await deleteRecipe(d, 'abc')).toBe('deleted');
    expect(d.calls.forget).toHaveBeenCalledWith('abc');
  });

  it('keeps the cache when Drive refuses, so the recipe stays visible', async () => {
    const d = deps({
      trash: async () => {
        throw new Error('Trash file failed: 403');
      },
    });
    await expect(deleteRecipe(d, 'abc')).rejects.toThrow('403');
    expect(d.calls.forget).not.toHaveBeenCalled();
  });
});

describe('deleteRecipeForUser', () => {
  const db = {} as Database;
  const user = { id: 5 } as unknown as User;

  /** Fake collaborators; the user owns the ids in `owned`. */
  function liveDeps(owned: readonly string[] = ['abc']) {
    const calls: string[] = [];
    const deps: DeleteLiveDeps = {
      database: () => db,
      accessToken: async () => 'tok',
      findRecipe: async (_db, _uid, id) =>
        owned.includes(id) ? {} : undefined,
      trashFile: jest.fn<DeleteLiveDeps['trashFile']>(async () => {
        calls.push('trash');
        return 'trashed' as const;
      }),
      deleteData: jest.fn<DeleteLiveDeps['deleteData']>(async () => {
        calls.push('deleteData');
      }),
      refreshSimilar: jest.fn<DeleteLiveDeps['refreshSimilar']>(async () => {
        calls.push('refreshSimilar');
      }),
    };
    return { deps, calls };
  }

  it('trashes the file, then forgets the cache and refreshes similar lists', async () => {
    const { deps, calls } = liveDeps();
    expect(await deleteRecipeForUser(user, 'abc', deps)).toBe('deleted');
    expect(calls).toEqual(['trash', 'deleteData', 'refreshSimilar']);
    expect(deps.trashFile).toHaveBeenCalledWith('abc', 'tok');
    expect(deps.deleteData).toHaveBeenCalledWith(expect.anything(), 5, 'abc');
    expect(deps.refreshSimilar).toHaveBeenCalledWith(expect.anything(), 5);
  });

  it('touches nothing for a recipe the user does not have', async () => {
    const { deps, calls } = liveDeps([]);
    expect(await deleteRecipeForUser(user, 'abc', deps)).toBe('not-found');
    expect(calls).toEqual([]);
  });
});
