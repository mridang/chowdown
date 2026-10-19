import { describe, expect, it } from '@jest/globals';

import {
  extractUrls,
  MAX_IMPORT_UNITS,
  planImport,
  splitTextBlocks,
} from '../../../src/lib/recipe/import-blob';

describe('extractUrls', () => {
  it('pulls out http(s) URLs in order', () => {
    expect(
      extractUrls('see https://a.com/x and http://b.com/y please'),
    ).toEqual(['https://a.com/x', 'http://b.com/y']);
  });
  it('trims trailing punctuation', () => {
    expect(extractUrls('recipe at https://a.com/pasta.')).toEqual([
      'https://a.com/pasta',
    ]);
    expect(extractUrls('(https://a.com/x)')).toEqual(['https://a.com/x']);
  });
  it('de-duplicates', () => {
    expect(extractUrls('https://a.com x https://a.com')).toEqual([
      'https://a.com',
    ]);
  });
  it('returns [] when there are no links', () => {
    expect(extractUrls('just some text')).toEqual([]);
  });
});

describe('splitTextBlocks', () => {
  it('splits on blank-line gaps and drops noise', () => {
    const blocks = splitTextBlocks(
      'Pancakes: mix flour and eggs, then fry.\n\nOmelette: beat eggs and cook in butter.\n\nok',
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('Pancakes');
    expect(blocks[1]).toContain('Omelette');
  });
  it('splits on a markdown horizontal rule', () => {
    const blocks = splitTextBlocks(
      'First recipe with enough text here.\n---\nSecond recipe with enough text too.',
    );
    expect(blocks).toHaveLength(2);
  });
});

describe('planImport', () => {
  it('lists URLs first, then prose blocks', () => {
    const units = planImport(
      'https://a.com/pasta\n\nGuacamole: mash avocado with lime and salt.',
    );
    expect(units[0]).toEqual({ kind: 'url', url: 'https://a.com/pasta' });
    expect(units[1]?.kind).toBe('text');
    expect(units[1]).toMatchObject({ kind: 'text' });
  });
  it('handles a links-only paste', () => {
    const units = planImport('https://a.com/x\nhttps://b.com/y');
    expect(units).toEqual([
      { kind: 'url', url: 'https://a.com/x' },
      { kind: 'url', url: 'https://b.com/y' },
    ]);
  });
  it('is empty for whitespace', () => {
    expect(planImport('   \n  ')).toEqual([]);
  });
});

/** How long `work` takes, in milliseconds. */
function milliseconds(work: () => unknown): number {
  const started = performance.now();
  work();
  return performance.now() - started;
}

describe('hostile text', () => {
  it('trims a long run of trailing punctuation in linear time', () => {
    const text = `see http://a.com/${'.'.repeat(90_000)}x and http://b.com/${'.'.repeat(5000)}`;
    expect(milliseconds(() => extractUrls(text))).toBeLessThan(100);
    expect(extractUrls(text)).toEqual([
      `http://a.com/${'.'.repeat(90_000)}x`,
      'http://b.com/',
    ]);
  });

  it('plans thousands of links in linear time', () => {
    const text = Array.from({ length: 5000 }, (_, i) => `http://a.b/${i}`).join(
      ' ',
    );
    expect(milliseconds(() => planImport(text))).toBeLessThan(200);
    expect(planImport(text)).toHaveLength(5000);
  });

  it('splits whitespace-heavy text in linear time', () => {
    const text = `\n${' '.repeat(90_000)}x\n${' \t'.repeat(5000)}y`;
    expect(milliseconds(() => splitTextBlocks(text))).toBeLessThan(100);
  });
});

describe('MAX_IMPORT_UNITS', () => {
  it('is a handful, so one request cannot start unbounded work', () => {
    expect(MAX_IMPORT_UNITS).toBe(10);
  });
});

describe('planImport leftovers', () => {
  it('keeps the punctuation that followed a link in the prose', () => {
    expect(
      planImport(
        'https://a.com/x. Boil water and add the pasta to it, then drain.',
      ),
    ).toEqual([
      { kind: 'url', url: 'https://a.com/x' },
      {
        kind: 'text',
        text: '. Boil water and add the pasta to it, then drain.',
      },
    ]);
  });
});
