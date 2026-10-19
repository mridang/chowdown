/**
 * @packageDocumentation
 *
 * The seven handwriting faces that people's names are set in (see
 * `components/recipe/author-name.tsx`, which picks one per name). They live in
 * their own module so the root layout stays readable, and so the list of faces
 * here and the list in the component can be read side by side: the order below
 * is the order of the component's table.
 *
 * Every face is self-hosted at build time by `next/font` (the Content Security
 * Policy allows fonts only from this site, and nothing is fetched from Google
 * when a page loads). None is preloaded: a preload would put the font file in
 * the head of every page, while the browser only downloads a `@font-face` file
 * once something on the page actually uses it, so a recipe page fetches the one
 * face its author's name needs and every other page fetches none. `swap`, not
 * `optional`: a handwriting face that never shows on a first visit defeats its
 * purpose, and a name is one short line, so the swap moves little. Each ships
 * the Latin and Latin-extended subsets, so names such as "Zoë Jõgi" and
 * "Łukasz Wójcik" are drawn in the face and not in a fallback.
 */

import {
  Caveat,
  Delicious_Handrawn,
  Indie_Flower,
  Kalam,
  La_Belle_Aurore,
  Over_the_Rainbow,
  Shadows_Into_Light,
} from 'next/font/google';

/** Casual, slanted marker script. A variable face, so its weight can be raised. */
const caveat = Caveat({
  variable: '--font-hand-caveat-face',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

/** Upright, rounded pen print; the most legible of the seven. */
const kalam = Kalam({
  variable: '--font-hand-kalam-face',
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

/** Neat, thin, upright pencil print. */
const shadows = Shadows_Into_Light({
  variable: '--font-hand-shadows-face',
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

/** Tall, loopy and airy: a quick pen note. */
const rainbow = Over_the_Rainbow({
  variable: '--font-hand-rainbow-face',
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

/** Round, friendly felt-tip. */
const indie = Indie_Flower({
  variable: '--font-hand-indie-face',
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

/** Condensed, confident brush lettering. */
const handrawn = Delicious_Handrawn({
  variable: '--font-hand-handrawn-face',
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

/** Joined-up fountain-pen cursive, the most formal of the seven. */
const aurore = La_Belle_Aurore({
  variable: '--font-hand-aurore-face',
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
  fallback: ['cursive'],
});

/**
 * The class list that defines all seven `--font-hand-*-face` variables; it goes
 * on `<html>` once, and `globals.css` turns each variable into a `font-hand-*`
 * utility. Defining a variable downloads nothing, so having all seven on the
 * root costs nothing on a page that uses none.
 */
export const HANDWRITING_VARIABLES: string = [
  caveat,
  kalam,
  shadows,
  rainbow,
  indie,
  handrawn,
  aurore,
]
  .map((face) => face.variable)
  .join(' ');
