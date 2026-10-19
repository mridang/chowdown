import { describe, expect, it } from '@jest/globals';

import { FilterDrawer } from '../../../src/components/recipes/filter-drawer';
import { htmlAt } from '../render';

describe('FilterDrawer', () => {
  it('opens from a button named "Filters"', () => {
    const out = htmlAt(
      <FilterDrawer activeCount={0}>
        <p>panel</p>
      </FilterDrawer>,
    );
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>/);
    expect(out).toContain('Filters');
  });

  it('shows how many filters are on, and nothing when none are', () => {
    const none = htmlAt(<FilterDrawer activeCount={0}>x</FilterDrawer>);
    const some = htmlAt(<FilterDrawer activeCount={3}>x</FilterDrawer>);
    expect(none).not.toContain('>3<');
    expect(some).toContain('>3<');
  });

  it('keeps the panel out of the page until the drawer is opened', () => {
    const out = htmlAt(
      <FilterDrawer activeCount={0}>
        <p>panel</p>
      </FilterDrawer>,
    );
    expect(out).not.toContain('panel');
  });
});
