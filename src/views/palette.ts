/**
 * @packageDocumentation
 *
 * The fixed colours of the Views: the brand accent and three soft tints for
 * chips and badges. Everything structural
 * (backgrounds, text, borders) comes from the host's theme variables, so these
 * are the only hard-coded colours. They live in their own module so the pairs
 * that must stay readable can be checked against WCAG AA in a test. The values
 * are this app's own (`app.ts`).
 */

/** The colours for one theme. */
export interface ThemePalette {
  /** Fill for primary buttons (white text sits on it). */
  readonly accent: string;
  /** The accent when hovered. */
  readonly accentStrong: string;
  /** Accent used for small text on the card surface. */
  readonly accentInk: string;
  /** Tint behind the first kind of chip. */
  readonly accentSoft: string;
  /** Text on {@link ThemePalette.accentSoft}. */
  readonly accentText: string;
  /** Tint behind the second kind of chip. */
  readonly tealSoft: string;
  /** Text on {@link ThemePalette.tealSoft}. */
  readonly tealText: string;
  /** Tint behind the third kind of chip. */
  readonly violetSoft: string;
  /** Text on {@link ThemePalette.violetSoft}. */
  readonly violetText: string;
  /** Card surface used only when the host sends no theme variables. */
  readonly fallbackSurface: string;
  /** Body text used only when the host sends no theme variables. */
  readonly fallbackText: string;
  /** Secondary text used only when the host sends no theme variables. */
  readonly fallbackMuted: string;
}

/** Colour used for text drawn on the accent fill. */
export const ON_ACCENT = '#ffffff';

export { DARK_PALETTE, LIGHT_PALETTE } from '@/views/app';
