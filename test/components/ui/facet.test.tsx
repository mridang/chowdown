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

  it('badges the title with how many of its options are on', () => {
    const out = html(<FacetSection facet={FACET} />);
    expect(out).toMatch(/Cuisine<span[^>]*>1<\/span>/);
  });

  it('shows no badge while nothing in the group is on', () => {
    const none: FacetData = {
      ...FACET,
      options: FACET.options.map((o) => ({ ...o, active: false })),
    };
    expect(html(<FacetSection facet={none} />)).not.toMatch(/Cuisine<span/);
  });

  it('shows each option’s label and how many recipes match', () => {
    const out = html(<FacetSection facet={FACET} defaultOpen />);
    expect(out).toContain('Indian');
    expect(out).toContain('>3<');
    expect(out).toContain('>2<');
  });

  it('puts the protein’s icon before its name in the protein filter', () => {
    const protein: FacetData = {
      key: 'protein',
      title: 'Protein',
      options: [
        {
          value: 'chicken',
          label: 'Chicken',
          count: 1,
          active: false,
          href: '/app?protein=chicken',
        },
      ],
    };
    const out = html(<FacetSection facet={protein} defaultOpen />);
    expect(out.indexOf('<svg')).toBeLessThan(out.indexOf('Chicken'));
  });
});
