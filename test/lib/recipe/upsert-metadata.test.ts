import { describe, expect, it } from '@jest/globals';

import { upsertMetadata } from '../../../src/lib/recipe/cook-text';

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
