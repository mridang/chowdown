import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  getFavouriteOverride,
  resetFavouriteOverrides,
  setFavouriteOverride,
  subscribeFavourites,
} from '../../src/lib/favourites-store';

afterEach(() => resetFavouriteOverrides());

describe('favourites store', () => {
  it('has no override until a heart is toggled', () => {
    expect(getFavouriteOverride('a')).toBeUndefined();
  });

  it('remembers the latest state per recipe', () => {
    setFavouriteOverride('a', true);
    setFavouriteOverride('b', false);
    setFavouriteOverride('a', false);
    expect(getFavouriteOverride('a')).toBe(false);
    expect(getFavouriteOverride('b')).toBe(false);
  });

  it('notifies subscribers on every change until they unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeFavourites(listener);
    setFavouriteOverride('a', true);
    setFavouriteOverride('a', false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setFavouriteOverride('a', true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
