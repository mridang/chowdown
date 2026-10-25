import { describe, expect, it } from '@jest/globals';

import {
  decodeCursor,
  encodeCursor,
  pageBody,
  parseLimit,
  sliceAfter,
} from '@/lib/core/api';

describe('cursor', () => {
  it('round-trips a position, including non-ASCII keys', () => {
    const position = { key: 'crème brûlée', id: 'abc/123' };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('is url-safe and opaque', () => {
    const cursor = encodeCursor({ key: 'a', id: 'b' });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain('"');
  });

  it('rejects anything we did not issue', () => {
    expect(decodeCursor('not a cursor')).toBeUndefined();
    expect(decodeCursor(btoa('{"a":1}'))).toBeUndefined();
    expect(decodeCursor('')).toBeUndefined();
  });
});

describe('parseLimit', () => {
  it('defaults, and accepts whole numbers in range', () => {
    expect(parseLimit(null)).toBe(20);
    expect(parseLimit('5')).toBe(5);
    expect(parseLimit('100')).toBe(100);
  });

  it('answers 400 for anything else', () => {
    for (const bad of ['0', '101', '2.5', 'abc', '-1']) {
      const result = parseLimit(bad);
      expect(typeof result).not.toBe('number');
      expect((result as Response).status).toBe(400);
    }
  });
});

describe('sliceAfter', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const position = (i: { id: string }) => ({ key: i.id, id: i.id });
  const compare = (a: { key: string }, b: { key: string }) =>
    a.key.localeCompare(b.key);

  it('returns the first page and a position to continue from', () => {
    const page = sliceAfter(items, position, compare, undefined, 2);
    expect(page.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(page.next).toEqual({ key: 'b', id: 'b' });
  });

  it('continues right after the cursor, even if that item is gone', () => {
    const without = items.filter((i) => i.id !== 'b');
    const page = sliceAfter(
      without,
      position,
      compare,
      { key: 'b', id: 'b' },
      2,
    );
    expect(page.items.map((i) => i.id)).toEqual(['c', 'd']);
  });

  it('has no next on the last page', () => {
    const page = sliceAfter(items, position, compare, { key: 'c', id: 'c' }, 2);
    expect(page.items.map((i) => i.id)).toEqual(['d', 'e']);
    expect(page.next).toBeUndefined();
  });
});

describe('pageBody', () => {
  const request = new Request('http://localhost:3000/recipes?q=soup&limit=2');

  it('carries absolute self and next links and the items', () => {
    const body = pageBody(request, [1, 2], { key: 'k', id: 'i' });
    expect(body.self).toBe('http://localhost:3000/recipes?q=soup&limit=2');
    expect(body.items).toEqual([1, 2]);
    const next = new URL(body.next!);
    expect(next.searchParams.get('q')).toBe('soup');
    expect(decodeCursor(next.searchParams.get('cursor')!)).toEqual({
      key: 'k',
      id: 'i',
    });
  });

  it('replaces a cursor already in the query where it stood, dropping repeats', () => {
    const paged = new Request(
      'http://localhost:3000/recipes?a=1&cursor=old&b=2&cursor=older',
    );
    const body = pageBody(paged, [1], { key: 'k', id: 'i' });
    const next = new URL(body.next!);
    expect([...next.searchParams.keys()]).toEqual(['a', 'cursor', 'b']);
    expect(decodeCursor(next.searchParams.get('cursor')!)).toEqual({
      key: 'k',
      id: 'i',
    });
    expect(body.self).toBe(
      'http://localhost:3000/recipes?a=1&cursor=old&b=2&cursor=older',
    );
  });

  it('leaves next out on the last page', () => {
    expect(pageBody(request, [1]).next).toBeUndefined();
  });
});
