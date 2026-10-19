import type { jest } from '@jest/globals';

/**
 * A mocked collaborator as `expect` should see it. Asserting directly on a
 * function whose parameters mention the database's types makes TypeScript
 * expand those types without end (error TS2589); viewing the mock through this
 * plain signature compares the calls and nothing else.
 */
export type Calls = jest.Mock<
  (...args: readonly unknown[]) => Promise<unknown>
>;

/** `fn` (a mock) seen as {@link Calls}, for `expect(asCalls(deps.save)).toHaveBeenCalledWith(…)`. */
export function asCalls(fn: unknown): Calls {
  return fn as Calls;
}
