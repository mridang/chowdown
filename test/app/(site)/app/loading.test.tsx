import { describe, expect, it } from '@jest/globals';

import AppLoading from '@/app/(site)/app/loading';
import { html } from '../../../components/render';

describe('the recipe list’s loading shell', () => {
  const out = html(<AppLoading />);

  it('tells assistive technology which page is loading', () => {
    expect(out).toContain('<output');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('Loading your recipes');
  });

  it('stands in for the sidebar and six cards', () => {
    expect(out.match(/h-80/gu)).toHaveLength(6);
    expect(out.match(/mb-3 h-10/gu)).toHaveLength(5);
  });

  it('sits in the same page column as the list', () => {
    expect(out).toContain('max-w-360');
  });
});
