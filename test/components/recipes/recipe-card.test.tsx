import { describe, expect, it } from '@jest/globals';

import {
  PhotoBlock,
  RecipeCard,
} from '../../../src/components/recipes/recipe-card';
import { toCardRecipe } from '../../../src/lib/recipe/card-data';
import { html } from '../render';

const SOURCE = [
  '>> title: Dal',
  '>> time: 35 min',
  '>> difficulty: Easy',
  '>> protein: chicken',
  '',
  'Cook @chicken{200%g}.',
  '',
].join('\n');

describe('PhotoBlock', () => {
  it('is a tinted tile in the recipe colour without a cover', () => {
    const out = html(<PhotoBlock tone="marigold" />);
    expect(out).toContain('bg-marigold/30');
    expect(out).not.toContain('<img');
  });
});

describe('RecipeCard', () => {
  const recipe = toCardRecipe(
    { drive_file_id: 'dal', name: 'Dal.cook', source: SOURCE },
    false,
  );

  it('links to the recipe page', () => {
    expect(html(<RecipeCard recipe={recipe} />)).toContain(
      'href="/recipe/dal"',
    );
  });

  it('shows the facts the recipe has along the foot', () => {
    const out = html(<RecipeCard recipe={recipe} />);
    expect(out).toContain('35 min');
    expect(out).toContain('Easy');
    expect(out).toContain('Chicken');
  });

  it('leaves out the facts a recipe lacks', () => {
    const bare = toCardRecipe(
      { drive_file_id: 'x', name: 'X.cook', source: '>> title: X\n' },
      false,
    );
    expect(html(<RecipeCard recipe={bare} />)).not.toContain('text-[13px]');
  });

  it('tells the heart state apart in its label', () => {
    expect(html(<RecipeCard recipe={recipe} />)).toContain(
      'aria-label="Add to favourites"',
    );
    expect(
      html(<RecipeCard recipe={{ ...recipe, favourite: true }} />),
    ).toContain('aria-label="Remove from favourites"');
  });
});
