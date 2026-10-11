import { describe, expect, it } from '@jest/globals';

import {
  extractUrls,
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
