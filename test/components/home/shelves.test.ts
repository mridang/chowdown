import { describe, expect, it } from '@jest/globals';

import {
  easyAndQuick,
  fromTheShelf,
  photosFirst,
  todaySeed,
} from '../../../src/components/home/shelves';
import type { CardRecipe } from '../../../src/lib/recipe/card-data';

function recipe(id: string, over: Partial<CardRecipe> = {}): CardRecipe {
  return {
    id,
    title: id,
    site: '',
    cuisine: '',
    protein: '',
    category: '',
    diet: [],
    method: [],
    keywords: [],
    favourite: false,
    tone: 'sand',
    ...over,
  };
}

const many = (n: number, over: Partial<CardRecipe> = {}) =>
  Array.from({ length: n }, (_, i) => recipe(`r${i}`, over));

describe('todaySeed', () => {
  it('is the same all day and moves on at midnight UTC', () => {
    const noon = Date.UTC(2026, 9, 18, 12);
    expect(todaySeed(noon)).toBe(todaySeed(Date.UTC(2026, 9, 18, 23, 59)));
    expect(todaySeed(Date.UTC(2026, 9, 19))).toBe(todaySeed(noon) + 1);
  });
});

describe('photosFirst', () => {
  it('moves recipes with a cover to the front and keeps the rest in order', () => {
    const list = [
      recipe('a'),
      recipe('b', { cover: 'x' }),
      recipe('c'),
      recipe('d', { cover: 'y' }),
    ];
    expect(photosFirst(list).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('easyAndQuick', () => {
  it('keeps easy recipes that take 30 minutes or less', () => {
    const list = [
      recipe('yes', { difficulty: 'Easy', minutes: 30 }),
      recipe('slow', { difficulty: 'Easy', minutes: 31 }),
      recipe('hard', { difficulty: 'Hard', minutes: 10 }),
    ];
    expect(easyAndQuick(list).map((r) => r.id)).toEqual(['yes']);
  });

  it('skips a recipe with no time rather than guessing', () => {
    expect(easyAndQuick([recipe('x', { difficulty: 'Easy' })])).toEqual([]);
  });
});

describe('fromTheShelf', () => {
  it('shows a few recipes, none of them skipped', () => {
    const picks = fromTheShelf(many(20, { cover: 'x' }), 3, new Set(['r3']));
    expect(picks).toHaveLength(4);
    expect(new Set(picks.map((r) => r.id)).size).toBe(4);
    expect(picks.some((r) => r.id === 'r3')).toBe(false);
  });

  it('is the same for the same seed and changes with it', () => {
    const list = many(30, { cover: 'x' });
    const ids = (seed: number) =>
      fromTheShelf(list, seed)
        .map((r) => r.id)
        .join();
    expect(ids(5)).toBe(ids(5));
    expect(ids(5)).not.toBe(ids(6));
  });

  it('prefers recipes with a photo', () => {
    const list = [
      ...many(10),
      ...many(10, { cover: 'x' }).map((r) => ({ ...r, id: `p${r.id}` })),
    ];
    expect(fromTheShelf(list, 1).every((r) => r.cover)).toBe(true);
  });

  it('falls back to recipes without photos when too few have one', () => {
    const list = [recipe('p', { cover: 'x' }), ...many(10)];
    expect(fromTheShelf(list, 1)).toHaveLength(4);
  });

  it('returns everything when there are no more than a row', () => {
    expect(fromTheShelf(many(3), 9)).toHaveLength(3);
    expect(fromTheShelf([], 9)).toEqual([]);
  });

  it('never picks the same recipe twice, whatever the size of the collection', () => {
    // 12 recipes, 4 picks: the first stride tried (3) shares a factor with 12
    // and would revisit recipes, so a different one has to be found.
    for (const length of [8, 9, 12, 15, 16, 20, 24]) {
      for (const seed of [0, 1, 7, 100]) {
        const picks = fromTheShelf(many(length, { cover: 'x' }), seed);
        expect(new Set(picks.map((r) => r.id)).size).toBe(4);
      }
    }
  });

  it('copes with a negative seed', () => {
    expect(fromTheShelf(many(10), -7)).toHaveLength(4);
  });
});
