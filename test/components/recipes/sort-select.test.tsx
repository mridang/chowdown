import { describe, expect, it } from '@jest/globals';

import { SortSelect } from '../../../src/components/recipes/sort-select';
import { htmlAt } from '../render';

const OPTIONS = [
  { value: 'title', label: 'Title A–Z', href: '/app' },
  { value: 'time', label: 'Quickest first', href: '/app?sort=time' },
] as const;

describe('SortSelect', () => {
  const out = htmlAt(<SortSelect value="time" options={OPTIONS} />, {
    pathname: '/app',
    search: 'sort=time',
  });

  it('is a labelled dropdown', () => {
    expect(out).toContain('<label');
    expect(out).toContain('<span>Sort</span>');
    expect(out).toContain('<select');
  });

  it('offers every order by its label', () => {
    expect(out).toContain('>Title A–Z</option>');
    expect(out).toContain('>Quickest first</option>');
  });

  it('shows the order in force as chosen', () => {
    expect(out).toMatch(/<option value="time" selected="">/);
    expect(out).not.toMatch(/<option value="title" selected="">/);
  });
});
