import { describe, expect, it } from '@jest/globals';

import {
  NO_DATA_MESSAGE,
  everyEntry,
  isRecord,
  isString,
  readOutcome,
  textOf,
} from '@/views/payload';

/** The data a View in these tests draws: a list of names. */
interface Names {
  readonly names: readonly string[];
}

/** Whether the value has the shape of {@link Names}. */
function isNames(value: unknown): value is Names {
  return isRecord(value) && everyEntry(value['names'], isString);
}

const NAMES: Names = { names: ['one', 'two'] };

describe('isRecord', () => {
  it('accepts objects and arrays, and nothing else', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('text')).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe('isString', () => {
  it('accepts strings only', () => {
    expect(isString('')).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isString(null)).toBe(false);
  });
});

describe('everyEntry', () => {
  it('accepts an array whose every entry passes, empty or not', () => {
    expect(everyEntry(['a', 'b'], isString)).toBe(true);
    expect(everyEntry([], isString)).toBe(true);
  });

  it('refuses an array with one entry that fails, and anything not an array', () => {
    expect(everyEntry(['a', 1], isString)).toBe(false);
    expect(everyEntry('ab', isString)).toBe(false);
    expect(everyEntry(undefined, isString)).toBe(false);
  });
});

describe('textOf', () => {
  it('joins the text blocks and skips everything else', () => {
    expect(
      textOf([
        { type: 'text', text: 'one' },
        { type: 'image', data: 'x' },
        { type: 'text', text: 'two' },
        null,
        { type: 'text', text: 3 },
      ]),
    ).toBe('one\n\ntwo');
  });

  it('is empty for no content', () => {
    expect(textOf(undefined)).toBe('');
    expect(textOf([])).toBe('');
  });
});

describe('readOutcome', () => {
  it('returns the data when the result carries it', () => {
    expect(
      readOutcome({ structuredContent: NAMES, content: [] }, isNames),
    ).toEqual({ kind: 'data', data: NAMES });
  });

  it('turns an error result into its message, not a loading state', () => {
    expect(
      readOutcome(
        {
          isError: true,
          content: [{ type: 'text', text: 'Nothing found for "soup".' }],
        },
        isNames,
      ),
    ).toEqual({
      kind: 'message',
      text: 'Nothing found for "soup".',
      isError: true,
    });
  });

  it('does not trust data in a result that is flagged as an error', () => {
    expect(
      readOutcome(
        { isError: true, structuredContent: NAMES, content: [] },
        isNames,
      ),
    ).toMatchObject({ kind: 'message', isError: true });
  });

  it('shows the text of a result without structured content, as a note', () => {
    expect(
      readOutcome(
        { content: [{ type: 'text', text: 'Nothing saved yet.' }] },
        isNames,
      ),
    ).toEqual({ kind: 'message', text: 'Nothing saved yet.', isError: false });
  });

  it('treats data of the wrong shape as a message too', () => {
    expect(
      readOutcome({ structuredContent: { names: 5 } }, isNames),
    ).toMatchObject({ kind: 'message', text: NO_DATA_MESSAGE });
  });
});
