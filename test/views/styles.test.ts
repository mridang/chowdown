import { describe, expect, it } from '@jest/globals';

import { APP_STYLES, DARK_PALETTE, LIGHT_PALETTE } from '@/views/app';
import { STYLES } from '@/views/styles';

const LIST_HYPHEN_STYLE_COLON_SPACE = /list-style:\s*none/u;
const DOT_SR_HYPHEN_ONLY_ESC = /\.sr-only \{[^}]*clip-path:inset\(50%\)/u;
const CALC_ESC_DIGITS_PLUS_PX = /calc\((\d+)px \+ var\(--safe-top/u;
const OUTLINE_HYPHEN_OFFSET_COLON_DIGITS = /outline-offset: (\d+)px/u;
const OUTLINE_COLON_DIGITS_PLUS_PX = /outline: (\d+)px/u;
const URL_ESC = /url\(/u;
const VAR_ESC_HYPHEN_FONT_HYPHEN = /var\(--font-sans,/u;
const VAR_ESC_HYPHEN_COLOR_HYPHEN = /var\(--color-background-secondary, #/u;

describe('STYLES', () => {
  it('follows the host’s theme, with the operating system only as a fallback', () => {
    expect(STYLES).toContain(':root[data-theme="dark"]');
    expect(STYLES).toContain(':root:not([data-theme])');
  });

  it('uses the host’s variables, with fallbacks for hosts that send none', () => {
    expect(STYLES).toMatch(VAR_ESC_HYPHEN_COLOR_HYPHEN);
    expect(STYLES).toMatch(VAR_ESC_HYPHEN_FONT_HYPHEN);
  });

  it('keeps controls clear of the safe area and large enough to tap', () => {
    expect(STYLES).toContain('var(--safe-top, 0px)');
    expect(STYLES).toContain('var(--safe-bottom, 0px)');
    expect(STYLES.match(/min-height:44px/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it('respects the request for reduced motion', () => {
    expect(STYLES).toContain('prefers-reduced-motion: reduce');
  });

  it('loads nothing: no imports, no remote urls', () => {
    expect(STYLES).not.toContain('@import');
    expect(STYLES).not.toMatch(URL_ESC);
  });

  it('leaves the page background transparent so the host shows through', () => {
    expect(STYLES).toContain('html, body { background: transparent; }');
  });
});

/** The value of one rule's declaration, such as the padding of `.wrap`. */
function declaration(selector: string, property: string): string {
  const escapedSelector = selector.replace('.', String.raw`\.`);
  const rule = new RegExp(
    String.raw`(?:^|\n)${escapedSelector} \{([^}]*)\}`,
    'u',
  ).exec(STYLES);
  const value = rule?.[1]?.match(
    new RegExp(String.raw`${property}:\s*([^;]*);`, 'u'),
  );
  return value?.[1]?.replaceAll(/\s+/gu, ' ').trim() ?? '';
}

describe('keyboard focus', () => {
  it('leaves room at the frame edge for the whole focus ring', () => {
    const ring =
      Number(OUTLINE_COLON_DIGITS_PLUS_PX.exec(STYLES)?.[1]) +
      Number(OUTLINE_HYPHEN_OFFSET_COLON_DIGITS.exec(STYLES)?.[1]);
    const base = Number(
      CALC_ESC_DIGITS_PLUS_PX.exec(declaration('.wrap', 'padding'))?.[1],
    );
    expect(ring).toBe(4);
    expect(base).toBeGreaterThanOrEqual(ring);
  });
});

describe('text sizes', () => {
  it('are relative, so they follow the person’s text size setting', () => {
    const fixed = [...STYLES.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/gu)];
    expect(fixed.map((match) => match[0])).toEqual([]);
  });

  it('lets a tile name use two lines instead of cutting it at one', () => {
    expect(STYLES).toContain('-webkit-line-clamp:2');
    expect(declaration('.tile .name', 'white-space')).toBe('');
  });
});

describe('assistive text', () => {
  it('has a visually hidden class for text only screen readers get', () => {
    expect(STYLES).toMatch(DOT_SR_HYPHEN_ONLY_ESC);
  });
});

describe('lists', () => {
  it('hide their markers without `none`, which makes WebKit drop the list meaning', () => {
    expect(STYLES).not.toMatch(LIST_HYPHEN_STYLE_COLON_SPACE);
    expect(STYLES.match(/list-style-type:""/gu)?.length).toBeGreaterThanOrEqual(
      4,
    );
  });
});

describe('the themes', () => {
  it('writes the light palette into the page', () => {
    expect(STYLES).toContain(`--accent: ${LIGHT_PALETTE.accent};`);
  });

  it('writes the dark palette into the page', () => {
    expect(STYLES).toContain(`--accent: ${DARK_PALETTE.accent};`);
  });
});

describe('the app’s own rules', () => {
  it('are part of the stylesheet', () => {
    expect(STYLES).toContain(APP_STYLES);
  });
});
