/**
 * @packageDocumentation
 *
 * Run an async step over a list one item at a time. Used where each step talks
 * to something with tight limits (Workers AI, Drive, D1) and firing the whole
 * list at once would trip them, but the caller still wants a plain list of
 * results back rather than a loop that fills an array.
 */

/**
 * Run `step` on each of `items` in order, starting each only after the one
 * before has finished, and return the results in the same order. If a step
 * throws, the later items are never started and the returned promise rejects.
 *
 * @param items The things to work through.
 * @param step The async work for one item.
 */
export async function mapSequentially<T, R>(
  items: readonly T[],
  step: (item: T) => Promise<R>,
): Promise<readonly R[]> {
  return items.reduce<Promise<readonly R[]>>(async (earlier, item) => {
    const done = await earlier;
    return [...done, await step(item)];
  }, Promise.resolve([]));
}
