import { describe, expect, it, jest } from '@jest/globals';

import type { Database } from '../../../src/lib/db/client';
import type { User } from '../../../src/lib/db/users';
import {
  setFavouriteAndTag,
  type FavouriteDeps,
} from '../../../src/lib/recipe/favourite';

const db = {} as Database;

/** A user with or without a Drive connection. */
const user = (token: string | null) =>
  ({ id: 3, refresh_token_enc: token }) as unknown as User;

/** Fake collaborators; `background` work is collected to await in the test. */
function fakes(
  options: {
    user?: User | undefined;
    file?: string;
    row?: { name: string } | undefined;
  } = {},
) {
  const background: Promise<unknown>[] = [];
  const hasUser = 'user' in options;
  const deps: FavouriteDeps = {
    database: () => db,
    saveHeart: jest.fn<FavouriteDeps['saveHeart']>(
      async (_db, _uid, _id, on) => on,
    ),
    findUser: async () => (hasUser ? options.user : user('sealed')),
    accessToken: async () => 'tok',
    readFile: jest.fn(async () => options.file ?? '>> title: A\n\nCook.\n'),
    writeFile: jest.fn(async () => undefined),
    findRecipe: async () =>
      'row' in options ? options.row : { name: 'A.cook' },
    index: jest.fn(async () => undefined),
    background: (work) => {
      background.push(work);
    },
  };
  return { deps, settle: () => Promise.all(background) };
}

describe('setFavouriteAndTag', () => {
  it('answers from the table straight away and mirrors the marker later', async () => {
    const { deps, settle } = fakes();
    expect(await setFavouriteAndTag(3, 'f1', true, deps)).toBe(true);
    expect(deps.saveHeart).toHaveBeenCalledWith(db, 3, 'f1', true);
    // The file is only touched by the queued background work.
    expect(deps.writeFile).not.toHaveBeenCalled();
    await settle();
    expect(deps.writeFile).toHaveBeenCalledWith(
      'f1',
      expect.stringContaining('>> favourite: true'),
      'tok',
    );
  });

  it('refreshes the cache without re-embedding after writing the marker', async () => {
    const { deps, settle } = fakes();
    await setFavouriteAndTag(3, 'f1', true, deps);
    await settle();
    expect(deps.index).toHaveBeenCalledWith(
      db,
      3,
      'f1',
      'A.cook',
      expect.stringContaining('>> favourite: true'),
    );
  });

  it('removes the marker when un-hearting', async () => {
    const { deps, settle } = fakes({
      file: '>> title: A\n>> favourite: true\n\nCook.\n',
    });
    expect(await setFavouriteAndTag(3, 'f1', false, deps)).toBe(false);
    await settle();
    expect(deps.writeFile).toHaveBeenCalledWith(
      'f1',
      '>> title: A\n\nCook.\n',
      'tok',
    );
  });

  it('leaves the file alone when it already says the right thing', async () => {
    const { deps, settle } = fakes({ file: '>> favourite: true\n\nCook.\n' });
    await setFavouriteAndTag(3, 'f1', true, deps);
    await settle();
    expect(deps.writeFile).not.toHaveBeenCalled();
    expect(deps.index).not.toHaveBeenCalled();
  });

  it('keeps the heart in the app only for someone without Drive', async () => {
    const { deps, settle } = fakes({ user: user(null) });
    expect(await setFavouriteAndTag(3, 'f1', true, deps)).toBe(true);
    await settle();
    expect(deps.readFile).not.toHaveBeenCalled();
    expect(deps.writeFile).not.toHaveBeenCalled();
  });

  it('does nothing in Drive when the account has gone', async () => {
    const { deps, settle } = fakes({ user: undefined });
    await setFavouriteAndTag(3, 'f1', true, deps);
    await settle();
    expect(deps.readFile).not.toHaveBeenCalled();
  });

  it('skips the cache refresh for a recipe that is not cached', async () => {
    const { deps, settle } = fakes({ row: undefined });
    await setFavouriteAndTag(3, 'f1', true, deps);
    await settle();
    expect(deps.writeFile).toHaveBeenCalled();
    expect(deps.index).not.toHaveBeenCalled();
  });
});
