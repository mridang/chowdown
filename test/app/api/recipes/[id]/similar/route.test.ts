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

const { GET } = await import('@/app/api/recipes/[id]/similar/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(async () => world.close());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () => fromApp('GET', '/api/recipes/f1/similar');

describe('GET /api/recipes/:id/similar', () => {
  it('answers 401 when nobody is signed in', async () => {
    const res = await GET(request(), ctx('f1'));
    expect(res.status).toBe(401);
  });

  it('answers 404 for a recipe the person does not have', async () => {
    await signIn(world);
    const res = await GET(request(), ctx('none'));
    expect(res.status).toBe(404);
  });

  it('answers an empty page when the list has not been computed yet', async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'f1', '>> title: A\n');
    const res = await GET(request(), ctx('f1'));
    expect(res.status).toBe(200);
    expect(await res.json<{ items: unknown[] }>()).toHaveProperty('items', []);
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
    expect(await res.json<{ items: unknown[] }>()).toHaveProperty('items', [
      { id: 'x', title: 'Ex' },
      { id: 'y', title: 'Why' },
    ]);
  });
});
