import { describe, expect, it } from '@jest/globals';

import {
  canonicalArguments,
  limitArg,
  numberArg,
  offsetArg,
  stringArg,
  stringListArg,
} from '@/lib/mcp';
import { ARGUMENT_ALIASES, LISTS_OF_TEXT } from '@/domain/mcp/app';

describe('stringArg', () => {
  it('trims a string and gives empty for anything else', () => {
    expect(stringArg('  hi ')).toBe('hi');
    expect(stringArg(undefined)).toBe('');
    expect(stringArg(5)).toBe('');
    expect(stringArg(null)).toBe('');
  });
});

describe('stringListArg', () => {
  it('takes one value or a list, splitting commas and dropping blanks', () => {
    expect(stringListArg('a, b')).toEqual(['a', 'b']);
    expect(stringListArg(['a', ' ', 'b,c'])).toEqual(['a', 'b', 'c']);
    expect(stringListArg(undefined)).toEqual([]);
  });

  it('counts numbers as strings and ignores other kinds of value', () => {
    expect(stringListArg([5, true, null, {}, 'x'])).toEqual(['5', 'x']);
  });
});

describe('numberArg', () => {
  it('accepts numbers and numeric strings only', () => {
    expect(numberArg(5)).toBe(5);
    expect(numberArg(' 7 ')).toBe(7);
    expect(numberArg('')).toBeUndefined();
    expect(numberArg('abc')).toBeUndefined();
    expect(numberArg(Infinity)).toBeUndefined();
    expect(numberArg(null)).toBeUndefined();
  });
});

describe('limitArg', () => {
  it('defaults to 12 and keeps the limit between 1 and 50', () => {
    expect(limitArg(undefined)).toBe(12);
    expect(limitArg(0)).toBe(1);
    expect(limitArg(-4)).toBe(1);
    expect(limitArg(500)).toBe(50);
    expect(limitArg('7')).toBe(7);
  });

  it('rounds down to a whole number', () => {
    expect(limitArg(2.9)).toBe(2);
  });
});

describe('offsetArg', () => {
  it('defaults to the start and never goes below it', () => {
    expect(offsetArg(undefined)).toBe(0);
    expect(offsetArg(-5)).toBe(0);
    expect(offsetArg('abc')).toBe(0);
    expect(offsetArg(null)).toBe(0);
  });

  it('rounds down to a whole number', () => {
    expect(offsetArg(12)).toBe(12);
    expect(offsetArg('24')).toBe(24);
    expect(offsetArg(2.9)).toBe(2);
  });
});

/** Every older spelling this app accepts: the tool, the alias and the name it stands for. */
const ALIASES = Object.entries(ARGUMENT_ALIASES).flatMap(([tool, names]) =>
  Object.entries(names).map(([alias, canonical]) => [tool, alias, canonical]),
);

/** Every argument this app accepts as one piece of text for a list: the tool and the argument. */
const LISTS = Object.entries(LISTS_OF_TEXT).flatMap(([tool, names]) =>
  names.map((name) => [tool, name]),
);

/** One of the aliases, for the tests that need just one. */
const [[TOOL = '', ALIAS = '', CANONICAL = ''] = []] = ALIASES;

/** One of the list arguments, for the tests that need just one. */
const [[LIST_TOOL = '', LIST = ''] = []] = LISTS;

/** What an argument sent as `value` under its canonical name ends up as. */
function settled(tool: string, name: string, value: string): unknown {
  return LISTS_OF_TEXT[tool]?.includes(name) ? [value] : value;
}

describe('canonicalArguments', () => {
  it('has an older spelling and a list of text to check', () => {
    expect(ALIASES).not.toHaveLength(0);
    expect(LISTS).not.toHaveLength(0);
  });

  it.each(ALIASES)(
    'renames the older spelling of an argument of %s (%s)',
    (tool, alias, canonical) => {
      expect(canonicalArguments(tool, { [alias]: 'x' })).toEqual({
        [canonical]: settled(tool, canonical, 'x'),
      });
    },
  );

  it('keeps every other argument as it is', () => {
    expect(
      canonicalArguments(TOOL, { [ALIAS]: 'x', limit: 3, other_argument: 'y' }),
    ).toEqual({
      [CANONICAL]: settled(TOOL, CANONICAL, 'x'),
      limit: 3,
      other_argument: 'y',
    });
  });

  it('leaves both spellings alone when both are given, so the check can refuse the older one', () => {
    expect(
      canonicalArguments(TOOL, { [ALIAS]: 'a', [CANONICAL]: ['b'] }),
    ).toEqual({ [ALIAS]: 'a', [CANONICAL]: ['b'] });
  });

  it('does not rename an argument of a tool that never had the older spelling', () => {
    expect(canonicalArguments('not_a_known_tool', { [ALIAS]: 'x' })).toEqual({
      [ALIAS]: 'x',
    });
    expect(canonicalArguments('constructor', { [ALIAS]: 'x' })).toEqual({
      [ALIAS]: 'x',
    });
  });

  it.each(LISTS)(
    'turns %s %s given as one piece of text into a list of one',
    (tool, name) => {
      expect(canonicalArguments(tool, { [name]: 'one thing' })).toEqual({
        [name]: ['one thing'],
      });
    },
  );

  it('leaves a list, and any other value, for the check to judge', () => {
    expect(canonicalArguments(LIST_TOOL, { [LIST]: ['a'] })).toEqual({
      [LIST]: ['a'],
    });
    expect(canonicalArguments(LIST_TOOL, { [LIST]: 5 })).toEqual({
      [LIST]: 5,
    });
    expect(canonicalArguments(LIST_TOOL, { limit: '5' })).toEqual({
      limit: '5',
    });
  });

  it('carries a key called __proto__ as an ordinary property', () => {
    const args = JSON.parse(`{"__proto__": 1, "${ALIAS}": "x"}`) as Record<
      string,
      unknown
    >;
    const result = canonicalArguments(TOOL, args);
    expect(Object.keys(result).toSorted()).toEqual(
      ['__proto__', CANONICAL].toSorted(),
    );
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
