import { describe, expect, it } from '@jest/globals';

import { LogCookingTool } from '@/domain/mcp/tools/log-cooking';
import {
  PANCAKES,
  USER,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

describe('log_cooking', () => {
  it('appends a dated note, saves it and refreshes the cache', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'Added vanilla' },
      fake,
    );
    expect(said(result)).toContain('Logged your note on "Pancakes".');
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]?.[1]).toContain('Added vanilla');
    expect(fake.indexed).toEqual([
      ['id-Pancakes.cook', 'Pancakes.cook', fake.updates[0]?.[1]],
    ]);
  });

  it('writes nothing, and is an error, when the recipe is not found', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pizza', note: 'x' },
      fake,
    );
    expect(said(result)).toContain('No recipe found matching "pizza".');
    expect(result.isError).toBe(true);
    expect(fake.updates).toEqual([]);
  });

  it('dates the entry today unless a day is given', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    await call('log_cooking', { recipe: 'pancakes', note: 'now' }, fake);
    expect(fake.updates[0]?.[1]).toContain(`-- [cook ${today}] now`);
  });

  it('records a cook on a day in the past', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'last Sunday', date: '2026-01-04' },
      fake,
    );
    expect(result.isError).toBeUndefined();
    expect(fake.updates[0]?.[1]).toContain('-- [cook 2026-01-04] last Sunday');
    expect(result.structuredContent).toMatchObject({
      logs: [{ date: '2026-01-04', note: 'last Sunday' }],
    });
  });

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['a month that does not exist', '2026-13-01'],
    ['a day well in the future', '2999-01-01'],
  ])('refuses %s, writing nothing', async (_why, date) => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'x', date },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('not in the future');
    expect(fake.updates).toEqual([]);
  });

  it('allows tomorrow in UTC, which is already today for someone ahead of it', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000 - 60_000)
      .toISOString()
      .slice(0, 10);
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'x', date: tomorrow },
      fake,
    );
    expect(result.isError).toBeUndefined();
  });

  it('refuses a date that is not written as YYYY-MM-DD', async () => {
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'x', date: 'yesterday' },
      folder({ 'Pancakes.cook': PANCAKES }),
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('`date` must match the pattern');
  });

  it.each(['', ' ', ' '.repeat(3), '\n\t'])(
    'writes no empty entry for the note %j',
    async (note) => {
      const fake = folder({ 'Pancakes.cook': PANCAKES });
      const result = await call(
        'log_cooking',
        { recipe: 'pancakes', note },
        fake,
      );
      expect(result.isError).toBe(true);
      expect(fake.updates).toEqual([]);
    },
  );
});

describe('LogCookingTool.handle', () => {
  it('asks what to record when the note arrives blank, which the schema already forbids', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await new LogCookingTool().handle(
      { recipe: 'pancakes', note: ' '.repeat(3) },
      {
        user: USER,
        services: { ...fakeServices(), openDrive: async () => fake.ctx },
      },
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toBe('What should the cooking-log entry say?');
    expect(fake.updates).toEqual([]);
  });
});
