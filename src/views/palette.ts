/**
 * @packageDocumentation
 *
 * The fixed colours of the chowdown Views: the brand accent and the soft tints
 * used to mark ingredients, cookware and timers. Everything structural
 * (backgrounds, text, borders) comes from the host's theme variables, so these
 * are the only hard-coded colours. They live in their own module so the pairs
 * that must stay readable can be checked against WCAG AA in a test.
 */

/** The colours for one theme. */
export interface ThemePalette {
  /** Fill for primary buttons and step numbers (white text sits on it). */
  readonly accent: string;
  /** The accent when hovered. */
  readonly accentStrong: string;
  /** Accent used for small text on the card surface. */
  readonly accentInk: string;
  /** Tint behind ingredient chips. */
  readonly accentSoft: string;
  /** Text on {@link ThemePalette.accentSoft}. */
  readonly accentText: string;
  /** Tint behind cookware. */
  readonly tealSoft: string;
  /** Text on {@link ThemePalette.tealSoft}. */
  readonly tealText: string;
  /** Tint behind timers. */
  readonly violetSoft: string;
  /** Text on {@link ThemePalette.violetSoft}. */
  readonly violetText: string;
  /** Page background used only when the host sends no theme variables. */
  readonly fallbackBackground: string;
  /** Card surface used only when the host sends no theme variables. */
  readonly fallbackSurface: string;
  /** Body text used only when the host sends no theme variables. */
  readonly fallbackText: string;
  /** Secondary text used only when the host sends no theme variables. */
  readonly fallbackMuted: string;
}

/** Colour used for text drawn on the accent fill. */
export const ON_ACCENT = '#ffffff';

/** The light theme. */
export const LIGHT_PALETTE: ThemePalette = {
  accent: '#b45309',
  accentStrong: '#92400e',
  accentInk: '#b45309',
  accentSoft: '#fef1d6',
  accentText: '#8a4b06',
  tealSoft: '#d4f3ee',
  tealText: '#0f6b61',
  violetSoft: '#e7e1fd',
  violetText: '#5b34c7',
  fallbackBackground: '#ffffff',
  fallbackSurface: '#fbfaf8',
  fallbackText: '#1f2430',
  fallbackMuted: '#5b6270',
};

/** The dark theme. */
export const DARK_PALETTE: ThemePalette = {
  accent: '#b45309',
  accentStrong: '#92400e',
  accentInk: '#fbbf24',
  accentSoft: '#42320f',
  accentText: '#f7c572',
  tealSoft: '#113b37',
  tealText: '#7fe0d3',
  violetSoft: '#2c2350',
  violetText: '#c3b0f7',
  fallbackBackground: '#1b1b1d',
  fallbackSurface: '#252528',
  fallbackText: '#ececed',
  fallbackMuted: '#a8a8b0',
};
