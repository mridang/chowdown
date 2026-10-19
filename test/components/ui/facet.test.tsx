import { describe, expect, it } from '@jest/globals';

import type { FacetData } from '../../../src/components/recipes/search-query';
import { FacetSection } from '../../../src/components/ui/facet';
import { html } from '../render';

const FACET: FacetData = {
  key: 'cuisine',
  title: 'Cuisine',
  options: [
    { value: 'indian', label: 'Indian', count: 3, active: true, href: '/app' },
    {
      value: 'thai',
      label: 'Thai',
      count: 2,
      active: false,
      href: '/app?cuisine=indian&cuisine=thai',
    },
  ],
} as FacetData;

describe('FacetSection', () => {
  it('lists each option as a link that follows its own address', () => {
    const out = html(<FacetSection facet={FACET} defaultOpen />);
    expect(out).toContain('href="/app?cuisine=indian&amp;cuisine=thai"');
    expect(out).toContain('Thai');
  });

  it('marks only the switched-on options as current, without checkbox roles', () => {
    const out = html(<FacetSection facet={FACET} defaultOpen />);
    expect(out.match(/aria-current="true"/g)).toHaveLength(1);
    expect(out).not.toContain('role="checkbox"');
    expect(out).not.toContain('aria-checked');
  });
});
