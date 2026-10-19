import { describe, expect, it } from '@jest/globals';

import {
  isFavourite,
  listFavouriteIds,
  setFavourite,
} from '../../../src/lib/db/favourites';
import { fakeDb } from './fake-db';

describe('isFavourite', () => {
  it('is true when the heart is there', async () => {
    const { db } = fakeDb({
      findFirst: { favourites: { drive_file_id: 'a' } },
    });
    expect(await isFavourite(db, 1, 'a')).toBe(true);
  });

  it('is false when it is not', async () => {
    const { db } = fakeDb({ findFirst: { favourites: undefined } });
    expect(await isFavourite(db, 1, 'a')).toBe(false);
  });
});

describe('listFavouriteIds', () => {
  it('lists the recipe ids the user has hearted', async () => {
    const { db } = fakeDb({
      findMany: {
        favourites: [{ drive_file_id: 'a' }, { drive_file_id: 'b' }],
      },
    });
    expect(await listFavouriteIds(db, 1)).toEqual(['a', 'b']);
  });
});

describe('setFavourite', () => {
  it('adds a heart without minding one that is already there', async () => {
    const { db, calls } = fakeDb();
    expect(await setFavourite(db, 1, 'a', true)).toBe(true);
    expect(calls.some((c) => c.method === 'onConflictDoNothing')).toBe(true);
    expect(calls.find((c) => c.method === 'values')?.args[0]).toMatchObject({
      user_id: 1,
      drive_file_id: 'a',
    });
  });

  it('removes a heart, and reports it gone', async () => {
    const { db, calls } = fakeDb();
    expect(await setFavourite(db, 1, 'a', false)).toBe(false);
    expect(calls.some((c) => c.method === 'delete')).toBe(true);
    expect(calls.some((c) => c.method === 'insert')).toBe(false);
  });
});
