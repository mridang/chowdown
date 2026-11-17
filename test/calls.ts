import type { jest } from '@jest/globals';

/**
 * A mocked collaborator as `expect` should see it. Asserting directly on a
 * function whose parameters mention the database's types makes TypeScript
 * expand those types without end (error TS2589); viewing the mock through this
 * plain signature compares the calls and nothing else.
 */
export type Calls = jest.Mock<(...args: readonly unknown[]) => Promise<void>>;

/** `fn` (a mock) seen as {@link Calls}, for `expect(asCalls(deps.save)).toHaveBeenCalledWith(…)`. */
export function asCalls(fn: unknown): Calls {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the whole point of this view is to treat any mock as the plain signature, because the mock's own parameter types are what make TypeScript fail with TS2589
  return fn as Calls;
}
