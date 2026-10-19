import { describe, expect, it } from '@jest/globals';

import { STYLES } from '../../src/views/styles';

describe('STYLES', () => {
  it('follows the host’s theme, with the operating system only as a fallback', () => {
    expect(STYLES).toContain(':root[data-theme="dark"]');
    expect(STYLES).toContain(':root:not([data-theme])');
  });

  it('uses the host’s variables, with fallbacks for hosts that send none', () => {
    expect(STYLES).toMatch(/var\(--color-background-primary, #/);
    expect(STYLES).toMatch(/var\(--font-sans,/);
  });

  it('keeps controls clear of the safe area and large enough to tap', () => {
    expect(STYLES).toContain('var(--safe-top, 0px)');
    expect(STYLES).toContain('var(--safe-bottom, 0px)');
    expect(STYLES.match(/min-height:44px/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('respects the request for reduced motion', () => {
    expect(STYLES).toContain('prefers-reduced-motion: reduce');
  });

  it('loads nothing: no imports, no remote urls', () => {
    expect(STYLES).not.toContain('@import');
    expect(STYLES).not.toMatch(/url\(/);
  });

  it('leaves the page background transparent so the host shows through', () => {
    expect(STYLES).toContain('html, body { background: transparent; }');
  });
});
