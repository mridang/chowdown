import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  fakeCookies,
  insertUser,
} from '../../../../../../lib/auth/session-fixture';
import { settleBackground } from '../../../../../../lib/db/sqlite-d1';
import {
  addRecipe,
  fakeGoogle,
  fromApp,
  openWorld,
  signIn,
  type World,
} from '../../../../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { DELETE, GET, PUT } =
  await import('@/app/api/users/self/favourites/[recipe_id]/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

/** The context Next hands a handler for `.../favourites/:recipe_id`. */
const ctx = (id: string) => ({ params: Promise.resolve({ recipe_id: id }) });
const hearts = () =>
  world.raw
    .prepare(
      'SELECT user_id AS u, drive_file_id AS f FROM favourites ORDER BY f',
    )
    .all();

describe('GET /api/users/self/favourites/:recipe_id', () => {
  it('answers 401 when nobody is signed in', async () => {
    expect((await GET(fromApp('GET', '/x'), ctx('a'))).status).toBe(401);
  });

  it('answers the recipe summary when it is hearted', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    world.raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, 'a', 'n')",
      )
      .run(uid);
    const res = await GET(fromApp('GET', '/x'), ctx('a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'a', favourite: true });
  });

  it('answers 404 for a recipe that is not hearted, and for one that does not exist', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    expect((await GET(fromApp('GET', '/x'), ctx('a'))).status).toBe(404);
    expect((await GET(fromApp('GET', '/x'), ctx('none'))).status).toBe(404);
  });
});

describe('PUT /api/users/self/favourites/:recipe_id', () => {
  const heart = (id: string, headers: Record<string, string> = {}) =>
    PUT(fromApp('PUT', '/x', { headers }), ctx(id));

  it('answers 401 when nobody is signed in', async () => {
    expect((await heart('a')).status).toBe(401);
  });

  it('answers 403 for a request from another site, and hearts nothing', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    expect((await heart('a', { 'sec-fetch-site': 'cross-site' })).status).toBe(
      403,
    );
    expect(hearts()).toEqual([]);
  });

  it('hearts the recipe and answers 204, and hearting twice is fine', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    expect((await heart('a')).status).toBe(204);
    expect((await heart('a')).status).toBe(204);
    expect(hearts()).toEqual([{ u: uid, f: 'a' }]);
  });

  it("answers 404 for a recipe the person does not have, including another person's", async () => {
    await signIn(world);
    insertUser(world.raw, { id: 9, email: 'o@example.com' });
    addRecipe(world, 9, 'theirs', '>> title: T\n');
    expect((await heart('theirs')).status).toBe(404);
    expect((await heart('missing')).status).toBe(404);
    expect(hearts()).toEqual([]);
  });

  it('answers 404 for an id that is not a Drive file id, without querying for it', async () => {
    await signIn(world);
    expect((await heart('../etc/passwd')).status).toBe(404);
  });

  it('writes the favourite marker into the Drive file in the background', async () => {
    const uid = await signIn(world, { drive: true });
    addRecipe(world, uid, 'a', '>> title: A\n\nCook.\n');
    const google = fakeGoogle({
      a: { name: 'A.cook', content: '>> title: A\n\nCook.\n' },
    });
    await heart('a');
    await settleBackground();
    expect(google.files.get('a')?.content).toContain('>> favourite: true');
  });

  it('answers 401 once the session was ended', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 1').run();
    expect((await heart('a')).status).toBe(401);
  });
});

describe('DELETE /api/users/self/favourites/:recipe_id', () => {
  const unheart = (id: string) => DELETE(fromApp('DELETE', '/x'), ctx(id));

  it('answers 401 when nobody is signed in', async () => {
    expect((await unheart('a')).status).toBe(401);
  });

  it('removes the heart and answers 204, and removing it again is fine', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'a', '>> title: A\n');
    await PUT(fromApp('PUT', '/x'), ctx('a'));
    expect((await unheart('a')).status).toBe(204);
    expect((await unheart('a')).status).toBe(204);
    expect(hearts()).toEqual([]);
  });

  it('removes a heart whose recipe no longer exists, touching no file', async () => {
    const uid = await signIn(world, { drive: true });
    world.raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, 'gone', 'n')",
      )
      .run(uid);
    const google = fakeGoogle();
    expect((await unheart('gone')).status).toBe(204);
    expect(hearts()).toEqual([]);
    await settleBackground();
    expect(google.requests).toEqual([]);
  });

  it("leaves another person's heart on the same file alone", async () => {
    const uid = await signIn(world);
    insertUser(world.raw, { id: 9, email: 'o@example.com' });
    world.raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (9, 'gone', 'n')",
      )
      .run();
    await unheart('gone');
    expect(hearts()).toEqual([{ u: 9, f: 'gone' }]);
    expect(uid).toBe(1);
  });

  it('removes the marker from the Drive file in the background', async () => {
    const uid = await signIn(world, { drive: true });
    const marked = '>> title: A\n>> favourite: true\n\nCook.\n';
    addRecipe(world, uid, 'a', marked);
    world.raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, 'a', 'n')",
      )
      .run(uid);
    const google = fakeGoogle({ a: { name: 'A.cook', content: marked } });
    await unheart('a');
    await settleBackground();
    expect(google.files.get('a')?.content).not.toContain('favourite');
  });
});
