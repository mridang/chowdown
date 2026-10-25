import { describe, expect, it, jest } from '@jest/globals';

import type { Database } from '@/core/db/client';
import type { User } from '@/domain/db/users';
import { parseRecipe } from '@/lib/cooklang';
import {
  extractFacetTags,
  rowTags,
  syncRecipeTags,
  type TagSyncDeps,
} from '@/domain/recipe/tag-index';

const SOURCE =
  '>> cuisine: Indian\n>> protein: Chicken\n\nCook @chicken thigh{500%g} with @onion{1}.\n';

describe('extractFacetTags', () => {
  it('works out the eating style from the ingredients', () => {
    const tags = extractFacetTags(parseRecipe(SOURCE, 'Curry.cook'));
    expect(tags['cuisine']).toEqual(['Indian']);
    expect(tags['diet_type']).toEqual(['Non-vegetarian']);
  });

  it('ignores an eating style written into the file', () => {
    const source = '>> diet_type: Vegan\n\nCook @chicken{500%g}.\n';
    expect(
      extractFacetTags(parseRecipe(source, 'Roast.cook'))['diet_type'],
    ).toEqual(['Non-vegetarian']);
  });

  it('leaves the eating style off a recipe with no ingredients to go on', () => {
    const tags = extractFacetTags(
      parseRecipe('>> cuisine: Indian\n', 'Upma [uncurated].cook'),
    );
    expect(tags['diet_type']).toBeUndefined();
  });

  it('uses the protein tag when an uncurated recipe has no ingredients', () => {
    const tags = extractFacetTags(
      parseRecipe('>> protein: pork\n', 'Pork Belly Stew.cook'),
    );
    expect(tags['diet_type']).toEqual(['Non-vegetarian']);
  });

  it('calls a recipe with only plants vegan', () => {
    const source = 'Slice @tomato{3} and add @basil{1%bunch}.\n';
    expect(
      extractFacetTags(parseRecipe(source, 'Salad.cook'))['diet_type'],
    ).toEqual(['Vegan']);
  });
});

describe('rowTags', () => {
  const row = (tags: string | null) => ({
    tags,
    source: SOURCE,
    name: 'Curry.cook',
  });

  it('reads tags from the recipe itself, eating style included', () => {
    expect(rowTags(row(null))).toEqual({
      cuisine: ['Indian'],
      protein: ['chicken'],
      diet_type: ['Non-vegetarian'],
    });
  });

  it('ignores whatever the cached column says, however stale or broken', () => {
    const fresh = rowTags(row(null));
    const stale = JSON.stringify({
      diet: ['Vegan', 'Vegetarian'],
      diet_type: ['Vegan'],
      bogus: ['x'],
    });
    expect(rowTags(row(stale))).toEqual(fresh);
    expect(rowTags(row('{not json'))).toEqual(fresh);
    expect(rowTags(row('[1,2]'))).toEqual(fresh);
  });

  it('leaves the eating style off a recipe with nothing to classify it by', () => {
    const bare = { source: '>> cuisine: Indian\n', name: 'A.cook' };
    expect(rowTags(bare)).toEqual({ cuisine: ['Indian'] });
  });

  it('reuses a recipe that is already parsed', () => {
    const parsed = parseRecipe(SOURCE, 'Curry.cook');
    expect(rowTags({ source: '', name: 'x.cook' }, parsed)).toEqual(
      rowTags(row(null)),
    );
  });
});

describe('syncRecipeTags', () => {
  const user = { id: 9 } as unknown as User;
  const db = {} as Database;
  const cachedRow = (
    id: string,
    modified: string | null,
    tags: string | null,
  ) => ({ drive_file_id: id, modified_time: modified, tags });

  /** Fake collaborators over the given cache rows and Drive file texts. */
  function fakes(
    cache: ReturnType<typeof cachedRow>[],
    files: Record<string, string> = {},
  ) {
    const saved: unknown[] = [];
    const deps: TagSyncDeps = {
      database: () => db,
      listCached: async () => cache,
      readFile: jest.fn(async (id: string) => files[id] ?? ''),
      save: async (_db, row) => {
        saved.push(row);
      },
    };
    return { deps, saved };
  }

  it('reads and indexes a file the cache has never seen', async () => {
    const { deps, saved } = fakes([], { a: SOURCE });
    const result = await syncRecipeTags(
      user,
      [{ id: 'a', name: 'Curry.cook', modifiedTime: 'm1' }],
      'tok',
      deps,
    );
    expect(result.get('a')).toEqual({
      cuisine: ['Indian'],
      protein: ['chicken'],
      diet_type: ['Non-vegetarian'],
    });
    expect(saved).toEqual([
      expect.objectContaining({
        user_id: 9,
        drive_file_id: 'a',
        name: 'Curry.cook',
        modified_time: 'm1',
        source: SOURCE,
      }),
    ]);
  });

  it('serves an unchanged file from the cache without reading Drive', async () => {
    const { deps, saved } = fakes([
      cachedRow('a', 'm1', JSON.stringify({ cuisine: ['Thai'] })),
    ]);
    const result = await syncRecipeTags(
      user,
      [{ id: 'a', name: 'A.cook', modifiedTime: 'm1' }],
      'tok',
      deps,
    );
    expect(result.get('a')).toEqual({ cuisine: ['Thai'] });
    expect(deps.readFile).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it('re-reads a file Drive says has changed', async () => {
    const { deps, saved } = fakes(
      [cachedRow('a', 'old', JSON.stringify({ cuisine: ['Thai'] }))],
      { a: SOURCE },
    );
    const result = await syncRecipeTags(
      user,
      [{ id: 'a', name: 'A.cook', modifiedTime: 'new' }],
      'tok',
      deps,
    );
    expect(result.get('a')?.['cuisine']).toEqual(['Indian']);
    expect(saved).toHaveLength(1);
  });

  it('re-reads a cached row whose tags are missing or broken', async () => {
    for (const tags of [null, '{not json', '[1]', '{"cuisine":"Thai"}']) {
      const { deps, saved } = fakes([cachedRow('a', 'm', tags)], {
        a: SOURCE,
      });
      await syncRecipeTags(
        user,
        [{ id: 'a', name: 'A.cook', modifiedTime: 'm' }],
        'tok',
        deps,
      );
      expect(saved).toHaveLength(1);
    }
  });

  it('treats a file with no Drive timestamp as matching a row with none', async () => {
    const { deps } = fakes([
      cachedRow('a', null, JSON.stringify({ cuisine: ['Thai'] })),
    ]);
    const result = await syncRecipeTags(
      user,
      [{ id: 'a', name: 'A.cook' }],
      'tok',
      deps,
    );
    expect(result.get('a')).toEqual({ cuisine: ['Thai'] });
  });

  it('handles files one at a time and keeps their order', async () => {
    const { deps } = fakes([], { a: SOURCE, b: SOURCE });
    const result = await syncRecipeTags(
      user,
      [
        { id: 'b', name: 'B.cook' },
        { id: 'a', name: 'A.cook' },
      ],
      'tok',
      deps,
    );
    expect([...result.keys()]).toEqual(['b', 'a']);
  });
});
