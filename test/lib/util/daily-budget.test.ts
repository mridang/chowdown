import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { DAILY_BUDGETS, spendBudget } from '../../../src/lib/util/daily-budget';
import {
  d1RateLimitStore,
  type RateLimit,
  type RateLimitStore,
} from '../../../src/lib/util/rate-limit';
import { APP_MIGRATIONS } from '../db/migrations';
import { sqliteD1 } from '../db/sqlite-d1';

const NOW = 1_800_000_000;
const SMALL: RateLimit = {
  name: 'budget-test',
  limit: 3,
  windowSeconds: 86_400,
};

let store: RateLimitStore;

beforeEach(() => {
  store = d1RateLimitStore(sqliteD1(...APP_MIGRATIONS).d1);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DAILY_BUDGETS', () => {
  it('are all a full day long and each has its own counter name', () => {
    const budgets = Object.values(DAILY_BUDGETS);
    for (const budget of budgets) {
      expect(budget.windowSeconds).toBe(86_400);
    }
    expect(new Set(budgets.map((b) => b.name)).size).toBe(budgets.length);
  });
});

describe('spendBudget', () => {
  it('lets calls through until the budget is used, then says when it renews', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(
        await spendBudget(SMALL, 7, { store, now: NOW + i }),
      ).toBeUndefined();
    }
    const wait = await spendBudget(SMALL, 7, { store, now: NOW + 10 });
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(86_400);
  });

  it('counts each person on their own', async () => {
    for (let i = 0; i < 3; i += 1) {
      await spendBudget(SMALL, 7, { store, now: NOW });
    }
    expect(await spendBudget(SMALL, 7, { store, now: NOW })).toBeDefined();
    expect(await spendBudget(SMALL, 8, { store, now: NOW })).toBeUndefined();
  });

  it('counts each budget on its own', async () => {
    const other: RateLimit = { ...SMALL, name: 'budget-other' };
    for (let i = 0; i < 3; i += 1) {
      await spendBudget(SMALL, 7, { store, now: NOW });
    }
    expect(await spendBudget(other, 7, { store, now: NOW })).toBeUndefined();
  });

  it('starts again once the day has passed', async () => {
    for (let i = 0; i < 4; i += 1) {
      await spendBudget(SMALL, 7, { store, now: NOW });
    }
    expect(
      await spendBudget(SMALL, 7, { store, now: NOW + 86_401 }),
    ).toBeUndefined();
  });

  it('lets the call through, and logs, when the counter cannot be reached', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken: RateLimitStore = {
      hit: async () => {
        throw new Error('down');
      },
      purge: async () => {},
    };
    expect(await spendBudget(SMALL, 7, { store: broken })).toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });
});
