import { describe, expect, it } from '@jest/globals';

import { Method } from '@/components/recipe/method';
import { RecipeStateProvider } from '@/components/recipe/recipe-state';
import { html } from '../render';

const step = (text: string) => [{ kind: 'text' as const, text }];

describe('Method', () => {
  const out = html(
    <RecipeStateProvider servings={4} initialUnits="original">
      <Method
        steps={[step('Chop.'), step('Fry.')]}
        notes={[[], ['Less oil']]}
      />
    </RecipeStateProvider>,
  );

  it('numbers each step with a badge hidden from assistive technology', () => {
    expect(
      out.match(/<span aria-hidden="true" class="grid shrink-0/g),
    ).toHaveLength(2);
    expect(out).toContain('rounded-full');
    expect(out).toContain('Step 1: ');
    expect(out).toContain('Step 2: ');
  });

  it("puts a step's own notes under it", () => {
    expect(out.indexOf('Fry.')).toBeLessThan(out.indexOf('Less oil'));
  });

  it('says so when the recipe has no method', () => {
    const empty = html(
      <RecipeStateProvider servings={4} initialUnits="original">
        <Method steps={[]} notes={[]} />
      </RecipeStateProvider>,
    );
    expect(empty).toContain('This recipe has no method yet.');
  });
});
