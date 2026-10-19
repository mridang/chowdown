/**
 * Reading an amount the way a recipe writes it: `5`, `1.5`, `1/2`, `1 1/2`,
 * `½`, `1½`. Cook mode needs this twice, once to turn "1-2 hours" into a
 * countdown and once to say "1/2 tsp" aloud as "half a teaspoon", so the one
 * pattern and the one reader live here.
 */

/** The vulgar fractions a recipe may use instead of `1/2`, with their values. */
const UNICODE_FRACTIONS: Readonly<Record<string, number>> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};

/**
 * The regular expression source for one amount, to be placed inside a larger
 * pattern. Most specific forms first so `1 1/2` is one amount, not `1` and then
 * `1/2`. It has no capture groups, so it can be embedded freely.
 */
export const AMOUNT_PATTERN =
  String.raw`\d+\s?[¼½¾⅓⅔]` +
  String.raw`|\d+\s+\d+/\d+` +
  String.raw`|\d+/\d+` +
  String.raw`|\d+(?:[.,]\d+)?` +
  String.raw`|[¼½¾⅓⅔]`;

/** The shapes an amount can take, each with the groups it needs. */
const SHAPES: readonly {
  readonly pattern: RegExp;
  readonly value: (groups: Readonly<Record<string, string>>) => number;
}[] = [
  {
    // 1½
    pattern: /^(?<whole>\d+)\s?(?<fraction>[¼½¾⅓⅔])$/,
    value: ({ whole = '0', fraction = '' }) =>
      Number(whole) + (UNICODE_FRACTIONS[fraction] ?? 0),
  },
  {
    // ½
    pattern: /^(?<fraction>[¼½¾⅓⅔])$/,
    value: ({ fraction = '' }) => UNICODE_FRACTIONS[fraction] ?? 0,
  },
  {
    // 1 1/2
    pattern: /^(?<whole>\d+)\s+(?<top>\d+)\/(?<bottom>\d+)$/,
    value: ({ whole = '0', top = '0', bottom = '0' }) =>
      Number(whole) + Number(top) / Number(bottom),
  },
  {
    // 1/2
    pattern: /^(?<top>\d+)\/(?<bottom>\d+)$/,
    value: ({ top = '0', bottom = '0' }) => Number(top) / Number(bottom),
  },
  {
    // 1.5 or 1,5
    pattern: /^(?<plain>\d+(?:[.,]\d+)?)$/,
    value: ({ plain = '0' }) => Number(plain.replace(',', '.')),
  },
];

/**
 * The number an amount stands for, or `null` when the text is not an amount
 * (or divides by zero).
 *
 * @param text One amount such as `1 1/2`, `½` or `2,5`, without a unit.
 */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  const shape = SHAPES.find(({ pattern }) => pattern.test(trimmed));
  const groups = shape ? groupsOf(shape.pattern, trimmed) : {};
  const value = shape?.value(groups);
  return value !== undefined && Number.isFinite(value) ? value : null;
}

/** The named groups of a match; empty when it did not match. */
function groupsOf(
  pattern: RegExp,
  text: string,
): Readonly<Record<string, string>> {
  return pattern.exec(text)?.groups ?? {};
}
