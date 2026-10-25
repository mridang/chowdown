import { describe, expect, it } from '@jest/globals';

import {
  IngredientsPanel,
  toggledIn,
} from '@/components/recipe/ingredients-panel';
import { RecipeStateProvider } from '@/components/recipe/recipe-state';
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

  it('labels the servings group with an id that is not shared with a second panel', () => {
    const two = html(
      <RecipeStateProvider servings={4} initialUnits="original">
        <IngredientsPanel ingredients={[]} cookware={[]} />
        <IngredientsPanel ingredients={[]} cookware={[]} />
      </RecipeStateProvider>,
    );
    const ids = [...two.matchAll(/id="([^"]+)">Servings</g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(two).toContain(`aria-labelledby="${ids[0]}"`);
    expect(two).toContain(`aria-labelledby="${ids[1]}"`);
    expect(two).not.toContain('servings-label');
  });

  it('draws the tick circle with the control-border token', () => {
    const out = panel([{ name: 'onion', quantity: '1' }]);
    expect(out).toContain('border-field bg-white');
  });

  it('names the cookware under "You will need"', () => {
    expect(panel([])).toContain('You will need');
  });
});

describe('toggledIn', () => {
  it('ticks an ingredient that was not ticked', () => {
    expect([...toggledIn(new Set([0]), 2)]).toEqual([0, 2]);
  });

  it('un-ticks one that was', () => {
    expect([...toggledIn(new Set([0, 2]), 0)]).toEqual([2]);
  });

  it('leaves the set it was given as it was', () => {
    const before = new Set([1]);
    toggledIn(before, 3);
    expect([...before]).toEqual([1]);
  });
});
