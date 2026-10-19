import { describe, expect, it } from '@jest/globals';

import { IngredientsPanel } from '../../../src/components/recipe/ingredients-panel';
import { RecipeStateProvider } from '../../../src/components/recipe/recipe-state';
import { html } from '../render';

const panel = (ingredients: { name: string; quantity: string }[]) =>
  html(
    <RecipeStateProvider servings={4} initialUnits="original">
      <IngredientsPanel
        ingredients={ingredients.map((i) => ({ ...i, notes: [] }))}
        cookware={['pan']}
      />
    </RecipeStateProvider>,
  );

describe('IngredientsPanel', () => {
  it('titles the list with a level-two heading in the display face', () => {
    const out = panel([{ name: 'onion', quantity: '1' }]);
    expect(out).toMatch(/<h2 class="[^"]*font-display[^"]*">Ingredients<\/h2>/);
  });

  it('lists each ingredient as a tick-off checkbox', () => {
    const out = panel([
      { name: 'onion', quantity: '1' },
      { name: 'salt', quantity: '' },
    ]);
    expect(out.match(/role="checkbox"/g)).toHaveLength(2);
    expect(out).toContain('onion');
  });

  it('says so when the recipe lists no ingredients', () => {
    expect(panel([])).toContain('doesn&#x27;t list any ingredients yet');
  });

  it('names the cookware under "You will need"', () => {
    expect(panel([])).toContain('You will need');
  });
});
