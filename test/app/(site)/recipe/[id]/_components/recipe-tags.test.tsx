import { describe, expect, it } from '@jest/globals';

import {
  MAX_TAGS,
  RecipeTags,
  tagHref,
} from '../../../../../../src/app/(site)/recipe/[id]/_components/recipe-tags';
import { html } from '../../../../../components/render';

describe('tagHref', () => {
  it('leads to the recipe list searched for the keyword', () => {
    expect(tagHref('one pot')).toBe('/app?q=one%20pot');
  });

  it('escapes characters that would change the address', () => {
    expect(tagHref('a&b=c')).toBe('/app?q=a%26b%3Dc');
  });
});

describe('RecipeTags', () => {
  it('draws nothing for a recipe without keywords', () => {
    expect(html(<RecipeTags keywords={[]} />)).toBe('');
  });

  it('labels the row "Tagged"', () => {
    expect(html(<RecipeTags keywords={['quick']} />)).toContain('Tagged');
  });

  it('shows each keyword in sentence case as a link to its search', () => {
    const out = html(<RecipeTags keywords={['quick', 'one pot']} />);
    expect(out).toContain('href="/app?q=quick"');
    expect(out).toContain('>Quick</a>');
    expect(out).toContain('href="/app?q=one%20pot"');
    expect(out).toContain('>One pot</a>');
  });

  it('shows no more than the limit, keeping the first ones', () => {
    const words = Array.from({ length: MAX_TAGS + 5 }, (_, i) => `word${i}`);
    const out = html(<RecipeTags keywords={words} />);
    expect(out.match(/<a /g)).toHaveLength(MAX_TAGS);
    expect(out).toContain('Word0');
    expect(out).not.toContain(`Word${MAX_TAGS}`);
  });
});
