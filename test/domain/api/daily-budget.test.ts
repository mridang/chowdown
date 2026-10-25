import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { budgetRefusal } from '@/domain/api/daily-budget';
import {
  D1RateLimitStore,
  type RateLimit,
  type RateLimitStore,
} from '@/lib/rate-limit';
import { APP_MIGRATIONS } from '../../lib/db/migrations';
import { sqliteD1 } from '../../lib/db/sqlite-d1';

const NOW = 1_800_000_000;
const SMALL: RateLimit = {
  name: 'budget-test',
  limit: 3,
  windowSeconds: 86_400,
};

let store: RateLimitStore;

beforeEach(() => {
  store = new D1RateLimitStore(sqliteD1(...APP_MIGRATIONS).d1);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('budgetRefusal', () => {
  it('is null while there is budget left', async () => {
    expect(
      await budgetRefusal(SMALL, 7, 'import', { store, now: NOW }),
    ).toBeNull();
  });

  it('is a 429 problem with Retry-After once it is used up', async () => {
    for (let i = 0; i < 3; i += 1) {
      await budgetRefusal(SMALL, 7, 'import', { store, now: NOW });
    }
    const refusal = await budgetRefusal(SMALL, 7, 'import', {
      store,
      now: NOW,
    });
    expect(refusal?.status).toBe(429);
    expect(Number(refusal?.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(refusal?.headers.get('content-type')).toBe(
      'application/problem+json',
    );
    expect(await refusal?.json()).toMatchObject({
      type: '/problems/rate-limited',
      status: 429,
      detail: expect.stringContaining('import'),
    });
  });
});
