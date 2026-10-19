import { describe, expect, it } from '@jest/globals';

import { PageSkeleton } from '../../../src/components/site/page-skeleton';
import { html } from '../render';

describe('PageSkeleton', () => {
  it('tells assistive technology the page is loading', () => {
    const out = html(<PageSkeleton />);
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('Loading');
  });

  it('stands in for four cards', () => {
    expect(html(<PageSkeleton />).match(/h-64/g)).toHaveLength(4);
  });
});
