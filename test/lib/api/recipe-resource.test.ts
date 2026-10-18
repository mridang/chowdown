import { describe, expect, it } from '@jest/globals';

import type { Recipe } from '../../../src/lib/db/recipes';
import { recipeSummary } from '../../../src/lib/api/recipe-resource';

const row = (tags: string | null): Recipe =>
  ({
    drive_file_id: 'abc',
    name: 'Curry.cook',
    title: 'Curry',
    source: '>> cuisine: Indian\n\nCook @chicken{500%g}.\n',
    tags,
  }) as Recipe;

describe('recipeSummary', () => {
  it('gives a row indexed before eating styles existed its eating style', () => {
    const summary = recipeSummary(row('{"cuisine":["Indian"]}'), false);
    expect(summary.tags).toEqual({
      cuisine: ['Indian'],
      diet_type: ['Non-vegetarian'],
    });
  });

  it('survives a row with unreadable tags', () => {
    expect(recipeSummary(row('{nope'), false).tags['diet_type']).toEqual([
      'Non-vegetarian',
    ]);
  });
});
