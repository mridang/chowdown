import type { StepToken } from '@/lib/recipe/cooklang';

import { AMOUNT_PATTERN, parseAmount } from './amount';

/**
 * A step turned into the words someone would say, for a speech synthesiser.
 *
 * The page shows "onion (2)" and "1/2 tsp"; spoken, the first reads oddly and
 * the second can be read as a date ("January second"). So amounts are spelled
 * the way a person reads a recipe aloud: "half a teaspoon", "200 grams".
 */

/** How a unit is said, singular and plural, keyed by the abbreviations recipes use. */
const UNIT_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  g: ['gram', 'grams'],
  gr: ['gram', 'grams'],
  kg: ['kilogram', 'kilograms'],
  mg: ['milligram', 'milligrams'],
  ml: ['millilitre', 'millilitres'],
  l: ['litre', 'litres'],
  tsp: ['teaspoon', 'teaspoons'],
  tbsp: ['tablespoon', 'tablespoons'],
  tbs: ['tablespoon', 'tablespoons'],
  oz: ['ounce', 'ounces'],
  lb: ['pound', 'pounds'],
  lbs: ['pound', 'pounds'],
  sec: ['second', 'seconds'],
  secs: ['second', 'seconds'],
  s: ['second', 'seconds'],
  min: ['minute', 'minutes'],
  mins: ['minute', 'minutes'],
  m: ['minute', 'minutes'],
  hr: ['hour', 'hours'],
  hrs: ['hour', 'hours'],
  h: ['hour', 'hours'],
};

/** Fractions that have a natural spoken form, as a part of something and as a part of a whole number. */
const FRACTION_WORDS: readonly {
  readonly value: number;
  readonly part: string;
  readonly extra: string;
}[] = [
  { value: 0.25, part: 'a quarter', extra: 'a quarter' },
  { value: 1 / 3, part: 'a third', extra: 'a third' },
  { value: 0.5, part: 'half', extra: 'a half' },
  { value: 2 / 3, part: 'two thirds', extra: 'two thirds' },
  { value: 0.75, part: 'three quarters', extra: 'three quarters' },
];

/** Whether two numbers are the same to within the rounding of a fraction like a third. */
function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

/** The spoken fraction for a part (the 0.x of a number), or `undefined` if it has no natural words. */
function fractionWords(
  fraction: number,
  form: 'part' | 'extra',
): string | undefined {
  return FRACTION_WORDS.find(({ value }) => near(value, fraction))?.[form];
}

/** An amount said in words, and whether the unit after it is then singular ("half a teaspoon"). */
interface Phrase {
  readonly words: string;
  readonly singular: boolean;
}

/**
 * One amount in words. Whole numbers and decimals are left as digits for the
 * synthesiser to read; halves, thirds and quarters become words; anything else
 * is left as written.
 *
 * @param text The amount as written, such as `1 1/2` or `½`.
 * @param withUnit Whether a unit follows, which makes "half" read "half a" and
 *   the unit singular.
 */
function amountPhrase(text: string, withUnit: boolean): Phrase {
  const value = parseAmount(text);
  if (value === null) {
    return { words: text, singular: false };
  }
  const whole = Math.floor(value);
  const fraction = value - whole;
  if (near(fraction, 0)) {
    return { words: String(whole), singular: whole === 1 };
  }
  if (whole === 0) {
    const part = fractionWords(fraction, 'part');
    if (part === undefined) {
      return { words: text, singular: false };
    }
    return withUnit
      ? { words: part === 'half' ? 'half a' : `${part} of a`, singular: true }
      : { words: part, singular: false };
  }
  const extra = fractionWords(fraction, 'extra');
  return {
    words: extra === undefined ? String(value) : `${whole} and ${extra}`,
    singular: false,
  };
}

/** A unit as it is said: singular or plural as asked; unknown words pass through. */
function unitWords(unit: string, singular: boolean): string {
  const words = UNIT_WORDS[unit.toLowerCase().replace(/\.$/, '')];
  return words ? words[singular ? 0 : 1] : unit;
}

/** `5 min`, `1/2 tsp`, `1-2 hours`: an amount, an optional range end, then the rest. */
const QUANTITY = new RegExp(
  `^(?<from>${AMOUNT_PATTERN})(?:\\s*(?:[-–—]|to)\\s*(?<to>${AMOUNT_PATTERN}))?\\s*(?<rest>.*)$`,
  'i',
);

/**
 * A quantity or timer label as it should be spoken: "200 g" becomes "200
 * grams", "1/2 tsp" becomes "half a teaspoon", "1-2 hours" becomes "1 to 2
 * hours". Text that does not start with an amount ("to taste") is returned as
 * it is.
 *
 * @param label The quantity as the page shows it.
 */
export function spokenQuantity(label: string): string {
  const groups = QUANTITY.exec(label.trim())?.groups;
  const from = groups?.['from'];
  if (from === undefined) {
    return label;
  }
  const to = groups?.['to'];
  const [unit = '', ...tail] = (groups?.['rest'] ?? '').trim().split(/\s+/);
  const hasUnit = unit !== '';
  const amount =
    to === undefined
      ? amountPhrase(from, hasUnit)
      : {
          words: `${amountPhrase(from, false).words} to ${amountPhrase(to, false).words}`,
          singular: false,
        };
  return [
    amount.words,
    hasUnit ? unitWords(unit, amount.singular) : '',
    ...tail,
  ]
    .filter((word) => word !== '')
    .join(' ');
}

/** Temperatures read better with their words: "180°C" is "180 degrees Celsius". */
function speakDegrees(text: string): string {
  return text
    .replace(/(\d)\s?°\s?C\b/g, '$1 degrees Celsius')
    .replace(/(\d)\s?°\s?F\b/g, '$1 degrees Fahrenheit')
    .replace(/(\d)\s?°/g, '$1 degrees');
}

/** Tidy the joined words: single spaces, no space before punctuation, no doubled commas. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,(\s*,)+/g, ',')
    .replace(/,\s*([.;:!?])/g, '$1')
    .trim();
}

/** One token as it is said. */
function spokenToken(
  token: StepToken,
  scale: (quantity: string) => string,
): string {
  switch (token.kind) {
    case 'text':
      return token.text;
    case 'cookware':
      return token.name;
    case 'timer':
      return spokenQuantity(token.label);
    case 'ingredient':
      return token.quantity
        ? `${token.name}, ${spokenQuantity(scale(token.quantity))},`
        : token.name;
  }
}

/**
 * The words to read a step aloud: its text, with each ingredient followed by
 * its amount for the servings and units chosen, timers spelled out, and
 * optionally the step number first.
 *
 * @param tokens The step.
 * @param options `quantity` turns an amount into what the page currently shows
 *   (scaled, converted); `number` is the step's number to say first.
 */
export function spokenStep(
  tokens: readonly StepToken[],
  options: Readonly<{
    quantity?: (quantity: string) => string;
    number?: number;
  }> = {},
): string {
  const { quantity = (q: string) => q, number } = options;
  const body = tidy(
    speakDegrees(tokens.map((token) => spokenToken(token, quantity)).join('')),
  );
  return number === undefined ? body : `Step ${number}. ${body}`;
}
