import { describe, expect, it } from '@jest/globals';

import RecipeLoading from '../../../../../src/app/(site)/recipe/[id]/loading';
import { html } from '../../../../components/render';

describe('RecipeLoading', () => {
  const out = html(<RecipeLoading />);

  it('tells assistive technology the recipe is loading', () => {
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-busy="true"');
  });

  it('reserves the real page layout so nothing jumps when it arrives', () => {
    // The split hero, the 4-up facts and the ingredients-beside-method grid.
    expect(out).toContain('aspect-16/10');
    expect(out).toContain('lg:min-h-128');
    expect(out).toContain('lg:grid-cols-4');
    expect(out).toContain('lg:grid-cols-[24rem_minmax(0,1fr)]');
  });

  it('draws one placeholder per fact, ingredient and step', () => {
    expect(out.match(/size-11/g)).toHaveLength(4);
    expect(out.match(/h-6 w-full/g)).toHaveLength(6);
    expect(out.match(/rounded-full/g)).toHaveLength(4);
  });
});
