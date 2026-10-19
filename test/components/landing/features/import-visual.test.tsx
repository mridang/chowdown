import { describe, expect, it } from '@jest/globals';

import { RECIPES } from '../../../../src/components/landing/demo-recipes';
import { ImportVisual } from '../../../../src/components/landing/features/import-visual';
import { html } from '../../render';

describe('ImportVisual', () => {
  const recipe = RECIPES[0]!;
  const out = html(<ImportVisual recipe={recipe} />);

  it('shows the pasted link from the recipe site', () => {
    expect(out).toContain(`https://${recipe.site}/`);
  });

  it('shows the draft with its title and tags', () => {
    expect(out).toContain('Draft ready to review');
    expect(out).toContain(recipe.title);
    expect(out).toContain('rounded-full');
  });
});
