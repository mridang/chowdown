import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  bumpSessionEpoch,
  getSessionEpoch,
  getUserById,
  upsertGoogleUser,
} from '@/lib/auth/store';
import { openWorld, type World } from '../../app/api/world';

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

describe('upsertGoogleUser', () => {
  it('creates the person on first sign-in, keyed by their Google account', async () => {
    const user = await upsertGoogleUser({
      sub: 'g1',
      email: 'ada@example.com',
      name: 'Ada',
      picture: 'https://pics.example/ada',
    });
    expect(user).toMatchObject({
      email: 'ada@example.com',
      name: 'Ada',
      google_sub: 'g1',
      session_epoch: 0,
    });
  });

  it('recognises a returning person by their Google id, keeping their epoch', async () => {
    world.raw
      .prepare(
        "INSERT INTO users (id, google_sub, email, session_epoch, created_at, updated_at) VALUES (4, 'g1', 'old@example.com', 7, 'n', 'n')",
      )
      .run();
    const user = await upsertGoogleUser({
      sub: 'g1',
      email: 'new@example.com',
    });
    expect(user).toMatchObject({
      id: 4,
      email: 'new@example.com',
      session_epoch: 7,
    });
    expect(world.raw.prepare('SELECT count(*) AS n FROM users').get()).toEqual({
      n: 1,
    });
  });
});

describe('getUserById, getSessionEpoch and bumpSessionEpoch', () => {
  it('find the person, read their epoch and move it on', async () => {
    const { id } = await upsertGoogleUser({ sub: 'g1', email: 'a@b.com' });
    expect((await getUserById(id))?.email).toBe('a@b.com');
    expect(await getSessionEpoch(id)).toBe(0);
    await bumpSessionEpoch(id);
    expect(await getSessionEpoch(id)).toBe(1);
  });

  it('say nothing for an account that is gone', async () => {
    expect(await getUserById(99)).toBeUndefined();
    expect(await getSessionEpoch(99)).toBeUndefined();
  });
});
