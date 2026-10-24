import { AMOUNT_PATTERN, parseAmount } from '@/components/recipe/amount';

/** How many milliseconds each unit of time a recipe may name is worth. */
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** The ways a recipe spells a unit of time, and what each is worth. */
const UNIT_MS: Readonly<Record<string, number>> = {
  s: SECOND,
  sec: SECOND,
  secs: SECOND,
  second: SECOND,
  seconds: SECOND,
  m: MINUTE,
  min: MINUTE,
  mins: MINUTE,
  minute: MINUTE,
  minutes: MINUTE,
  h: HOUR,
  hr: HOUR,
  hrs: HOUR,
  hour: HOUR,
  hours: HOUR,
};

/**
 * The longest countdown cook mode will run. A recipe that says "48 hours" is
 * marinating, not standing at the stove, and a timer that long would only ever
 * be a mistake in the label.
 */
const LONGEST_MS = 24 * HOUR;

/**
 * One term of a duration: an amount, optionally a range's far end that is
 * ignored (a range counts from its lower bound), and the unit if it has one.
 */
const TERM = new RegExp(
  `(?<amount>${AMOUNT_PATTERN})(?:\\s*(?:[-–—]|to)\\s*(?:${AMOUNT_PATTERN}))?\\s*(?<unit>[a-z]+)?`,
  'gi',
);

/** A range written with spaces around its dash or "to": "1 hour - 1 hour 30 min". */
const SPACED_RANGE = /\s(?:[-–—]|to)\s/i;

/** What a bare number means after a term in this unit: "1h30" is 30 minutes. */
const IMPLIED_UNIT_MS: Readonly<Record<number, number>> = {
  [HOUR]: MINUTE,
  [MINUTE]: SECOND,
};

/** One term read from the label: its amount, and its unit if it was written. */
interface Term {
  readonly amount: number;
  readonly unitMs: number | undefined;
}

/** What may sit between two terms that belong together: "1 hour and 30 minutes", "1 hr, 30 min". */
const CONNECTOR = /^\s*(?:,|and|&|\+)?\s*$/i;

/**
 * The terms at the start of the label that run on from one another. A label
 * like "10 minutes, stirring every 2 minutes" asks for ten minutes, not twelve,
 * so the sum stops at the first term that is not joined to the one before.
 */
function leadingRun(label: string): readonly RegExpExecArray[] {
  const matches = [...label.matchAll(TERM)];
  const gap = matches.findIndex((match, i) => {
    const before = matches[i - 1];
    return (
      before !== undefined &&
      !CONNECTOR.test(label.slice(before.index + before[0].length, match.index))
    );
  });
  return gap === -1 ? matches : matches.slice(0, gap);
}

/** The terms of a label, with an unknown unit word kept as `NaN` so it spoils the sum. */
function termsOf(label: string): readonly Term[] {
  return leadingRun(label).map(({ groups }) => {
    const amount = parseAmount(groups?.['amount'] ?? '');
    const word = groups?.['unit']?.toLowerCase();
    return {
      amount: amount ?? Number.NaN,
      unitMs: word === undefined ? undefined : (UNIT_MS[word] ?? Number.NaN),
    };
  });
}

/**
 * The total of a run of terms, or `null` if any term cannot be read. A term
 * with no unit takes the one that naturally follows the previous term's, so
 * "1h30" and "1 hr 30" are an hour and a half, and a bare first number is
 * unreadable.
 */
function totalOf(terms: readonly Term[]): number | null {
  const summed = terms.reduce<{
    readonly total: number;
    readonly previous: number | undefined;
  }>(
    ({ total, previous }, term) => {
      const unitMs =
        term.unitMs ??
        (previous === undefined ? undefined : IMPLIED_UNIT_MS[previous]);
      return {
        total: total + term.amount * (unitMs ?? Number.NaN),
        previous: unitMs,
      };
    },
    { total: 0, previous: undefined },
  );
  return terms.length > 0 &&
    Number.isFinite(summed.total) &&
    summed.total > 0 &&
    summed.total <= LONGEST_MS
    ? Math.round(summed.total)
    : null;
}

/**
 * How long a timer label in a recipe asks for, in milliseconds, or `null` when
 * it cannot be turned into a countdown (no number, an unknown unit such as
 * "3 eggs", something longer than a day).
 *
 * Understands "5 minutes", "90 seconds", "1.5 hours", "1/2 hour", "1 hr 30 min",
 * "1h30", "1 hour and 30 minutes". A range such as "1-2 hours" or "5 to 10
 * minutes" counts from its lower bound, because the cook can always add time
 * and cannot take it back.
 *
 * @param label The timer's label as the recipe wrote it.
 */
export function parseDurationMs(label: string): number | null {
  // "1 hour - 1 hour 30 min" is a range between two durations; take the first.
  const lower = label.split(SPACED_RANGE)[0] ?? label;
  return totalOf(termsOf(lower)) ?? totalOf(termsOf(label));
}
