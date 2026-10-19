import { describe, expect, it } from '@jest/globals';

import {
  RecipeStateProvider,
  useRecipeState,
} from '../../../src/components/recipe/recipe-state';
import { html } from '../render';

/** Prints what the shared state says, so a test can read it. */
function Probe({ amount }: Readonly<{ amount: string }>) {
  const { people, units, quantity } = useRecipeState();
  return (
    <p>
      {people}|{units}|{quantity(amount)}
    </p>
  );
}

describe('RecipeStateProvider', () => {
  it('starts at the recipe’s own servings and the saved units', () => {
    const out = html(
      <RecipeStateProvider servings={4} initialUnits="metric">
        <Probe amount="" />
      </RecipeStateProvider>,
    );
    expect(out).toContain('4|metric|');
  });

  it('leaves an amount alone at the recipe’s own servings and units', () => {
    const out = html(
      <RecipeStateProvider servings={4} initialUnits="original">
        <Probe amount="2 cups" />
      </RecipeStateProvider>,
    );
    expect(out).toContain('|2 cups');
  });
});

describe('useRecipeState', () => {
  it('refuses to be used outside the provider', () => {
    expect(() => html(<Probe amount="" />)).toThrow(
      'useRecipeState needs a RecipeStateProvider',
    );
  });
});
