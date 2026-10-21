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
  await import('../../../../../../src/app/api/recipes/[id]/similar-recipes/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () => fromApp('GET', '/api/recipes/f1/similar-recipes');

describe('GET /api/recipes/:id/similar-recipes', () => {
  it('answers 401 when nobody is signed in', async () => {
    expect((await GET(request(), ctx('f1'))).status).toBe(401);
  });

  it('answers 404 for a recipe the person does not have', async () => {
    await signIn(world);
    expect((await GET(request(), ctx('none'))).status).toBe(404);
  });

  it('answers an empty page when the list has not been computed yet', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'f1', '>> title: A\n');
    const res = await GET(request(), ctx('f1'));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: unknown[] }).items).toEqual([]);
  });

  it('answers the stored list, best first, as id and title', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'f1', '>> title: A\n');
    world.raw
      .prepare(
        "INSERT INTO embeddings (user_id, drive_file_id, title, vector, similar) VALUES (?, 'f1', 'A', '[]', ?)",
      )
      .run(
        uid,
        JSON.stringify([
          { id: 'x', title: 'Ex' },
          { id: 'y', title: 'Why' },
        ]),
      );
    const res = await GET(request(), ctx('f1'));
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(((await res.json()) as { items: unknown[] }).items).toEqual([
      { id: 'x', title: 'Ex' },
      { id: 'y', title: 'Why' },
    ]);
  });
});
