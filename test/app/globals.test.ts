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

describe('the handwriting font token', () => {
  it('is exposed as a theme font, so `font-hand` is a utility', () => {
    expect(css).toMatch(/--font-hand:\s*var\(--font-hand-face\)/);
  });
});
