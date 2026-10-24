import { describe, expect, it } from '@jest/globals';

import { FilterPanel } from '@/components/recipes/filter-panel';
import type { FacetData } from '@/components/recipes/search-query';
import { html } from '../render';

/** A filter with one option, switched on or off. */
const facet = (
  key: FacetData['key'],
  title: string,
  active = false,
): FacetData => ({
  key,
  title,
  options: [
    { value: 'x', label: 'Option', count: 1, active, href: `/app?${key}=x` },
  ],
});

describe('FilterPanel', () => {
  it('lists every filter by its title', () => {
    const out = html(
      <FilterPanel
        facets={[facet('protein', 'Protein'), facet('site', 'Source')]}
      />,
    );
    expect(out).toContain('Protein');
    expect(out).toContain('Source');
  });

  it('draws nothing inside when there are no filters', () => {
    expect(html(<FilterPanel facets={[]} />)).not.toContain('<button');
  });

  it('opens the key filters and any with a value on, and folds the rest away', () => {
    const out = html(
      <FilterPanel
        facets={[
          facet('protein', 'Protein'),
          facet('method', 'Method'),
          facet('site', 'Source', true),
        ]}
      />,
    );
    // Each group is a <details>; one that starts open carries the `open` attribute.
    const open = (title: string) =>
      out
        .split('<details')
        .some(
          (group) => group.includes(title) && /^[^>]*\sopen=""/.test(group),
        );
    expect(open('Protein')).toBe(true);
    expect(open('Source')).toBe(true);
    expect(open('Method')).toBe(false);
  });
});
