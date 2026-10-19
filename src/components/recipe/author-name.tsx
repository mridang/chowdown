import type { ReactElement } from 'react';

import { cn } from '@/components/ui/cn';

/** How one face is drawn: its class list, and its font size at each of the two sizes. */
type FaceLook = Readonly<{
  /** The `font-hand-*` token (see `globals.css`) and the weight. */
  face: string;
  /** The font size beside body text, with the line height that keeps descenders whole. */
  md: string;
  /** The font size under a page title, likewise. */
  lg: string;
}>;

/**
 * The handwriting faces a name can be set in, in the order the root layout
 * loads them (`app/handwriting-fonts.ts`); a name's face is an index into this
 * table. Every class is written out in full, because Tailwind only generates
 * the classes it can find as literal text in the source.
 *
 * The sizes differ from face to face on purpose. Handwriting faces draw very
 * differently at the same font size (Caveat is small, Kalam is large), and a
 * name would change size with its face. These were set by eye, so that each
 * face reads at about the size of Indie Flower at 24px (`lg`) or 20px (`md`).
 * (`font-size-adjust` was tried and dropped: it trusts each font's declared
 * x-height, and Over the Rainbow's is far taller than what it draws.) Weight is
 * left alone except for Caveat, the one variable face: the others have a single
 * weight, and asking them for bold would make the browser smear a fake one.
 */
const FACES = [
  {
    face: 'font-hand-caveat font-semibold',
    md: 'text-[1.4375rem] leading-7',
    lg: 'text-[1.75rem] leading-8',
  },
  {
    face: 'font-hand-kalam font-normal',
    md: 'text-[1.125rem] leading-7',
    lg: 'text-[1.3125rem] leading-8',
  },
  {
    face: 'font-hand-shadows font-normal',
    md: 'text-[1.25rem] leading-7',
    lg: 'text-[1.5rem] leading-8',
  },
  {
    face: 'font-hand-rainbow font-normal',
    md: 'text-[1.1875rem] leading-7',
    lg: 'text-[1.375rem] leading-8',
  },
  {
    face: 'font-hand-indie font-normal',
    md: 'text-[1.25rem] leading-7',
    lg: 'text-[1.5rem] leading-8',
  },
  {
    face: 'font-hand-handrawn font-normal',
    md: 'text-[1.25rem] leading-7',
    lg: 'text-[1.5rem] leading-8',
  },
  {
    face: 'font-hand-aurore font-normal',
    md: 'text-[1.3125rem] leading-7',
    lg: 'text-[1.625rem] leading-8',
  },
] as const satisfies readonly FaceLook[];

/** The face numbers, as a closed type: 0 to 6, one for each entry of {@link FACES}. */
const FACE_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const satisfies readonly number[];

/** Which of the faces a name is set in: an index into the table above, 0 to 6. */
export type HandwritingFace = (typeof FACE_INDEXES)[number];

/**
 * A name as it is compared: Unicode-normalised, lower-cased, and with every run
 * of whitespace (including the non-breaking and ideographic kinds) collapsed to
 * one space and the ends trimmed. So "ethan chlebowski", "Ethan  Chlebowski"
 * and " ETHAN CHLEBOWSKI\n" are one person to this component.
 */
function normalisedName(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * A 32-bit hash of a string: FNV-1a over its UTF-16 code units, then one round
 * of the murmur3 finaliser. Both are fixed, public algorithms with no seed, so
 * the number is the same in every browser, on the server and in every future
 * release, which is the whole point: the same person must wear the same
 * handwriting on every page and every visit. (`Math.random`, `Map` iteration
 * order and object-key order would each break that.) The finaliser is there
 * because FNV on its own spreads short, similar strings (a first name and a
 * surname) unevenly across the low bits that the final `% 7` keeps.
 */
function hashOf(text: string): number {
  const fnv = Array.from({ length: text.length }, (_, index) =>
    text.charCodeAt(index),
  ).reduce((hash, unit) => Math.imul(hash ^ unit, 0x01000193), 0x811c9dc5);
  const half = Math.imul(fnv ^ (fnv >>> 16), 0x85ebca6b);
  const whole = Math.imul(half ^ (half >>> 13), 0xc2b2ae35);
  return (whole ^ (whole >>> 16)) >>> 0;
}

/**
 * Which handwriting face a person's name is set in.
 *
 * The answer depends only on the name, ignoring case and spacing, so the same
 * author looks the same on every recipe and every visit, and different authors
 * spread across all seven faces. Anything is safe to pass: an empty or
 * whitespace-only string simply gets a face too (the same one every time).
 *
 * @param name The person's name, as the recipe's file gives it (untrusted).
 */
export function handwritingFor(name: string): HandwritingFace {
  return FACE_INDEXES[hashOf(normalisedName(name)) % FACE_INDEXES.length] ?? 0;
}

/** The sizes a name comes in. */
type NameSize = 'md' | 'lg';

/** The elements a name can be drawn as. */
type NameElement = 'span' | 'p' | 'div' | 'strong';

/**
 * A person's name, set in handwriting so it reads as a person's and not as more
 * interface text. The face is chosen from the name itself (see
 * {@link handwritingFor}), so one person always looks the same wherever they
 * appear; only this component uses these faces, never body text.
 *
 * It is always one line: a name too long for its space is cut with an ellipsis
 * (and said in full in the `title`) instead of widening the page, which matters
 * at 320px. The right padding is not decoration: the cut-off box would
 * otherwise clip the overhang of the last letter's stroke. The name is untrusted
 * text from a recipe file, so it is only ever drawn as text.
 */
export function AuthorName({
  name,
  size = 'md',
  as: Element = 'span',
}: Readonly<{
  /** The person's name. */
  name: string;
  /** How large to draw it: `md` beside text, `lg` under a title. */
  size?: NameSize;
  /** The element to render; a `span` unless it stands alone as a block of its own. */
  as?: NameElement;
}>): ReactElement {
  const look = FACES[handwritingFor(name)];
  return (
    <Element
      title={name}
      className={cn(
        'text-ink inline-block max-w-full min-w-0 truncate pr-1 align-bottom',
        look.face,
        look[size],
      )}
    >
      {name}
    </Element>
  );
}
