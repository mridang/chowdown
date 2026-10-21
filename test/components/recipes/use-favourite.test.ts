import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  favouriteUrl,
  saveFavourite,
} from '../../../src/components/recipes/use-favourite';
import {
  getFavouriteOverride,
  resetFavouriteOverrides,
} from '../../../src/lib/favourites-store';

type Send = NonNullable<Parameters<typeof saveFavourite>[2]>;

beforeEach(() => {
  resetFavouriteOverrides();
});

describe('favouriteUrl', () => {
  it('addresses the recipe under the signed-in user', () => {
    expect(favouriteUrl('abc')).toBe('/api/users/self/favourites/abc');
  });
});

describe('saveFavourite', () => {
  it('favouriting creates the resource and keeps the heart on', async () => {
    const send = jest.fn<Send>(async () => ({ ok: true, status: 204 }));
    expect(await saveFavourite('abc', true, send)).toBe(true);
    expect(send).toHaveBeenCalledWith('/api/users/self/favourites/abc', {
      method: 'PUT',
    });
    expect(getFavouriteOverride('abc')).toBe(true);
  });

  it('un-favouriting deletes the resource and keeps the heart off', async () => {
    const send = jest.fn<Send>(async () => ({ ok: true, status: 204 }));
    expect(await saveFavourite('abc', false, send)).toBe(true);
    expect(send).toHaveBeenCalledWith('/api/users/self/favourites/abc', {
      method: 'DELETE',
    });
    expect(getFavouriteOverride('abc')).toBe(false);
  });

  it('flips the heart before the save finishes', async () => {
    let seenDuringSave: boolean | undefined;
    const send: Send = async () => {
      seenDuringSave = getFavouriteOverride('abc');
      return { ok: true, status: 204 };
    };
    await saveFavourite('abc', true, send);
    expect(seenDuringSave).toBe(true);
  });

  it('rolls the heart back when the server refuses', async () => {
    const send: Send = async () => ({ ok: false, status: 500 });
    expect(await saveFavourite('abc', true, send)).toBe(false);
    expect(getFavouriteOverride('abc')).toBe(false);
  });

  it('rolls the heart back when the request itself fails', async () => {
    const send: Send = async () => {
      throw new Error('offline');
    };
    expect(await saveFavourite('abc', false, send)).toBe(false);
    expect(getFavouriteOverride('abc')).toBe(true);
  });
});
