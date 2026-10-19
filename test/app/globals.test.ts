import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

const css = readFileSync(
  join(process.cwd(), 'src', 'app', 'globals.css'),
  'utf8',
);

/** The `#rrggbb` value declared for a custom property, as red, green, blue (0-255). */
function colourOf(name: string): readonly [number, number, number] {
  const hex = new RegExp(`${name}:\\s*#([0-9a-f]{6})`, 'i').exec(css)?.[1];
  if (!hex) {
    throw new Error(`${name} is not declared as a hex colour`);
  }
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

/** The strength (0 to 1) a token mixes the ink colour in at. */
function inkStrength(name: string): number {
  const percent = new RegExp(
    `${name}:\\s*color-mix\\(in srgb, var\\(--color-ink\\) (\\d+)%`,
  ).exec(css)?.[1];
  if (!percent) {
    throw new Error(`${name} is not ink at a fixed strength`);
  }
  return Number(percent) / 100;
}

/** WCAG relative luminance of an sRGB colour. */
function luminance([r, g, b]: readonly [number, number, number]): number {
  const linear = (value: number) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two colours. */
function contrast(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const [light, dark] = [luminance(a), luminance(b)].toSorted().toReversed();
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** `strength` of `ink` laid over `background`, which is what the eye sees. */
function over(
  ink: readonly [number, number, number],
  strength: number,
  background: readonly [number, number, number],
): readonly [number, number, number] {
  const mixed = ink.map(
    (v, i) => v * strength + (background[i] ?? 0) * (1 - strength),
  );
  return [mixed[0] ?? 0, mixed[1] ?? 0, mixed[2] ?? 0];
}

describe('the control border token', () => {
  const ink = colourOf('--color-ink');
  const surfaces = {
    white: [255, 255, 255] as const,
    paper: colourOf('--color-paper'),
    sand: colourOf('--color-sand'),
  };

  it.each(Object.entries(surfaces))(
    'reaches 3:1 against %s (WCAG 1.4.11 for the edge of a control)',
    (_name, surface) => {
      const border = over(ink, inkStrength('--color-field'), surface);
      expect(contrast(border, surface)).toBeGreaterThanOrEqual(3);
    },
  );

  it('leaves the hairline token faint, because it is only decoration', () => {
    expect(inkStrength('--color-line')).toBeLessThan(0.2);
  });
});

describe('reduced motion', () => {
  const block =
    /@media \(prefers-reduced-motion: reduce\) \{([^}]*\{[^}]*\})/.exec(
      css,
    )?.[1];

  it('shortens every animation and transition for people who ask for less', () => {
    expect(block).toContain('animation-duration: 0.01ms');
    expect(block).toContain('transition-duration: 0.01ms');
    expect(block).toContain('scroll-behavior: auto');
  });

  it('wins over the utility classes by sitting outside every cascade layer, not by shouting', () => {
    expect(block).not.toContain('!important');
    const before = css.slice(0, css.indexOf('@media (prefers-reduced-motion'));
    // Every `@layer name {` opened before the rule has been closed again.
    const opened = (before.match(/@layer [a-z-]+ \{/g) ?? []).length;
    expect(opened).toBe(0);
  });
});

describe('the handwriting font tokens', () => {
  const faces = [
    'caveat',
    'kalam',
    'shadows',
    'rainbow',
    'indie',
    'handrawn',
    'aurore',
  ];

  it('expose each face as a theme font, so `font-hand-<face>` is a utility', () => {
    faces.forEach((face) =>
      expect(css).toContain(
        `--font-hand-${face}: var(--font-hand-${face}-face), cursive;`,
      ),
    );
  });

  it('leave no general `font-hand`, so handwriting cannot be applied to anything but a name', () => {
    expect(css).not.toMatch(/--font-hand:/);
  });
});

/** The body of the first rule or at-rule whose prelude is exactly `prelude`. */
function blockOf(prelude: string): string {
  const start = css.indexOf(`${prelude} {`);
  if (start < 0) {
    throw new Error(`no rule for ${prelude}`);
  }
  const open = css.indexOf('{', start);
  const body = [...css.slice(open + 1)].reduce<{
    readonly depth: number;
    readonly text: string;
    readonly done: boolean;
  }>(
    (state, char) => {
      if (state.done) {
        return state;
      }
      const depth =
        state.depth + (char === '{' ? 1 : 0) - (char === '}' ? 1 : 0);
      return depth < 0
        ? { ...state, done: true }
        : { depth, text: state.text + char, done: false };
    },
    { depth: 0, text: '', done: false },
  );
  return body.text;
}

describe('typography the browser does for us', () => {
  const base = blockOf('@layer base');

  it('sits in the base layer, so a utility class on an element still wins', () => {
    expect(base).toContain('text-wrap: balance');
    expect(base).toContain('text-wrap: pretty');
  });

  it('balances headings and centred text, and tidies the last line of paragraphs and list items', () => {
    expect(base).toMatch(
      /h1,[\s\S]*h6,\s*\.text-center \{\s*text-wrap: balance/,
    );
    expect(base).toMatch(/p,\s*li,[\s\S]*\{\s*text-wrap: pretty/);
  });

  it('keeps room for the scrollbar, so a modal that hides it does not shift the page', () => {
    expect(base).toMatch(/html \{\s*scrollbar-gutter: stable/);
  });
});

describe('the scroll lock behind a modal dialog', () => {
  it('is one CSS rule on the root, true only while a dialog is shown modally', () => {
    expect(blockOf('@layer base')).toMatch(
      /html:has\(dialog:modal\) \{\s*overflow: hidden;\s*\}/,
    );
  });
});

describe('the auto-growing textarea', () => {
  const gate = '@supports (field-sizing: content) and (min-height: 1lh)';

  it('applies only where field-sizing and the lh unit exist, so rows still sizes it elsewhere', () => {
    expect(css).toContain(gate);
    expect(blockOf(gate)).toContain('field-sizing: content');
  });

  it('starts at the rows it is told, and stops growing at 60% of the screen', () => {
    const rule = blockOf(gate);
    expect(rule).toContain('var(--autogrow-rows, 3)');
    expect(rule).toContain('max-height: 60vh');
  });
});

describe('the dialog entry and exit animation', () => {
  const motion = blockOf('@media (prefers-reduced-motion: no-preference)');

  it('runs only for people who have not asked for less motion', () => {
    expect(motion).toContain('dialog[data-variant]');
    expect(css.indexOf('animation: dialog-in')).toBeGreaterThan(
      css.indexOf('@media (prefers-reduced-motion: no-preference)'),
    );
  });

  it('fades in with a keyframe animation, which every browser understands', () => {
    expect(css).toMatch(/@keyframes dialog-in \{\s*from \{\s*opacity: 0/);
    expect(motion).toContain('animation: dialog-in 200ms');
  });

  it('fades out by holding display and overlay (allow-discrete) until the transition ends', () => {
    expect(motion).toContain('overlay 200ms allow-discrete');
    expect(motion).toContain('display 200ms allow-discrete');
  });

  it('slides the drawer in and scales the centred box, and fades the backdrop', () => {
    expect(motion).toContain("dialog[data-variant='drawer']");
    expect(motion).toContain('translateX(-1.5rem)');
    expect(motion).toContain("dialog[data-variant='center']");
    expect(motion).toContain('animation: backdrop-in 200ms');
  });
});

describe('popover placement', () => {
  it('anchors the open panel to its own button under one fixed name', () => {
    expect(css).toMatch(
      /\[popovertarget\]:has\(\+ \[data-popover\]:popover-open\) \{\s*anchor-name: --popover-anchor/,
    );
  });

  it('hangs the panel below the button, right edges together, flipping above if cramped', () => {
    expect(css).toContain('position-area: bottom span-left');
    expect(css).toContain('position-try-fallbacks: flip-block');
  });

  it('applies the anchored layout only where every part of it exists', () => {
    const condition = /@supports ([^{]*) \{\s*\[popovertarget\]/.exec(css)?.[1];
    [
      'selector(:popover-open)',
      'selector(:has(*))',
      '(anchor-name: --a)',
      '(position-anchor: --a)',
      '(position-area: bottom)',
      '(position-try-fallbacks: flip-block)',
    ].forEach((part) => expect(condition).toContain(part));
  });

  it('reads a measured position where anchor positioning is missing', () => {
    const measured = blockOf('@supports not (position-area: bottom)');
    expect(measured).toContain('var(--popover-top');
    expect(measured).toContain('var(--popover-right');
  });

  it('is an absolute box under its button, shown by data-open, where there are no popovers', () => {
    expect(css).toMatch(
      /\[data-popover\] \{\s*display: none;\s*position: absolute;/,
    );
    expect(css).toMatch(/\[data-popover\]\[data-open\] \{\s*display: block/);
  });

  it('hands display back to the browser once it has popovers, so it decides when the panel shows', () => {
    const native = blockOf('@supports selector(:popover-open)');
    expect(native).toContain('display: revert');
    expect(native).toContain('position: fixed');
  });
});
