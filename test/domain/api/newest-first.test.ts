import { describe, expect, it } from '@jest/globals';

import { compareNewestFirst } from '@/domain/api/newest-first';

describe('compareNewestFirst', () => {
  const newer = { key: '2026-02-01T00:00:00.000Z', id: 'a' };
  const older = { key: '2026-01-01T00:00:00.000Z', id: 'a' };

  it('puts the newer position first', () => {
    expect(compareNewestFirst(newer, older)).toBeLessThan(0);
    expect(compareNewestFirst(older, newer)).toBeGreaterThan(0);
  });

  it('breaks a tie on the id, so the order and its cursors are stable', () => {
    expect(
      compareNewestFirst({ key: 'k', id: 'a' }, { key: 'k', id: 'b' }),
    ).toBeLessThan(0);
    expect(compareNewestFirst(newer, newer)).toBe(0);
  });
});
