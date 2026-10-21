import { describe, expect, it, jest } from '@jest/globals';

import type { SessionPayload } from '../../../src/lib/auth/session';
import type { Database } from '../../../src/lib/db/client';
import type { RecipePageRows } from '../../../src/lib/db/recipe-page';
import type { User } from '../../../src/lib/db/users';
import {
  ALSO_LIKE_COUNT,
  loadRecipePageRows,
  similarCards,
  type RecipeLoadDeps,
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

const db = {} as Database;

/** Thrown by the fake redirect so a test can see where it went. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

/** Page rows, with or without the recipe, for an account at the given epoch. */
const pageRows = (
  options: { recipe?: boolean; epoch?: number | undefined } = {},
): RecipePageRows => ({
  recipe: options.recipe === false ? undefined : (row('r1') as never),
  favourite: false,
  similarJson: null,
  similarRecipes: [],
  similarFavouriteIds: [],
  units: null,
  sessionEpoch: 'epoch' in options ? options.epoch : 0,
});

/** Fake collaborators; the Drive fallback answers `lookup`. */
function fakes(overrides: Partial<RecipeLoadDeps> = {}) {
  const deps: RecipeLoadDeps = {
    session: async () => ({ uid: 1, email: 'a@b.c' }) as SessionPayload,
    database: () => db,
    pageRows: jest.fn(async () => pageRows()),
    currentUser: async () =>
      ({ id: 1, refresh_token_enc: 'sealed' }) as unknown as User,
    claimLookup: jest.fn<RecipeLoadDeps['claimLookup']>(async () => true),
    lookUp: jest.fn<RecipeLoadDeps['lookUp']>(async () => ({
      status: 'missing',
    })),
    redirect: (to) => {
      throw new Redirected(to);
    },
    ...overrides,
  };
  return deps;
}

describe('loadRecipePageRows', () => {
  it('sends someone signed out home', async () => {
    const deps = fakes({ session: async () => null });
    await expect(loadRecipePageRows('r1', deps)).rejects.toMatchObject({
      to: '/',
    });
  });

  it('returns the cached rows without touching Drive', async () => {
    const deps = fakes();
    const rows = await loadRecipePageRows('r1', deps);
    expect(rows?.recipe).toBeDefined();
    expect(deps.claimLookup).not.toHaveBeenCalled();
    expect(deps.lookUp).not.toHaveBeenCalled();
  });

  it('clears a session that was ended by signing out everywhere', async () => {
    const deps = fakes({
      session: async () =>
        ({ uid: 1, email: 'a@b.c', ep: 0 }) as SessionPayload,
      pageRows: async () => pageRows({ epoch: 1 }),
    });
    await expect(loadRecipePageRows('r1', deps)).rejects.toMatchObject({
      to: '/auth/refresh',
    });
  });

  it('clears the session of an account that no longer exists', async () => {
    const deps = fakes({
      pageRows: async () => pageRows({ epoch: undefined }),
    });
    await expect(loadRecipePageRows('r1', deps)).rejects.toMatchObject({
      to: '/auth/refresh',
    });
  });

  it('looks in Drive once for a recipe the cache has never seen', async () => {
    const found = pageRows();
    const deps = fakes({
      pageRows: async () => pageRows({ recipe: false }),
      lookUp: async () => ({ status: 'loaded', rows: found }),
    });
    expect(await loadRecipePageRows('r1', deps)).toBe(found);
  });

  it('does not list the Drive folder again when a sync started within the last minute', async () => {
    const deps = fakes({
      pageRows: async () => pageRows({ recipe: false }),
      claimLookup: async () => false,
    });
    expect(await loadRecipePageRows('made-up-id', deps)).toBeNull();
    expect(deps.lookUp).not.toHaveBeenCalled();
  });

  it('answers null for an id Drive does not have either', async () => {
    const deps = fakes({ pageRows: async () => pageRows({ recipe: false }) });
    expect(await loadRecipePageRows('r1', deps)).toBeNull();
  });

  it('sends someone with no Drive connection to the list', async () => {
    const deps = fakes({
      pageRows: async () => pageRows({ recipe: false }),
      currentUser: async () =>
        ({ id: 1, refresh_token_enc: null }) as unknown as User,
    });
    await expect(loadRecipePageRows('r1', deps)).rejects.toMatchObject({
      to: '/app',
    });
  });

  it('sends someone whose login lapsed during the lookup to the list', async () => {
    const deps = fakes({
      pageRows: async () => pageRows({ recipe: false }),
      lookUp: async () => ({ status: 'lapsed' }),
    });
    await expect(loadRecipePageRows('r1', deps)).rejects.toMatchObject({
      to: '/app',
    });
  });
});
