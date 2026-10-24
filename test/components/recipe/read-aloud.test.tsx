import { describe, expect, it } from '@jest/globals';

import { ReadAloudButton } from '@/components/recipe/read-aloud';
import { RecipeStateProvider } from '@/components/recipe/recipe-state';
import { html } from '../render';

describe('ReadAloudButton', () => {
  it('is not rendered where the browser cannot speak (and on the server)', () => {
    const out = html(
      <RecipeStateProvider servings={4} initialUnits="original">
        <ReadAloudButton
          tokens={[{ kind: 'text', text: 'Chop.' }]}
          number={1}
        />
      </RecipeStateProvider>,
    );
    expect(out).toBe('');
  });
});
