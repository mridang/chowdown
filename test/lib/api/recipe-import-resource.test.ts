import { describe, expect, it } from '@jest/globals';

import {
  MAX_IMPORT_BODY_BYTES,
  MAX_INPUT,
  compareImportPositions,
  importPosition,
  importSummary,
  parseImportInput,
} from '@/lib/api/recipe-import-resource';
import type { RecipeImport } from '@/lib/db/recipe-imports';

const imported: RecipeImport = {
  id: 'abc',
  status: 'COMPLETED',
  created_at: '2026-01-02T00:00:00.000Z',
  items: [],
};

describe('parseImportInput', () => {
  it('returns the trimmed text', () => {
    expect(parseImportInput({ input: '  https://example.com  ' })).toEqual({
      ok: true,
      input: 'https://example.com',
    });
  });

  it('wants text', () => {
    for (const body of [undefined, null, {}, { input: '  ' }, { input: 3 }]) {
      expect(parseImportInput(body)).toEqual({
        ok: false,
        errors: ['input: required.'],
      });
    }
  });

  it('refuses text over the limit, but not at it', () => {
    expect(parseImportInput({ input: 'x'.repeat(MAX_INPUT + 1) })).toEqual({
      ok: false,
      errors: ['input: too large.'],
    });
    expect(parseImportInput({ input: 'x'.repeat(MAX_INPUT) }).ok).toBe(true);
  });
});

describe('MAX_IMPORT_BODY_BYTES', () => {
  it('leaves room for the longest input even at three bytes a character', () => {
    expect(MAX_IMPORT_BODY_BYTES).toBe(1024 * 1024);
    expect(MAX_INPUT * 3).toBeLessThan(MAX_IMPORT_BODY_BYTES);
  });
});

describe('importSummary', () => {
  it('counts the drafts instead of listing them', () => {
    expect(
      importSummary({
        ...imported,
        items: [
          { kind: 'text', status: 'FAILED' },
          { kind: 'text', status: 'FAILED' },
        ] as unknown as RecipeImport['items'],
      }),
    ).toEqual({
      id: 'abc',
      status: 'COMPLETED',
      created_at: '2026-01-02T00:00:00.000Z',
      item_count: 2,
    });
  });
});

describe('import order', () => {
  it('positions an import by when it was made and its id', () => {
    expect(importPosition(imported)).toEqual({
      key: '2026-01-02T00:00:00.000Z',
      id: 'abc',
    });
  });

  it('puts the newest first, and breaks ties by id', () => {
    const older = { key: '2026-01-01', id: 'z' };
    const newer = { key: '2026-01-02', id: 'a' };
    expect(compareImportPositions(newer, older)).toBeLessThan(0);
    expect(compareImportPositions(older, newer)).toBeGreaterThan(0);
    expect(
      compareImportPositions({ key: 'k', id: 'a' }, { key: 'k', id: 'b' }),
    ).toBeLessThan(0);
    expect(compareImportPositions(newer, newer)).toBe(0);
  });
});
