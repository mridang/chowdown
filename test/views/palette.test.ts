import { describe, expect, it } from '@jest/globals';

import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  ON_ACCENT,
  type ThemePalette,
} from '../../src/views/palette';

/** Relative luminance of a `#rrggbb` colour, as WCAG defines it. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const AA = 4.5;

describe.each([
  ['light', LIGHT_PALETTE],
  ['dark', DARK_PALETTE],
] as const)(
  '%s palette meets WCAG AA for text',
  (_name, palette: ThemePalette) => {
    it('keeps white text readable on the accent, hovered or not', () => {
      expect(contrast(ON_ACCENT, palette.accent)).toBeGreaterThanOrEqual(AA);
      expect(contrast(ON_ACCENT, palette.accentStrong)).toBeGreaterThanOrEqual(
        AA,
      );
    });

    it('keeps accent text readable on the card', () => {
      expect(
        contrast(palette.accentInk, palette.fallbackSurface),
      ).toBeGreaterThanOrEqual(AA);
    });

    it('keeps the tinted token text readable on its tint', () => {
      expect(
        contrast(palette.accentText, palette.accentSoft),
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrast(palette.tealText, palette.tealSoft),
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrast(palette.violetText, palette.violetSoft),
      ).toBeGreaterThanOrEqual(AA);
    });

    it('keeps body and secondary text readable on the card', () => {
      expect(
        contrast(palette.fallbackText, palette.fallbackSurface),
      ).toBeGreaterThanOrEqual(AA);
      expect(
        contrast(palette.fallbackMuted, palette.fallbackSurface),
      ).toBeGreaterThanOrEqual(AA);
    });
  },
);
