import { describe, expect, it } from '@jest/globals';

import { RecipeExtras } from '@/app/(site)/recipe/[id]/_components/recipe-extras';
import { html } from '../../../../../components/render';

describe('RecipeExtras', () => {
  it('draws nothing when there is nothing left over', () => {
    expect(html(<RecipeExtras extras={[]} />)).toBe('');
  });

  it('lists each leftover line as a term and its value', () => {
    const out = html(
      <RecipeExtras
        extras={[
          ['yield', '2 loaves'],
          ['oven', 'fan 180'],
        ]}
      />,
    );
    expect(out).toContain('<dl');
    expect(out.match(/<dt/g)).toHaveLength(2);
    expect(out).toContain('>yield</dt>');
    expect(out).toContain('>2 loaves</dd>');
    expect(out).toContain('>oven</dt>');
  });

  it('never lists the author, which the byline under the title shows', () => {
    const out = html(
      <RecipeExtras
        extras={[
          ['author', 'Nigella'],
          ['By', 'Someone'],
          ['yield', '2 loaves'],
        ]}
      />,
    );
    expect(out).not.toContain('Nigella');
    expect(out).not.toContain('Someone');
    expect(out.match(/<dt/g)).toHaveLength(1);
  });

  it('draws nothing when the author was all that was left over', () => {
    expect(html(<RecipeExtras extras={[['author', 'Nigella']]} />)).toBe('');
  });
});
