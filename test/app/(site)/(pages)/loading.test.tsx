import { describe, expect, it } from '@jest/globals';

import PagesLoading from '@/app/(site)/(pages)/loading';
import { html } from '../../../components/render';

describe('the loading shell for the account pages', () => {
  it('is the page skeleton, announced as loading', () => {
    const out = html(<PagesLoading />);
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-busy="true"');
  });
});
