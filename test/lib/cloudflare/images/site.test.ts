import { describe, expect, it } from '@jest/globals';

import {
  ALLOWED_HOSTS,
  ALLOWED_WIDTHS,
  DEFAULT_WIDTH,
} from '@/lib/cloudflare/images';

describe('image settings', () => {
  it('takes photos from the recipes’ own sites, so from any public host', () => {
    expect(ALLOWED_HOSTS).toBeNull();
  });

  it('offers five widths, from a phone to a large screen', () => {
    expect(ALLOWED_WIDTHS).toEqual([320, 480, 640, 960, 1280]);
  });

  it('uses one of the offered widths when none is asked for', () => {
    expect(DEFAULT_WIDTH).toBe(640);
    expect(ALLOWED_WIDTHS).toContain(DEFAULT_WIDTH);
  });
});
