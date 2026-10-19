/**
 * @packageDocumentation
 *
 * Daily budgets for the calls that cost model time. The edge limits (see
 * `lib/http/edge-limits.ts`) cap how fast a person can go, but a patient
 * script that stays under them still adds up over a day, and every import,
 * tagging run or suggestion search spends Workers AI and Drive quota. A budget
 * is a durable count in D1 (the same `rate_limits` table, with a 24-hour
 * window), so it survives restarts and is the same in every location.
 *
 * A budget fails open: if the counter cannot be reached the call goes ahead,
 * because a fault in bookkeeping must not stop a person using the app.
 */

import {
  d1RateLimitStore,
  rateLimit,
  type RateLimit,
  type RateLimitStore,
} from './rate-limit';
import { getDatabase } from './runtime';

/** Seconds in a day. */
const DAY_SECONDS = 86_400;

/**
 * What a person may spend each day. Imports are the dearest (each unit is a
 * fetch plus up to two model calls, and one import holds up to ten units).
 */
export const DAILY_BUDGETS = {
  import: { name: 'budget-import', limit: 30, windowSeconds: DAY_SECONDS },
  tag: { name: 'budget-tag', limit: 100, windowSeconds: DAY_SECONDS },
  suggest: { name: 'budget-suggest', limit: 200, windowSeconds: DAY_SECONDS },
  /** Tools that call a model on an assistant's behalf (importing, tagging, adding). */
  assistantModel: {
    name: 'budget-assistant-model',
    limit: 200,
    windowSeconds: DAY_SECONDS,
  },
} as const satisfies Readonly<Record<string, RateLimit>>;

/** Where a budget's counters live and what time it is; a test passes its own. */
export interface BudgetDeps {
  readonly store?: RateLimitStore;
  readonly now?: number;
}

/**
 * Spend one unit of `budget` for a person. Returns the seconds until the budget
 * renews if it is used up, or undefined if the call may go ahead (including
 * when the counter cannot be reached).
 */
export async function spendBudget(
  budget: RateLimit,
  userId: number,
  deps: BudgetDeps = {},
): Promise<number | undefined> {
  try {
    const store = deps.store ?? d1RateLimitStore(getDatabase().$client);
    const decision = await rateLimit(store, budget, `u:${userId}`, deps.now);
    return decision.allowed ? undefined : decision.retryAfterSeconds;
  } catch (error) {
    console.error('[budget] counter failed, letting the call through:', error);
    return undefined;
  }
}
