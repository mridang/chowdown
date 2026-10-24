import { describe, expect, it, jest } from '@jest/globals';

import type { Database } from '@/core/db/client';
import type { User } from '@/lib/db/users';
import {
  recipesFolderOf,
  syncFromDrive,
  type DriveSyncDeps,
} from '@/lib/recipe/drive-sync';

const db = { fake: 'db' } as unknown as Database;

/** A user, with or without a remembered Recipes folder. */
const user = (folder: string | null) =>
  ({ id: 7, recipes_folder_id: folder }) as unknown as User;

/** Fake collaborators that record what they were asked, in order. */
function fakes(overrides: Partial<DriveSyncDeps> = {}) {
  const calls: string[] = [];
  const deps: DriveSyncDeps = {
    database: () => db,
    now: () => '2026-01-01T00:00:00.000Z',
    accessToken: async () => {
      calls.push('token');
      return 'tok';
    },
    ensureFolder: jest.fn(async () => {
      calls.push('ensureFolder');
      return 'new-folder';
    }),
    rememberFolder: jest.fn(async () => {
      calls.push('rememberFolder');
    }),
    listFiles: jest.fn(async () => {
      calls.push('list');
      return [
        { id: 'a', name: 'A.cook' },
        { id: 'b', name: 'B.cook' },
      ];
    }),
    syncTags: jest.fn(async () => {
      calls.push('syncTags');
    }),
    pruneRecipes: jest.fn(async () => {
      calls.push('pruneRecipes');
    }),
    pruneEmbeddings: jest.fn(async () => {
      calls.push('pruneEmbeddings');
    }),
    ...overrides,
  };
  return { deps, calls };
}

describe('syncFromDrive', () => {
  it('lists the folder, refreshes the tags, prunes, and counts the files', async () => {
    const { deps, calls } = fakes();
    expect(await syncFromDrive(user('folder'), deps)).toBe(2);
    expect(calls).toEqual([
      'token',
      'list',
      'syncTags',
      'pruneRecipes',
      'pruneEmbeddings',
    ]);
    expect(deps.listFiles).toHaveBeenCalledWith('folder', 'tok');
  });

  it('spares anything saved after the sync began when pruning', async () => {
    const { deps } = fakes();
    await syncFromDrive(user('folder'), deps);
    expect(deps.pruneRecipes).toHaveBeenCalledWith(
      expect.anything(),
      7,
      ['a', 'b'],
      '2026-01-01T00:00:00.000Z',
    );
    expect(deps.pruneEmbeddings).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it('creates and remembers the folder for a first-time user', async () => {
    const { deps, calls } = fakes();
    await syncFromDrive(user(null), deps);
    expect(calls.slice(0, 3)).toEqual([
      'token',
      'ensureFolder',
      'rememberFolder',
    ]);
    expect(deps.rememberFolder).toHaveBeenCalledWith(
      expect.anything(),
      7,
      'new-folder',
    );
    expect(deps.listFiles).toHaveBeenCalledWith('new-folder', 'tok');
  });

  it('touches nothing when Drive is not connected', async () => {
    const { deps } = fakes({
      accessToken: async () => {
        throw new Error('not connected');
      },
    });
    await expect(syncFromDrive(user('folder'), deps)).rejects.toThrow(
      'not connected',
    );
    expect(deps.listFiles).not.toHaveBeenCalled();
    expect(deps.pruneRecipes).not.toHaveBeenCalled();
  });

  it('does not prune when listing the folder fails', async () => {
    const { deps } = fakes({
      listFiles: async () => {
        throw new Error('Drive down');
      },
    });
    await expect(syncFromDrive(user('folder'), deps)).rejects.toThrow(
      'Drive down',
    );
    expect(deps.pruneRecipes).not.toHaveBeenCalled();
    expect(deps.pruneEmbeddings).not.toHaveBeenCalled();
  });
});

describe('recipesFolderOf', () => {
  it('uses the folder on record without asking Drive', async () => {
    const { deps } = fakes();
    expect(await recipesFolderOf(db, user('mine'), 'tok', deps)).toBe('mine');
    expect(deps.ensureFolder).not.toHaveBeenCalled();
    expect(deps.rememberFolder).not.toHaveBeenCalled();
  });
});
