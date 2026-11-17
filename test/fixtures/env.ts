/**
 * A Workers environment for a test: only the bindings the code under test
 * reads are given, the rest of the real one is not needed.
 */
export function fakeEnv(
  bindings: Readonly<Record<string, unknown>>,
): CloudflareEnv {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the real CloudflareEnv has dozens of bindings (D1, R2, queues, Fetcher) that cannot be built in a test; this is the one place a partial environment is typed as the whole
  return bindings as unknown as CloudflareEnv;
}
