/**
 * @packageDocumentation
 *
 * The REST answer for a person who has used up a daily budget (see
 * `util/daily-budget.ts` for what the budgets are and how they are counted).
 */

import { spendBudget, type BudgetDeps } from '@/lib/util/daily-budget';
import type { RateLimit } from '@/lib/rate-limit';
import { problems } from '@/lib/rest-json/problem';

/**
 * The 429 problem for a person who has used up `budget`, or null if the call may
 * go ahead. `what` finishes the sentence "You have used today's … allowance."
 */
export async function budgetRefusal(
  budget: RateLimit,
  userId: number,
  what: string,
  deps: BudgetDeps = {},
): Promise<Response | null> {
  const retryAfter = await spendBudget(budget, userId, deps);
  return retryAfter === undefined
    ? null
    : problems.rateLimited(
        `You have used today's ${what} allowance. It renews in about ${Math.ceil(retryAfter / 3600)} hour(s).`,
        retryAfter,
      );
}
