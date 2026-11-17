import { describe, expect, it } from '@jest/globals';

import { SortSelect } from '@/components/recipes/sort-select';
import { htmlAt } from '../render';

const OPTION_VALUE_TITLE = /<option value="title" selected="">/u;
const OPTION_VALUE_TIME = /<option value="time" selected="">/u;

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
    expect(out).toMatch(OPTION_VALUE_TIME);
    expect(out).not.toMatch(OPTION_VALUE_TITLE);
  });
});
