/**
 * @packageDocumentation
 *
 * The typefaces and the page frame's own classes: what the root layout puts on
 * `<html>` and `<body>`. Per app, with the same export names in every app, so
 * the layout itself is shared.
 */

import { Bricolage_Grotesque, Inter } from 'next/font/google';

import { HANDWRITING_VARIABLES } from './handwriting-fonts';

/**
 * Body face. `optional` means a slow first load shows the (metrics-matched)
 * system font instead of swapping to Inter mid-read, which keeps paragraphs from
 * repainting late; the font is cached for every page after the first.
 */
const sans = Inter({
  variable: '--font-sans-face',
  subsets: ['latin'],
  display: 'optional',
  preload: false,
});

/** Display face for headings: a heavy, friendly grotesque. */
const display = Bricolage_Grotesque({
  variable: '--font-display-face',
  subsets: ['latin'],
  display: 'optional',
  preload: false,
});

/** The classes of `<html>`: the font variables, and the base type setting. */
export const HTML_CLASS = `${sans.variable} ${display.variable} ${HANDWRITING_VARIABLES} h-full antialiased`;

/** The classes of `<body>`: a column that fills the screen, in the page colours and body face. */
export const BODY_CLASS =
  'flex min-h-full flex-col bg-paper font-sans text-ink';

/** Extra attributes for `<html>`, such as the one a theme switcher sets. */
export const HTML_ATTRIBUTES: Readonly<Record<string, string>> = {};
