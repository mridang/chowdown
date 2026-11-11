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

/** A stable tone for a recipe, so its placeholder colour doesn't change. */
export function toneFor(text: string): Tone {
  // A small rolling hash over the characters; kept below 997 so it never
  // outgrows a safe integer however long the text is.
  const hash = [...text].reduce(
    // eslint-disable-next-line unicorn/prefer-code-point -- codePointAt would change the hash for names with emoji and move those recipes to another colour
    (sum, char) => (sum * 31 + char.charCodeAt(0)) % 997,
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
  // eslint-disable-next-line sonarjs/super-linear-regex -- the spacing rule has to stay exact (a title keeps spaces that are not around a separator), and page titles are short
  return (title.split(/\s+[|–—]\s+/, 1)[0] ?? title).trim() || title;
}

/** The difficulties a tag can name, in order. */
const LEVELS: readonly DifficultyLevel[] = ['Easy', 'Medium', 'Hard'];

/** The difficulty a tag value names, or nothing if it isn't one of the three. */
export function levelOf(
  value: string | undefined,
): DifficultyLevel | undefined {
  return LEVELS.find((level) => level === value);
}
