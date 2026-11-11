import { expect } from '@jest/globals';

/** A small seeded generator (mulberry32), so a failing fuzz input can be reproduced. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** `count` strings made of two to nine random `pieces` each, the same for a given seed. */
export function fuzzInputs(
  seed: number,
  count: number,
  pieces: readonly string[],
): string[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    const length = 2 + Math.floor(random() * 8);
    return Array.from(
      { length },
      () => pieces[Math.floor(random() * pieces.length)] ?? '',
    ).join('');
  });
}

/** What `pattern` finds in `input`, wherever it is, as index and groups. */
function matchesOf(pattern: RegExp, input: string) {
  const flags = pattern.flags.includes('g')
    ? pattern.flags
    : `${pattern.flags}g`;
  return Array.from(
    input.matchAll(new RegExp(pattern.source, flags)),
    (match) => [match.index, ...match],
  );
}

/** Check that the rewritten pattern finds exactly what the original did in every input. */
export function expectSamePattern(
  original: RegExp,
  rewritten: RegExp,
  inputs: readonly string[],
): void {
  expect(rewritten.source).toBe(original.source);
  expect(rewritten.flags).toBe(original.flags);
  for (const input of inputs) {
    expect(matchesOf(rewritten, input)).toEqual(matchesOf(original, input));
  }
}
