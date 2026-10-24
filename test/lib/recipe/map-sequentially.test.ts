import { describe, expect, it } from '@jest/globals';

import { mapSequentially } from '@/lib/async/map-sequentially';

describe('mapSequentially', () => {
  it('returns the results in the order of the items', async () => {
    expect(await mapSequentially([1, 2, 3], async (n) => n * 10)).toEqual([
      10, 20, 30,
    ]);
  });

  it('returns an empty list for no items', async () => {
    expect(await mapSequentially([], async (n: number) => n)).toEqual([]);
  });

  it('starts each item only after the one before has finished', async () => {
    const log: string[] = [];
    await mapSequentially(['a', 'b', 'c'], async (name) => {
      log.push(`start ${name}`);
      // Yield to the event loop so an overlapping run would interleave.
      await new Promise((resolve) => setTimeout(resolve, 1));
      log.push(`end ${name}`);
    });
    expect(log).toEqual([
      'start a',
      'end a',
      'start b',
      'end b',
      'start c',
      'end c',
    ]);
  });

  it('stops at the first failure and never starts the rest', async () => {
    const started: number[] = [];
    await expect(
      mapSequentially([1, 2, 3], async (n) => {
        started.push(n);
        if (n === 2) {
          throw new Error('boom');
        }
        return n;
      }),
    ).rejects.toThrow('boom');
    expect(started).toEqual([1, 2]);
  });
});
