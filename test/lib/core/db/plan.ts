// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

/** The text of SQLite's query plan for a statement (unbound `?` is fine). */
export function planOf(
  raw: DatabaseSync,
  sql: string,
  ...params: readonly (string | number)[]
): string {
  return raw
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...params)
    .map((row) => String(row['detail']))
    .join(' | ');
}

/** What a hot query's plan must look like: an index, no scan, no temporary sort. */
export function indexedPlan(plan: string): {
  readonly usesIndex: boolean;
  readonly scans: boolean;
  readonly sorts: boolean;
} {
  return {
    usesIndex: /USING (COVERING )?INDEX/.test(plan),
    scans: /\bSCAN\b(?! .* USING (COVERING )?INDEX)/.test(plan),
    sorts: plan.includes('TEMP B-TREE'),
  };
}
