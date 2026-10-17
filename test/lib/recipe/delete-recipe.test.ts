import { describe, expect, it, jest } from '@jest/globals';

import {
  deleteRecipe,
  type DeleteDeps,
} from '../../../src/lib/recipe/delete-recipe';

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
