import { describe, expect, it } from '@jest/globals';

import { STYLES } from '@/views/styles';

describe('STYLES', () => {
  it('follows the host’s theme, with the operating system only as a fallback', () => {
    expect(STYLES).toContain(':root[data-theme="dark"]');
    expect(STYLES).toContain(':root:not([data-theme])');
  });

  it('uses the host’s variables, with fallbacks for hosts that send none', () => {
    expect(STYLES).toMatch(/var\(--color-background-secondary, #/);
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

/** The value of one rule's declaration, such as the padding of `.wrap`. */
function declaration(selector: string, property: string): string {
  const rule = STYLES.match(
    new RegExp(`(?:^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`),
  );
  const value = rule?.[1]?.match(new RegExp(`${property}:\\s*([^;]*);`));
  return value?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('keyboard focus', () => {
  it('leaves room at the frame edge for the whole focus ring', () => {
    const ring =
      Number(/outline: (\d+)px/.exec(STYLES)?.[1]) +
      Number(/outline-offset: (\d+)px/.exec(STYLES)?.[1]);
    const base = Number(
      /calc\((\d+)px \+ var\(--safe-top/.exec(
        declaration('.wrap', 'padding'),
      )?.[1],
    );
    expect(ring).toBe(4);
    expect(base).toBeGreaterThanOrEqual(ring);
  });
});

describe('text sizes', () => {
  it('are relative, so they follow the person’s text size setting', () => {
    const fixed = [...STYLES.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)];
    expect(fixed.map((match) => match[0])).toEqual([]);
  });

  it('lets a tile name use two lines instead of cutting it at one', () => {
    expect(STYLES).toContain('-webkit-line-clamp:2');
    expect(declaration('.tile .name', 'white-space')).toBe('');
  });
});

describe('assistive text', () => {
  it('has a visually hidden class for text only screen readers get', () => {
    expect(STYLES).toMatch(/\.sr-only \{[^}]*clip-path:inset\(50%\)/);
  });
});

describe('lists', () => {
  it('hide their markers without `none`, which makes WebKit drop the list meaning', () => {
    expect(STYLES).not.toMatch(/list-style:\s*none/);
    expect(STYLES.match(/list-style-type:""/g)?.length).toBeGreaterThanOrEqual(
      4,
    );
  });
});
