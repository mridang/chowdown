import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  getFavouriteOverride,
  liveFavouriteCount,
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

describe('liveFavouriteCount', () => {
  it('is the server count when nothing has been toggled', () => {
    expect(liveFavouriteCount(['a', 'b'])).toBe(2);
  });

  it('counts a heart added in this tab', () => {
    setFavouriteOverride('c', true);
    expect(liveFavouriteCount(['a', 'b'])).toBe(3);
  });

  it('drops a heart removed in this tab', () => {
    setFavouriteOverride('a', false);
    expect(liveFavouriteCount(['a', 'b'])).toBe(1);
  });

  it('does not double count re-hearting an existing favourite', () => {
    setFavouriteOverride('a', true);
    expect(liveFavouriteCount(['a', 'b'])).toBe(2);
  });

  it('ignores an un-heart of a recipe the server never listed', () => {
    setFavouriteOverride('z', false);
    expect(liveFavouriteCount(['a', 'b'])).toBe(2);
  });

  it('counts a repeated server id once', () => {
    expect(liveFavouriteCount(['a', 'a', 'b'])).toBe(2);
  });

  it('follows the latest toggle for a recipe', () => {
    setFavouriteOverride('c', true);
    setFavouriteOverride('c', false);
    expect(liveFavouriteCount(['a'])).toBe(1);
  });
});
