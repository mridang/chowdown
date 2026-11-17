import { describe, expect, it } from '@jest/globals';

import { APP_STYLES, DARK_PALETTE, LIGHT_PALETTE } from '@/views/app';
import { STYLES } from '@/views/styles';

/** Matches the secondary background variable with a colour fallback. */
const BACKGROUND_FALLBACK_PATTERN = /var\(--color-background-secondary, #/u;

/** Matches a css url function. */
const CSS_URL_PATTERN = /url\(/u;

/** Matches a list-style of none. */
const LIST_STYLE_NONE_PATTERN = /list-style:\s*none/u;

/** Captures the focus outline offset. */
const OUTLINE_OFFSET_PATTERN = /outline-offset: (\d+)px/u;

/** Captures the focus outline width. */
const OUTLINE_WIDTH_PATTERN = /outline: (\d+)px/u;

/** Captures the pixel padding added to the top safe area. */
const SAFE_TOP_PADDING_PATTERN = /calc\((\d+)px \+ var\(--safe-top/u;

/** Matches the sans font variable. */
const SANS_FONT_VARIABLE_PATTERN = /var\(--font-sans,/u;

/** Matches the screen reader only rule that clips the element. */
const SR_ONLY_CLIP_PATTERN = /\.sr-only \{[^}]*clip-path:inset\(50%\)/u;

describe('STYLES', () => {
  it('follows the host’s theme, with the operating system only as a fallback', () => {
    expect(STYLES).toContain(':root[data-theme="dark"]');
    expect(STYLES).toContain(':root:not([data-theme])');
  });

  it('uses the host’s variables, with fallbacks for hosts that send none', () => {
    expect(STYLES).toMatch(BACKGROUND_FALLBACK_PATTERN);
    expect(STYLES).toMatch(SANS_FONT_VARIABLE_PATTERN);
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
    expect(STYLES).not.toMatch(CSS_URL_PATTERN);
  });

  it('leaves the page background transparent so the host shows through', () => {
    expect(STYLES).toContain('html, body { background: transparent; }');
  });
});

/** The value of one rule's declaration, such as the padding of `.wrap`. */
function declaration(selector: string, property: string): string {
  const escaped = selector.replace('.', String.raw`\.`);
  const rule = new RegExp(String.raw`(?:^|\n)${escaped} \{([^}]*)\}`, 'u').exec(
    STYLES,
  );
  const value = rule?.[1]?.match(
    new RegExp(String.raw`${property}:\s*([^;]*);`, 'u'),
  );
  return value?.[1]?.replaceAll(/\s+/gu, ' ').trim() ?? '';
}

describe('keyboard focus', () => {
  it('leaves room at the frame edge for the whole focus ring', () => {
    const ring =
      Number(OUTLINE_WIDTH_PATTERN.exec(STYLES)?.[1]) +
      Number(OUTLINE_OFFSET_PATTERN.exec(STYLES)?.[1]);
    const base = Number(
      SAFE_TOP_PADDING_PATTERN.exec(declaration('.wrap', 'padding'))?.[1],
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
    expect(STYLES).toMatch(SR_ONLY_CLIP_PATTERN);
  });
});

describe('lists', () => {
  it('hide their markers without `none`, which makes WebKit drop the list meaning', () => {
    expect(STYLES).not.toMatch(LIST_STYLE_NONE_PATTERN);
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
