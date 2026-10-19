import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { fakeCookies } from '../../../../../lib/auth/session-fixture';
import {
  addRecipe,
  fromApp,
  openWorld,
  signIn,
  type World,
} from '../../../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { GET } =
  await import('../../../../../../src/app/api/users/self/favourite-recipes/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

describe('GET /api/users/self/favourite-recipes', () => {
  it('answers 401 when nobody is signed in', async () => {
    expect(
      (await GET(fromApp('GET', '/api/users/self/favourite-recipes'))).status,
    ).toBe(401);
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
    const res = await GET(fromApp('GET', '/api/users/self/favourite-recipes'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string; favourite: boolean }[];
    };
    expect(body.items.map((r) => [r.id, r.favourite])).toEqual([['b', true]]);
  });

  it('ignores a client that asks for the others', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    const res = await GET(
      fromApp('GET', '/api/users/self/favourite-recipes?favourite=false'),
    );
    expect(((await res.json()) as { items: unknown[] }).items).toEqual([]);
  });

  it('answers 401 once the session was ended', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 2').run();
    expect(
      (await GET(fromApp('GET', '/api/users/self/favourite-recipes'))).status,
    ).toBe(401);
  });
});
