import { describe, expect, it } from '@jest/globals';

import { RecipeExtras } from '../../../../../../src/app/(site)/recipe/[id]/_components/recipe-extras';
import { html } from '../../../../../components/render';

describe('RecipeExtras', () => {
  it('draws nothing when there is nothing left over', () => {
    expect(html(<RecipeExtras extras={[]} />)).toBe('');
  });

  it('lists each leftover line as a term and its value', () => {
    const out = html(
      <RecipeExtras
        extras={[
          ['author', 'Nigella'],
          ['yield', '2 loaves'],
        ]}
      />,
    );
    expect(out).toContain('<dl');
    expect(out.match(/<dt/g)).toHaveLength(2);
    expect(out).toContain('>author</dt>');
    expect(out).toContain('>Nigella</dd>');
    expect(out).toContain('>yield</dt>');
    expect(out).toContain('>2 loaves</dd>');
  });
});
