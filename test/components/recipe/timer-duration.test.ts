import { describe, expect, it } from '@jest/globals';

import { parseDurationMs } from '../../../src/components/recipe/timer-duration';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

describe('parseDurationMs', () => {
  it.each([
    ['5 minutes', 5 * MIN],
    ['5 min', 5 * MIN],
    ['5 mins', 5 * MIN],
    ['5m', 5 * MIN],
    ['1 minute', MIN],
    ['90 seconds', 90 * SEC],
    ['30 sec', 30 * SEC],
    ['2 hours', 2 * HOUR],
    ['1 hr', HOUR],
    ['1.5 hours', 1.5 * HOUR],
    ['1/2 hour', 0.5 * HOUR],
    ['½ hour', 0.5 * HOUR],
    ['1½ hours', 1.5 * HOUR],
    ['1 1/2 hours', 1.5 * HOUR],
    ['10 MINUTES', 10 * MIN],
  ])('reads a single %p', (label, ms) => {
    expect(parseDurationMs(label)).toBe(ms);
  });

  it.each([
    ['1 hr 30 min', 90 * MIN],
    ['1 hour and 30 minutes', 90 * MIN],
    ['1 hour, 30 minutes', 90 * MIN],
    ['1h30', 90 * MIN],
    ['1h 30m', 90 * MIN],
    ['2 min 30 sec', 150 * SEC],
    ['1 hour 5 min 10 sec', HOUR + 5 * MIN + 10 * SEC],
  ])('adds up %p', (label, ms) => {
    expect(parseDurationMs(label)).toBe(ms);
  });

  it.each([
    ['1-2 hours', HOUR],
    ['1–2 hours', HOUR],
    ['5 to 10 minutes', 5 * MIN],
    ['5 - 10 minutes', 5 * MIN],
    ['20-25 min', 20 * MIN],
  ])('counts a range from its lower bound: %p', (label, ms) => {
    expect(parseDurationMs(label)).toBe(ms);
  });

  it('counts a range of two whole durations from the first', () => {
    expect(parseDurationMs('1 hour - 1 hour 30 min')).toBe(HOUR);
    expect(parseDurationMs('45 minutes to 1 hour')).toBe(45 * MIN);
  });

  it('does not add up a second, unrelated duration in the same label', () => {
    expect(parseDurationMs('10 minutes, stirring every 2 minutes')).toBe(
      10 * MIN,
    );
  });

  it('ignores words around the duration', () => {
    expect(parseDurationMs('about 5 minutes or until golden')).toBe(5 * MIN);
  });

  it.each([
    '',
    'overnight',
    'until golden',
    '5',
    '3 eggs',
    '5 tomatoes',
    '0 minutes',
    '48 hours',
    '2 days',
    '1/0 hour',
  ])('is null for %p, which cannot be a countdown', (label) => {
    expect(parseDurationMs(label)).toBeNull();
  });

  it('allows exactly a day', () => {
    expect(parseDurationMs('24 hours')).toBe(24 * HOUR);
  });
});
