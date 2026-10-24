import { asCalls } from '../../calls';
import { describe, expect, it, jest } from '@jest/globals';

import type { Database } from '@/core/db/client';
import {
  backfillEmbeddings,
  embedRecipe,
  type EmbedWriteDeps,
} from '@/lib/recipe/embed-write';

const db = {} as Database;

const env = {} as CloudflareEnv;

/** A cached recipe row, as far as embedding needs it. */
const recipe = (id: string, extra: object = {}) => ({
  drive_file_id: id,
  name: `${id}.cook`,
  source: `>> title: ${id}\n\nCook @onion{1}.\n`,
  modified_time: 'm',
  ...extra,
});

/** Fake collaborators: the given recipes, and ids that already have vectors. */
function fakes(
  recipes: readonly ReturnType<typeof recipe>[],
  embedded: readonly string[] = [],
) {
  const deps: EmbedWriteDeps = {
    listRecipes: async () => recipes,
    listEmbeddings: async () => embedded.map((id) => ({ drive_file_id: id })),
    save: jest.fn(async () => undefined),
    embed: jest.fn(async () => [0.5, 0.25]),
    refreshLists: jest.fn(async () => undefined),
  };
  return deps;
}

describe('embedRecipe', () => {
  it('stores the vector under the recipe, then refreshes the similar lists', async () => {
    const deps = fakes([]);
    await embedRecipe(
      db,
      env,
      1,
      'f1',
      'Curry [uncurated].cook',
      '>> title: Curry\n',
      'mt',
      deps,
    );
    expect(asCalls(deps.save)).toHaveBeenCalledWith(db, {
      user_id: 1,
      drive_file_id: 'f1',
      title: 'Curry',
      modified_time: 'mt',
      vector: '[0.5,0.25]',
    });
    expect(asCalls(deps.refreshLists)).toHaveBeenCalledWith(db, 1, ['f1']);
  });

  it('leaves the modified time empty when none is known', async () => {
    const deps = fakes([]);
    await embedRecipe(db, env, 1, 'f1', 'A.cook', 'x', undefined, deps);
    expect(asCalls(deps.save)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ modified_time: null }),
    );
  });

  it('does not refresh the lists when embedding fails', async () => {
    const deps = {
      ...fakes([]),
      embed: async () => {
        throw new Error('model down');
      },
    };
    await expect(
      embedRecipe(db, env, 1, 'f1', 'A.cook', 'x', null, deps),
    ).rejects.toThrow('model down');
    expect(asCalls(deps.refreshLists)).not.toHaveBeenCalled();
  });
});

describe('backfillEmbeddings', () => {
  it('embeds only the recipes that have no vector yet', async () => {
    const deps = fakes([recipe('a'), recipe('b'), recipe('c')], ['b']);
    expect(await backfillEmbeddings(db, env, 1, 20, deps)).toBe(2);
    const saved = (deps.save as jest.Mock).mock.calls.map(
      ([, row]) => (row as { drive_file_id: string }).drive_file_id,
    );
    expect(saved).toEqual(['a', 'c']);
    expect(asCalls(deps.refreshLists)).toHaveBeenCalledTimes(1);
    // Only the lists these two recipes can affect are worked out.
    expect(asCalls(deps.refreshLists)).toHaveBeenCalledWith(db, 1, ['a', 'c']);
  });

  it('is bounded by the limit', async () => {
    const deps = fakes([recipe('a'), recipe('b'), recipe('c')]);
    expect(await backfillEmbeddings(db, env, 1, 2, deps)).toBe(2);
    expect(asCalls(deps.save)).toHaveBeenCalledTimes(2);
  });

  it('skips recipes that could not be parsed', async () => {
    const deps = fakes([recipe('a', { parse_error: 'bad' }), recipe('b')]);
    expect(await backfillEmbeddings(db, env, 1, 20, deps)).toBe(1);
  });

  it('does nothing, not even refreshing, when all are embedded', async () => {
    const deps = fakes([recipe('a')], ['a']);
    expect(await backfillEmbeddings(db, env, 1, 20, deps)).toBe(0);
    expect(asCalls(deps.save)).not.toHaveBeenCalled();
    expect(asCalls(deps.refreshLists)).not.toHaveBeenCalled();
  });
});
