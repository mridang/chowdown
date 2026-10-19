import { describe, expect, it } from '@jest/globals';

import { RecipeNotes } from '../../../../../../src/app/(site)/recipe/[id]/_components/recipe-notes';
import { htmlAt } from '../../../../../components/render';

const markup = (general: readonly { label?: string; text: string }[]) =>
  htmlAt(
    <RecipeNotes recipeId="dal" general={general} ingredients={['onion']} />,
    { pathname: '/recipe/dal' },
  );

describe('RecipeNotes', () => {
  it('is headed "Your notes"', () => {
    expect(markup([])).toMatch(/<h2[^>]*>.*Your notes<\/h2>/s);
  });

  it('invites the first note when there are none, and promises the recipe is untouched', () => {
    const out = markup([]);
    expect(out).toContain('Jot down what you changed');
    expect(out).toContain('never change the original recipe');
    expect(out).not.toContain('<ul');
  });

  it('lists the notes that belong to the whole recipe', () => {
    const out = markup([{ text: 'Doubled well' }, { text: 'Less salt' }]);
    expect(out.match(/<li/g)).toHaveLength(2);
    expect(out).toContain('Doubled well');
    expect(out).toContain('Less salt');
    expect(out).not.toContain('Jot down what you changed');
  });

  it('labels a note whose target is gone, in sentence case', () => {
    const out = markup([{ label: 'step 9', text: 'Stir more' }]);
    expect(out).toContain('Step 9');
    expect(out).toContain('Stir more');
  });

  it('always offers the "Add a note" button', () => {
    expect(markup([])).toContain('Add a note');
  });
});
