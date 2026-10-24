import { DatabaseSync } from 'node:sqlite';

import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  purgeRateLimits,
  rateLimit,
  type RateLimit,
  type RateLimitStore,
} from '@/lib/util/rate-limit';

/** The statement the real store runs, read from the source so the test cannot drift from it. */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE = readFileSync(
  path.join(process.cwd(), 'src/lib/util/rate-limit.ts'),
  'utf8',
);
const HIT_SQL = /const HIT_SQL = `([^`]*)`/.exec(SOURCE)?.[1] ?? '';
const SCHEMA = readFileSync(
  path.join(process.cwd(), 'migrations/0011_rate_limits.sql'),
  'utf8',
);

/** A store that runs the real SQL against an in-memory SQLite, as D1 would. */
function sqliteStore(): RateLimitStore {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return {
    async hit(key, now, windowSeconds) {
      // SQLite numbers `?1 ?2 ?3` itself, exactly as D1 does.
      const row = db.prepare(HIT_SQL).get(key, now, now - windowSeconds);
      return {
        count: Number(row?.['count']),
        windowStart: Number(row?.['window_start']),
      };
    },
    async purge(before) {
      db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(before);
    },
  };
}

const TOOLS: RateLimit = { name: 'tool', limit: 3, windowSeconds: 60 };

describe('rateLimit', () => {
  let store: RateLimitStore;
  beforeEach(() => {
    store = sqliteStore();
  });

  it('lets a subject through until it has used up the window', async () => {
    const answers = await Promise.all(
      [1, 2, 3].map((tick) => rateLimit(store, TOOLS, 'ann', 1000 + tick)),
    );
    expect(answers).toEqual([
      { allowed: true, remaining: 2 },
      { allowed: true, remaining: 1 },
      { allowed: true, remaining: 0 },
    ]);
  });

  it('refuses the next hit and says how long until the window ends', async () => {
    await Promise.all(
      [1, 2, 3].map((t) => rateLimit(store, TOOLS, 'ann', 1000 + t)),
    );
    expect(await rateLimit(store, TOOLS, 'ann', 1030)).toEqual({
      allowed: false,
      retryAfterSeconds: 31,
    });
  });

  it('starts a fresh window once the old one has run out', async () => {
    await Promise.all(
      [1, 2, 3, 4].map((t) => rateLimit(store, TOOLS, 'ann', 1000 + t)),
    );
    expect(await rateLimit(store, TOOLS, 'ann', 1061)).toEqual({
      allowed: true,
      remaining: 2,
    });
  });

  it('counts each subject, and each named limit, on its own', async () => {
    await Promise.all(
      [1, 2, 3, 4].map((t) => rateLimit(store, TOOLS, 'ann', 1000 + t)),
    );
    expect((await rateLimit(store, TOOLS, 'bob', 1010)).allowed).toBe(true);
    expect(
      (await rateLimit(store, { ...TOOLS, name: 'register' }, 'ann', 1010))
        .allowed,
    ).toBe(true);
  });

  it('never tells a client to retry in less than a second', async () => {
    await Promise.all(
      [1, 2, 3].map((t) => rateLimit(store, TOOLS, 'ann', 1000 + t)),
    );
    const answer = await rateLimit(store, TOOLS, 'ann', 1060);
    expect(
      answer.allowed === false && answer.retryAfterSeconds,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('purgeRateLimits', () => {
  it('forgets counters idle for longer than asked, and keeps the recent ones', async () => {
    const store = sqliteStore();
    await rateLimit(store, TOOLS, 'old', 1000);
    await rateLimit(store, TOOLS, 'recent', 5480);
    await purgeRateLimits(store, 1000, 5500);
    // `old` starts again at one (its row is gone), `recent` is still counted.
    expect(await rateLimit(store, TOOLS, 'old', 5501)).toEqual({
      allowed: true,
      remaining: 2,
    });
    expect(await rateLimit(store, TOOLS, 'recent', 5502)).toEqual({
      allowed: true,
      remaining: 1,
    });
  });
});
