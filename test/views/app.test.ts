import { describe, expect, it } from '@jest/globals';

import { APP_STYLES, REQUEST_ARGUMENTS } from '@/views/app';

describe('REQUEST_ARGUMENTS', () => {
  it('names the recipe first, then the search', () => {
    expect(REQUEST_ARGUMENTS).toEqual(['name', 'query']);
  });
});

describe('APP_STYLES', () => {
  it.each(['.step', '.tok-ing', '.tok-cook', '.tok-timer'])(
    'styles the steps and the marked ingredients, cookware and timers (%j)',
    (selector) => {
      expect(APP_STYLES).toContain(selector);
    },
  );
});
