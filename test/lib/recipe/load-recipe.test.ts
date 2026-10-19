import { describe, expect, it } from '@jest/globals';

import {
  ALSO_LIKE_COUNT,
  similarCards,
} from '../../../src/lib/recipe/load-recipe';
import { serializeSimilar } from '../../../src/lib/recipe/similar';

/** A cached recipe row, as far as the cards need it. */
const row = (id: string) =>
  ({
    drive_file_id: id,
    name: `${id}.cook`,
    source: `>> title: Recipe ${id}\n\nCook @onion{1}.\n`,
  }) as never;

const list = (...ids: string[]) =>
  serializeSimilar(ids.map((id) => ({ id, title: id })));

describe('similarCards', () => {
  it('lines the rows up with the stored order, best first', () => {
    const cards = similarCards({
      similarJson: list('b', 'a', 'c'),
      // The batch returns rows in any order.
      similarRecipes: [row('a'), row('c'), row('b')],
      similarFavouriteIds: [],
    });
    expect(cards.map((card) => card.id)).toEqual(['b', 'a', 'c']);
  });

  it('skips an id whose recipe no longer exists', () => {
    const cards = similarCards({
      similarJson: list('gone', 'a'),
      similarRecipes: [row('a')],
      similarFavouriteIds: [],
    });
    expect(cards.map((card) => card.id)).toEqual(['a']);
  });

  it('marks the cards the person has hearted', () => {
    const cards = similarCards({
      similarJson: list('a', 'b'),
      similarRecipes: [row('a'), row('b')],
      similarFavouriteIds: ['b'],
    });
    expect(cards.map((card) => card.favourite)).toEqual([false, true]);
  });

  it('keeps one row of cards, or as many as asked for', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const rows = {
      similarJson: list(...ids),
      similarRecipes: ids.map(row),
      similarFavouriteIds: [],
    };
    expect(similarCards(rows)).toHaveLength(ALSO_LIKE_COUNT);
    expect(similarCards(rows, 2)).toHaveLength(2);
  });

  it('is empty when there is no stored list or it is malformed', () => {
    const base = { similarRecipes: [row('a')], similarFavouriteIds: [] };
    expect(similarCards({ ...base, similarJson: null })).toEqual([]);
    expect(similarCards({ ...base, similarJson: '{oops' })).toEqual([]);
  });
});
