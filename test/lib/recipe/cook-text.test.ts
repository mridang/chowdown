import { describe, expect, it } from '@jest/globals';

import {
  appendCookingLog,
  appendNote,
  buildStubSource,
  extractCookingLogs,
  extractNotes,
  isUncurated,
  normalizeSourceUrl,
  removeEmptyMetadata,
  removeMetadata,
  recipeDisplayName,
  sanitiseName,
  sourceUrlOf,
  uncuratedFilename,
  upsertMetadata,
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
    expect(src).toContain('-- I should figure out how to make paneer ki sabji');
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

describe('sourceUrlOf', () => {
  it('reads the >> source: line', () => {
    expect(
      sourceUrlOf('>> title: X\n>> source: https://a.com/pasta\n\nCook.'),
    ).toBe('https://a.com/pasta');
  });

  it('is undefined when there is no source line', () => {
    expect(sourceUrlOf('>> title: X\n\nCook.')).toBeUndefined();
  });
});

describe('normalizeSourceUrl', () => {
  it('ignores www, scheme, query, fragment and trailing slash', () => {
    const a = normalizeSourceUrl('https://www.Example.com/post/pasta/?utm=1#x');
    expect(a).toBe('example.com/post/pasta');
    expect(normalizeSourceUrl('http://example.com/post/pasta')).toBe(a);
  });

  it('keeps parameters that identify the page, so two videos differ', () => {
    expect(normalizeSourceUrl('https://www.youtube.com/watch?v=aaa')).not.toBe(
      normalizeSourceUrl('https://www.youtube.com/watch?v=bbb'),
    );
    expect(
      normalizeSourceUrl('https://youtube.com/watch?v=aaa&si=tracker'),
    ).toBe(normalizeSourceUrl('https://www.youtube.com/watch?v=aaa'));
  });

  it('ignores parameter order and tracking parameters', () => {
    expect(normalizeSourceUrl('https://a.com/p?b=2&a=1&fbclid=x')).toBe(
      normalizeSourceUrl('https://a.com/p?a=1&b=2'),
    );
  });

  it('keeps distinct paths distinct', () => {
    expect(normalizeSourceUrl('https://a.com/x')).not.toBe(
      normalizeSourceUrl('https://a.com/y'),
    );
  });

  it('returns unparseable input trimmed', () => {
    expect(normalizeSourceUrl('  not a url ')).toBe('not a url');
  });
});

describe('upsertMetadata', () => {
  it('rewrites an existing key in place', () => {
    const src = '>> title: Curry\n>> cuisine: unknown\n\nCook it.\n';
    const out = upsertMetadata(src, [['cuisine', 'Indian']]);
    expect(out).toContain('>> cuisine: Indian');
    expect(out).not.toContain('unknown');
    expect(out).toContain('Cook it.');
  });

  it('inserts new keys after the metadata block, before the method', () => {
    const src = '>> title: Curry\n\nCook it.\n';
    const out = upsertMetadata(src, [
      ['protein', 'chicken'],
      ['difficulty', 'Easy'],
    ]);
    const lines = out.split('\n');
    expect(lines[0]).toBe('>> title: Curry');
    expect(lines[1]).toBe('>> protein: chicken');
    expect(lines[2]).toBe('>> difficulty: Easy');
    expect(out).toContain('Cook it.');
  });

  it('matches keys case-insensitively', () => {
    const src = '>> Title: Curry\n>> Cuisine: old\n';
    const out = upsertMetadata(src, [['cuisine', 'Thai']]);
    expect(out).toContain('>> cuisine: Thai');
    expect(out).not.toContain('old');
  });

  it('preserves a cooking-log comment at the end', () => {
    const src = '>> title: Curry\n\nCook it.\n-- [cook 2026-01-01] great\n';
    const out = upsertMetadata(src, [['cuisine', 'Indian']]);
    expect(out).toContain('-- [cook 2026-01-01] great');
    expect(out).toContain('>> cuisine: Indian');
  });

  it('always ends with a newline', () => {
    const out = upsertMetadata('>> title: X', [['protein', 'egg']]);
    expect(out.endsWith('\n')).toBe(true);
  });
});

describe('appendNote + extractNotes', () => {
  it('appends and reads back a general note', () => {
    const out = appendNote('>> title: X\n\nCook it.\n', {
      scope: 'general',
      key: '',
      text: 'tastes better next day',
    });
    expect(out).toContain('-- [note] tastes better next day');
    expect(extractNotes(out)).toEqual([
      { scope: 'general', key: '', text: 'tastes better next day' },
    ]);
  });

  it('attaches a note to an ingredient', () => {
    const out = appendNote('>> title: X\n', {
      scope: 'ingredient',
      key: 'avocado',
      text: 'use 3 instead of 2',
    });
    expect(out).toContain('-- [note ingredient:avocado] use 3 instead of 2');
    expect(extractNotes(out)[0]).toEqual({
      scope: 'ingredient',
      key: 'avocado',
      text: 'use 3 instead of 2',
    });
  });

  it('attaches a note to a step', () => {
    const out = appendNote('>> title: X\n', {
      scope: 'step',
      key: '2',
      text: 'marinate overnight',
    });
    expect(extractNotes(out)[0]).toEqual({
      scope: 'step',
      key: '2',
      text: 'marinate overnight',
    });
  });

  it('flattens multi-line note text to one comment line', () => {
    const out = appendNote('>> title: X\n', {
      scope: 'general',
      key: '',
      text: 'line one\nline two',
    });
    expect(out).toContain('-- [note] line one line two');
    expect(out.match(/\[note\]/g)).toHaveLength(1);
  });

  it('does not disturb the original method or the cooking log', () => {
    const src = '>> title: X\n\nMash it.\n-- [cook 2026-01-01] great\n';
    const out = appendNote(src, { scope: 'general', key: '', text: 'spicy' });
    expect(out).toContain('Mash it.');
    expect(out).toContain('-- [cook 2026-01-01] great');
    // The cooking-log line is not misread as a note.
    expect(extractNotes(out)).toEqual([
      { scope: 'general', key: '', text: 'spicy' },
    ]);
  });
});

describe('removeEmptyMetadata', () => {
  it('drops blank and placeholder metadata lines', () => {
    const out = removeEmptyMetadata(
      '>> title: X\n>> servings: \n>> time: unknown\n>> source: \n>> cuisine: N/A\n\nCook.',
    );
    expect(out).toBe('>> title: X\n\nCook.');
  });

  it('keeps real values, including numeric and ranged ones', () => {
    const out = removeEmptyMetadata('>> servings: 4-6\n>> time: 20 minutes\n');
    expect(out).toContain('>> servings: 4-6');
    expect(out).toContain('>> time: 20 minutes');
  });

  it('leaves the method text alone', () => {
    const body = 'Mix it. The result is unknown to science.\n-- note\n';
    expect(removeEmptyMetadata(`>> title: X\n\n${body}`)).toContain(body);
  });
});

describe('removeMetadata', () => {
  it('removes the named key case-insensitively and nothing else', () => {
    const out = removeMetadata(
      '>> title: T\n>> Images: https://a.com/x.jpg\n>> source: https://a.com\n\nCook.\n',
      'images',
    );
    expect(out).not.toMatch(/images/i);
    expect(out).toContain('>> title: T');
    expect(out).toContain('>> source: https://a.com');
    expect(out).toContain('Cook.');
  });

  it('is a no-op when the key is absent', () => {
    const src = '>> title: T\n\nCook.\n';
    expect(removeMetadata(src, 'images')).toBe(src);
  });
});
