import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { recipesFolderFor } from '@/lib/drive/recipes-folder';
import { getUserById } from '@/lib/db/users';
import { getDatabase } from '@/lib/util';
import { insertUser } from '../auth/session-fixture';
import { APP_MIGRATIONS } from '../db/migrations';
import { installCloudflareContext, sqliteD1 } from '../db/sqlite-d1';

let raw: DatabaseSync;
let restore: () => void;

beforeEach(() => {
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1);
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

/** Answer Drive's folder lookup and folder creation, and report the calls. */
function drive(existing: readonly { id: string; name: string }[]) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ id: 'created-folder' }))
        : new Response(JSON.stringify({ files: existing })),
    );
}

const userWith = async (folder: string | null) => {
  insertUser(raw, { id: 1, recipes_folder_id: folder });
  const user = await getUserById(getDatabase(), 1);
  if (!user) {
    throw new Error('user not inserted');
  }
  return user;
};

describe('recipesFolderFor', () => {
  it('returns the remembered folder without asking Drive', async () => {
    const fetchSpy = drive([]);
    expect(await recipesFolderFor(await userWith('known'), 'tok')).toBe(
      'known',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('creates the folder once and remembers it on the user', async () => {
    const fetchSpy = drive([]);
    const user = await userWith(null);
    expect(await recipesFolderFor(user, 'tok')).toBe('created-folder');
    expect(
      raw
        .prepare('SELECT recipes_folder_id AS f FROM users WHERE id = 1')
        .get(),
    ).toEqual({ f: 'created-folder' });
    // The next call reads the remembered id instead of going back to Drive.
    const again = await getUserById(getDatabase(), 1);
    expect(await recipesFolderFor(again!, 'tok')).toBe('created-folder');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('adopts a folder the app already made rather than creating a second', async () => {
    const fetchSpy = drive([{ id: 'existing-folder', name: 'Recipes' }]);
    expect(await recipesFolderFor(await userWith(null), 'tok')).toBe(
      'existing-folder',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
