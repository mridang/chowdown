import { describe, expect, it } from '@jest/globals';

import {
  appendCookingLog,
  buildStubSource,
  extractCookingLogs,
  isUncurated,
  recipeDisplayName,
  sanitiseName,
  uncuratedFilename,
} from '../../../src/lib/recipe/cook-text';

describe('uncurated filenames', () => {
  it('builds a marked filename', () => {
    expect(uncuratedFilename('paneer ki sabji')).toBe(
      'paneer ki sabji [uncurated].cook',
    );
  });

  it('sanitises slashes and whitespace', () => {
    expect(sanitiseName('  chicken /  rice  ')).toBe('chicken rice');
    expect(uncuratedFilename('')).toBe('untitled [uncurated].cook');
  });

  it('detects the uncurated marker', () => {
    expect(isUncurated('paneer ki sabji [uncurated].cook')).toBe(true);
    expect(isUncurated('pancakes.cook')).toBe(false);
  });

  it('derives a clean display name', () => {
    expect(recipeDisplayName('pancakes.cook')).toBe('pancakes');
    expect(recipeDisplayName('paneer ki sabji [uncurated].cook')).toBe(
      'paneer ki sabji',
    );
  });
});

describe('buildStubSource', () => {
  const src = buildStubSource({
    name: 'paneer ki sabji',
    prompt: 'I should figure out how to make paneer ki sabji\nlike mom did',
    when: new Date('2026-10-11T08:00:00Z'),
  });

  it('sets title, status and created date', () => {
    expect(src).toContain('>> title: paneer ki sabji');
    expect(src).toContain('>> status: uncurated');
    expect(src).toContain('>> created: 2026-10-11');
  });

  it('preserves the original prompt verbatim as comments', () => {
    expect(src).toContain(
      '-- I should figure out how to make paneer ki sabji',
    );
    expect(src).toContain('-- like mom did');
  });

  it('uses a provided draft as the method', () => {
    const withDraft = buildStubSource({
      name: 'x',
      prompt: 'p',
      draft: 'Fry @paneer{200%g} in a #pan{}.',
    });
    expect(withDraft).toContain('Fry @paneer{200%g} in a #pan{}.');
  });
});

describe('cooking logs', () => {
  it('appends a dated entry without touching existing text', () => {
    const base = '>> title: Bolognese\n\nSimmer the @sauce{}.';
    const next = appendCookingLog(
      base,
      'Used 500 g pork and 1 L milk. Great.',
      new Date('2026-10-11T19:00:00Z'),
    );
    expect(next.startsWith(base)).toBe(true);
    expect(next).toContain(
      '-- [cook 2026-10-11] Used 500 g pork and 1 L milk. Great.',
    );
  });

  it('flattens multi-line notes to one comment line', () => {
    const next = appendCookingLog('x', 'line one\nline two', new Date());
    expect(next).toMatch(/-- \[cook \d{4}-\d{2}-\d{2}\] line one line two/);
  });

  it('round-trips entries via extractCookingLogs', () => {
    let src = '>> title: T\n\nCook it.';
    src = appendCookingLog(src, 'first', new Date('2026-01-01T00:00:00Z'));
    src = appendCookingLog(src, 'second', new Date('2026-02-02T00:00:00Z'));
    expect(extractCookingLogs(src)).toEqual([
      { date: '2026-01-01', note: 'first' },
      { date: '2026-02-02', note: 'second' },
    ]);
  });
});
