import { describe, expect, it } from '@jest/globals';

import {
  bumpSessionEpoch,
  claimBackfillLease,
  claimDriveSync,
  clearRefreshToken,
  getSessionEpoch,
  getUserById,
  setRecipesFolderId,
  setRefreshToken,
  setUserUnits,
  upsertUser,
} from '@/domain/db/users';
import { fakeDb } from '../../lib/core/db/fake-db';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

/** A database with every migration applied and two people in it. */
function seeded() {
  const made = sqliteDatabase(...APP_MIGRATIONS);
  const user = made.raw.prepare(
    "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (?, ?, ?, '2026-01-01', '2026-01-01')",
  );
  user.run(1, 'sub-1', 'a@b.com');
  user.run(2, 'sub-2', 'c@d.com');
  return made;
}

const saved = { id: 7, email: 'a@b.com' };

/** The `set` the conflict clause of an upsert carries. */
function updateOf(
  calls: readonly { method: string; args: readonly unknown[] }[],
) {
  const conflict = calls.find((c) => c.method === 'onConflictDoUpdate');
  return (conflict?.args[0] as { set: Record<string, unknown> }).set;
}

describe('upsertUser', () => {
  it('returns the saved row', async () => {
    const { db } = fakeDb({ insert: [[saved]] });
    expect(await upsertUser(db, { google_sub: 's', email: 'a@b.com' })).toBe(
      saved,
    );
  });

  it('inserts what it was given and nulls the rest', async () => {
    const { db, calls } = fakeDb({ insert: [[saved]] });
    await upsertUser(db, { google_sub: 's', email: 'a@b.com', name: 'Ann' });
    expect(calls.find((c) => c.method === 'values')?.args[0]).toMatchObject({
      google_sub: 's',
      email: 'a@b.com',
      name: 'Ann',
      picture: null,
      refresh_token_enc: null,
    });
  });

  it('on a return visit overwrites only what was supplied', async () => {
    const { db, calls } = fakeDb({ insert: [[saved]] });
    await upsertUser(db, { google_sub: 's', email: 'a@b.com', name: 'Ann' });
    const set = updateOf(calls);
    expect(Object.keys(set).toSorted()).toEqual([
      'email',
      'name',
      'updated_at',
    ]);
  });

  it('replaces the refresh token only when a new one comes (Google omits it on silent grants)', async () => {
    const without = fakeDb({ insert: [[saved]] });
    await upsertUser(without.db, { google_sub: 's', email: 'a@b.com' });
    expect(updateOf(without.calls)).not.toHaveProperty('refresh_token_enc');
    const withToken = fakeDb({ insert: [[saved]] });
    await upsertUser(withToken.db, {
      google_sub: 's',
      email: 'a@b.com',
      refresh_token_enc: 'sealed',
    });
    expect(updateOf(withToken.calls)).toMatchObject({
      refresh_token_enc: 'sealed',
    });
  });

  it('throws if the database returns no row', async () => {
    const { db } = fakeDb({ insert: [[]] });
    await expect(
      upsertUser(db, { google_sub: 's', email: 'a@b.com' }),
    ).rejects.toThrow('returned no row');
  });
});

describe('getUserById', () => {
  it('looks the user up', async () => {
    const { db } = fakeDb({ findFirst: { users: saved } });
    expect(await getUserById(db, 7)).toBe(saved);
  });
});

describe('the small updates', () => {
  it('store the measurement system, or clear it', async () => {
    const { db, calls } = fakeDb();
    await setUserUnits(db, 7, 'us');
    await setUserUnits(db, 7, null);
    const sets = calls.filter((c) => c.method === 'set').map((c) => c.args[0]);
    expect(sets[0]).toMatchObject({ units: 'us' });
    expect(sets[1]).toMatchObject({ units: null });
  });

  it('store the Recipes folder and the sealed refresh token', async () => {
    const { db, calls } = fakeDb();
    await setRecipesFolderId(db, 7, 'folder');
    await setRefreshToken(db, 7, 'sealed');
    const sets = calls.filter((c) => c.method === 'set').map((c) => c.args[0]);
    expect(sets[0]).toMatchObject({ recipes_folder_id: 'folder' });
    expect(sets[1]).toMatchObject({ refresh_token_enc: 'sealed' });
  });

  it('forget the refresh token, for everyone or only if it is still the one that failed', async () => {
    const { db, calls } = fakeDb();
    await clearRefreshToken(db, 7);
    await clearRefreshToken(db, 7, 'sealed');
    const sets = calls.filter((c) => c.method === 'set').map((c) => c.args[0]);
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ refresh_token_enc: null });
    expect(calls.filter((c) => c.method === 'where')).toHaveLength(2);
  });
});

describe('session epoch', () => {
  it('starts at zero, is read back, and is undefined for an account that is gone', async () => {
    const { db } = seeded();
    expect(await getSessionEpoch(db, 1)).toBe(0);
    expect(await getSessionEpoch(db, 99)).toBeUndefined();
  });

  it("moves one person's epoch on and leaves everyone else's", async () => {
    const { db } = seeded();
    await bumpSessionEpoch(db, 1);
    await bumpSessionEpoch(db, 1);
    expect(await getSessionEpoch(db, 1)).toBe(2);
    expect(await getSessionEpoch(db, 2)).toBe(0);
  });

  it('is part of the row a sign-in returns', async () => {
    const { db } = seeded();
    const user = await upsertUser(db, {
      google_sub: 'sub-3',
      email: 'e@f.com',
    });
    expect(user.session_epoch).toBe(0);
  });
});

describe('claimDriveSync', () => {
  const at = new Date('2026-03-01T12:00:00.000Z');
  const later = (seconds: number) => new Date(at.getTime() + seconds * 1000);

  it('gives the turn to the first caller and refuses the next within a minute', async () => {
    const { db } = seeded();
    expect(await claimDriveSync(db, 1, at)).toBe(true);
    expect(await claimDriveSync(db, 1, later(30))).toBe(false);
  });

  it('gives it again once a minute has passed', async () => {
    const { db } = seeded();
    await claimDriveSync(db, 1, at);
    expect(await claimDriveSync(db, 1, later(61))).toBe(true);
  });

  it('keeps a turn per person', async () => {
    const { db } = seeded();
    await claimDriveSync(db, 1, at);
    expect(await claimDriveSync(db, 2, at)).toBe(true);
  });

  it('lets exactly one of several simultaneous callers win', async () => {
    const { db } = seeded();
    const wins = await Promise.all([
      claimDriveSync(db, 1, at),
      claimDriveSync(db, 1, at),
      claimDriveSync(db, 1, at),
    ]);
    expect(wins.filter(Boolean)).toHaveLength(1);
  });

  it('refuses for an account that does not exist', async () => {
    const { db } = seeded();
    expect(await claimDriveSync(db, 99, at)).toBe(false);
  });
});

describe('claimBackfillLease', () => {
  const at = new Date('2026-03-01T12:00:00.000Z');
  const later = (seconds: number) => new Date(at.getTime() + seconds * 1000);

  it('is held for two minutes by whoever takes it first', async () => {
    const { db } = seeded();
    expect(await claimBackfillLease(db, 1, at)).toBe(true);
    expect(await claimBackfillLease(db, 1, later(119))).toBe(false);
  });

  it('can be taken again when the lease has run out', async () => {
    const { db } = seeded();
    await claimBackfillLease(db, 1, at);
    expect(await claimBackfillLease(db, 1, later(121))).toBe(true);
  });

  it('is independent of the sync turn', async () => {
    const { db } = seeded();
    await claimDriveSync(db, 1, at);
    expect(await claimBackfillLease(db, 1, at)).toBe(true);
  });
});
