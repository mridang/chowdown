import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { fakeCookies } from '../../../../../domain/auth/auth-test-kit';
import { addRecipe, fromApp, openWorld, signIn } from '../../../world';
import type { World } from '../../../world';

// eslint-disable-next-line tslop/no-module-mocking -- next/headers is a framework module the code under test imports directly, and it only works inside a Next request
jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { GET } = await import('@/app/api/users/self/favourites/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(async () => world.close());

describe('GET /api/users/self/favourites', () => {
  it('answers 401 when nobody is signed in', async () => {
    const res = await GET(fromApp('GET', '/api/users/self/favourites'));
    expect(res.status).toBe(401);
  });

  it('lists only the recipes the person has hearted', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    addRecipe(world, uid, 'b', '>> title: B\n');
    world.raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, 'b', 'n')",
      )
      .run(uid);
    const res = await GET(fromApp('GET', '/api/users/self/favourites'));
    expect(res.status).toBe(200);
    const body = await res.json<{
      items: { id: string; favourite: boolean }[];
    }>();
    expect(body.items.map((r) => [r.id, r.favourite])).toEqual([['b', true]]);
  });

  it('ignores a client that asks for the others', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    const res = await GET(
      fromApp('GET', '/api/users/self/favourites?favourite=false'),
    );
    expect(await res.json<{ items: unknown[] }>()).toHaveProperty('items', []);
  });

  it('answers 401 once the session was ended', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 2').run();
    const res = await GET(fromApp('GET', '/api/users/self/favourites'));
    expect(res.status).toBe(401);
  });
});
