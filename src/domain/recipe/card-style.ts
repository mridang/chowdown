/**
 * @packageDocumentation
 *
 * The small pure pieces of a recipe card: its placeholder colour, its tidied
 * title and its difficulty. Kept apart from the card data so the browser can
 * use them without pulling in the database and Drive code that builds cards
 * from cached rows.
 */

/** A soft colour a recipe without a photo wears instead. */
export type Tone = 'flame' | 'marigold' | 'forest' | 'sand' | 'ink';

/** How hard a recipe is to cook, as the recipe's own `difficulty` tag says. */
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

/** The placeholder colours, in the order a hash picks from them. */
const TONES = ['flame', 'marigold', 'forest', 'sand', 'ink'] as const;

/**
 * The first UTF-16 unit of a single character: for one outside the BMP that is
 * its high surrogate, which keeps the tones of names with emoji where they were.
 */
function firstUnit(char: string): number {
  const point = char.codePointAt(0) ?? 0;
  return point > 0xff_ff
    ? 0xd8_00 + Math.floor((point - 0x1_00_00) / 0x4_00)
    : point;
}

/** A stable tone for a recipe, so its placeholder colour doesn't change. */
export function toneFor(text: string): Tone {
  // A small rolling hash over the characters; kept below 997 so it never
  // outgrows a safe integer however long the text is.
  const hash = [...text].reduce(
    (sum, char) => (sum * 31 + firstUnit(char)) % 997,
    0,
  );
  return TONES.at(hash % TONES.length) ?? TONES[0];
}

/**
 * Tidy a scraped page title for display: sites often append their own name or a
 * tagline ("Chicken Chettinad | Chettinad Chicken Recipe"), so keep the part
 * before the first separator.
 */
export function cleanTitle(title: string): string {
  // The first separator with whitespace on both sides ends the title.
  for (const found of title.matchAll(/[|–—]/g)) {
    const at = found.index;
    if (/\s/.test(title.charAt(at - 1)) && /\s/.test(title.charAt(at + 1))) {
      return title.slice(0, at).trim() || title;
    }
  }
  return title.trim() || title;
}

/** The difficulties a tag can name, in order. */
const LEVELS: readonly DifficultyLevel[] = ['Easy', 'Medium', 'Hard'];

/** The difficulty a tag value names, or nothing if it isn't one of the three. */
export function levelOf(
  value: string | undefined,
): DifficultyLevel | undefined {
  return LEVELS.find((level) => level === value);
}
