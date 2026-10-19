import { describe, expect, it } from '@jest/globals';

import { AlsoLike } from '../../../../../../src/app/(site)/recipe/[id]/_components/also-like';
import { toCardRecipe } from '../../../../../../src/lib/recipe/card-data';
import { html } from '../../../../../components/render';

const card = (id: string) =>
  toCardRecipe(
    { drive_file_id: id, name: `${id}.cook`, source: `>> title: Dish ${id}\n` },
    false,
  );

describe('AlsoLike', () => {
  it('shows nothing when no recipe is similar', () => {
    expect(html(<AlsoLike recipes={[]} />)).toBe('');
  });

  it('lists each similar recipe under the heading, as a link to its page', () => {
    const out = html(<AlsoLike recipes={[card('a'), card('b')]} />);
    expect(out).toContain('You might also like');
    expect(out).toContain('href="/recipe/a"');
    expect(out).toContain('href="/recipe/b"');
  });

  it('stays out of the printed page', () => {
    expect(html(<AlsoLike recipes={[card('a')]} />)).toContain('print:hidden');
  });
});
