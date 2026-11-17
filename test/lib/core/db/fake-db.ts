import { isObject } from '@/lib/core/api/json';
import type { Database } from '@/domain/db/client';

/** One call made on a fake query builder. */
export interface Call {
  /** Which statement it belongs to: `select`, `insert`, `update` or `delete`. */
  readonly statement: string;
  /** The builder method called, such as `values` or `where`. */
  readonly method: string;
  readonly args: readonly unknown[];
}

/** The first argument of the first call of `method`, as the object it must be; anything else fails the test. */
export function firstArgOf(
  calls: readonly Call[],
  method: string,
): Readonly<Record<string, unknown>> {
  const argument = calls.find((c) => c.method === method)?.args[0];
  if (!isObject(argument)) {
    throw new Error(`expected ${method} to be called with an object`);
  }
  return argument;
}

/**
 * A stand-in for Drizzle's chained query builders. Every method returns the
 * builder again and is recorded; awaiting it gives `result`. That is enough to
 * check what a repository asks the database for, and what it does with the
 * answer, without a database.
 */
function builder(statement: string, result: unknown, calls: Call[]): object {
  // eslint-disable-next-line tslop/no-known-value-widening -- the proxy hands itself back from its own handler, so the annotation is what breaks the circular type
  const self: object = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push({ statement, method: String(property), args });
          return self;
        };
      },
    },
  );
  // eslint-disable-next-line tslop/no-known-value-widening -- returns the self-referencing proxy declared above under the same circular-type annotation
  return self;
}

/** What a fake database answers with. */
export interface FakeResults {
  /** The rows (or result) of the next statements of each kind, in order; the last repeats. */
  readonly select?: readonly unknown[];
  readonly insert?: readonly unknown[];
  readonly update?: readonly unknown[];
  readonly delete?: readonly unknown[];
  /** What the n-th `batch` call answers (one result per statement); the last repeats. Default: an empty result per statement. */
  readonly batch?: readonly (readonly unknown[])[];
  /** What `query.<table>.findFirst` answers. */
  readonly findFirst?: Readonly<Record<string, unknown>>;
  /** What `query.<table>.findMany` answers. */
  readonly findMany?: Readonly<Record<string, unknown>>;
}

/** The answer for the n-th statement of a kind: the n-th result, else the last. */
function nth<T>(results: readonly T[] | undefined, n: number): T | undefined {
  return results?.[Math.min(n, results.length - 1)];
}

type StatementKind = 'select' | 'insert' | 'update' | 'delete';

/** A fake database that records every statement and answers from `results`. */
export function fakeDb(results: FakeResults = {}) {
  const calls: Call[] = [];
  const batches: unknown[][] = [];
  const counts: Record<string, number> = {};
  const start = (kind: StatementKind) => () => {
    const n = counts[kind] ?? 0;
    counts[kind] = n + 1;
    calls.push({ statement: kind, method: kind, args: [] });
    return builder(kind, nth(results[kind], n), calls);
  };
  const db = {
    select: start('select'),
    insert: start('insert'),
    update: start('update'),
    delete: start('delete'),
    batch: async (statements: unknown[]) => {
      const n = batches.length;
      batches.push(statements);
      return nth(results.batch, n) ?? statements.map(() => []);
    },
    query: new Proxy(
      {},
      {
        get: (_target, table) => ({
          findFirst: async () => results.findFirst?.[String(table)],
          findMany: async () => results.findMany?.[String(table)],
        }),
      },
    ),
  };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the fake implements only the query-builder members the repositories call, not the whole Drizzle client
  return { db: db as unknown as Database, calls, batches };
}
