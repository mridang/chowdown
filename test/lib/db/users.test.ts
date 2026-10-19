import { describe, expect, it } from '@jest/globals';

import {
  clearRefreshToken,
  getUserById,
  setRecipesFolderId,
  setRefreshToken,
  setUserUnits,
  upsertUser,
} from '../../../src/lib/db/users';
import { fakeDb } from './fake-db';

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
