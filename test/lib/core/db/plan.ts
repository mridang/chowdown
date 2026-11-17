import type { DatabaseSync } from 'node:sqlite';

const SCAN_INDEX = /\bSCAN\b(?! .* USING (COVERING )?INDEX)/u;
const USING_COVERING_INDEX = /USING (COVERING )?INDEX/u;

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
export function indexedPlan(plan: string) {
  return {
    usesIndex: USING_COVERING_INDEX.test(plan),
    scans: SCAN_INDEX.test(plan),
    sorts: plan.includes('TEMP B-TREE'),
  };
}
