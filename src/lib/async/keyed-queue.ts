/**
 * @packageDocumentation
 *
 * Run jobs one at a time per key. Used where several requests can ask for the
 * same read-modify-write on one resource (hearting a recipe rewrites its file
 * in Drive) and letting them interleave would lose one of the writes.
 *
 * Like the access-token cache this is deliberately stateful: the queue lives in
 * the memory of one running Worker instance, so it serialises requests that
 * land on the same instance (which, for a person clicking quickly, is nearly
 * all of them) and is a cheap no-op for the rest. Jobs must therefore also be
 * safe to run twice at once.
 */

/** A queue that runs the jobs for one key in order, one at a time. */
export interface KeyedQueue {
  /**
   * Run `job` after every job already queued under `key` has finished. If a
   * job for the key is queued but has not started yet, no second one is added:
   * the caller gets that job's result instead. That is only right for jobs that
   * decide what to do when they START (by reading the current state), so one
   * waiting job does the work of any number of identical requests.
   */
  readonly run: (key: string, job: () => Promise<void>) => Promise<void>;
}

/** Make an empty queue. */
export function createKeyedQueue(): KeyedQueue {
  /** The latest job scheduled for each key, as a promise that never rejects. */
  const tails = new Map<string, Promise<void>>();
  /** Jobs that are scheduled but have not started, by key. */
  const waiting = new Map<string, Promise<void>>();
  return {
    run: (key, job) => {
      const queued = waiting.get(key);
      if (queued) {
        return queued;
      }
      const after = tails.get(key) ?? Promise.resolve();
      const next = after.then(() => {
        waiting.delete(key);
        return job();
      });
      const settled = next.then(
        () => undefined,
        () => undefined,
      );
      waiting.set(key, next);
      tails.set(key, settled);
      // Forget a key once nothing newer has been queued behind this job.
      settled
        .then(() => {
          if (tails.get(key) === settled) {
            tails.delete(key);
          }
        })
        .catch(() => undefined);
      return next;
    },
  };
}
