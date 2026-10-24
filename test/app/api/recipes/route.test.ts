import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { fakeCookies } from '../../../lib/auth/session-fixture';
import {
  addRecipe,
  fakeGoogle,
  fromApp,
  openWorld,
  signIn,
  type World,
} from '../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { GET, POST } = await import('@/app/api/recipes/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

const CURRY =
  '>> title: Curry\n>> source: https://site.com/curry\n\nCook @onion{1}.\n';

describe('GET /api/recipes', () => {
  it('answers 401 when nobody is signed in', async () => {
    const res = await GET(fromApp('GET', '/api/recipes'));
    expect(res.status).toBe(401);
  });

  it("lists the signed-in person's recipes", async () => {
    const uid = await signIn(world);
    addRecipe(world, uid, 'f1', CURRY, 'Curry.cook');
    const res = await GET(fromApp('GET', '/api/recipes'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items.map((r) => r.id)).toEqual(['f1']);
  });

  it('answers 401 for a session that was ended by signing out everywhere', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 1').run();
    const res = await GET(fromApp('GET', '/api/recipes'));
    expect(res.status).toBe(401);
  });

  it('answers 400 for a bad limit', async () => {
    await signIn(world);
    const res = await GET(fromApp('GET', '/api/recipes?limit=500'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/recipes', () => {
  const create = (json: unknown = { name: 'Curry', cooklang: CURRY }) =>
    POST(fromApp('POST', '/api/recipes', { json }));

  it('answers 401 when nobody is signed in', async () => {
    expect((await create()).status).toBe(401);
  });

  it('answers 403 for a request from another site', async () => {
    await signIn(world, { drive: true });
    const res = await POST(
      fromApp('POST', '/api/recipes', {
        json: { name: 'x', cooklang: 'y' },
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('answers 415 for a body that is not JSON', async () => {
    await signIn(world, { drive: true });
    const res = await POST(
      fromApp('POST', '/api/recipes', { body: 'name=x', type: 'text/plain' }),
    );
    expect(res.status).toBe(415);
  });

  it('answers 400 for a body that is not a JSON object', async () => {
    await signIn(world, { drive: true });
    expect((await create([1, 2])).status).toBe(400);
  });

  it('answers 400 with the problems for an invalid recipe', async () => {
    await signIn(world, { drive: true });
    const res = await create({ name: '', cooklang: '' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors?: string[] };
    expect(body.errors?.length).toBeGreaterThan(0);
  });

  it('answers 409 when Google Drive is not connected', async () => {
    await signIn(world, { drive: false });
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
  });

  it('writes the file to Drive, caches it and answers 201 with its Location', async () => {
    const uid = await signIn(world, { drive: true });
    const google = fakeGoogle();
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.headers.get('location')).toBe(
      'https://chowdown.test/api/recipes/created-1',
    );
    expect(google.files.get('created-1')?.name).toBe('Curry.cook');
    expect(
      world.raw
        .prepare('SELECT user_id AS u FROM recipes WHERE drive_file_id = ?')
        .get('created-1'),
    ).toEqual({ u: uid });
    const body = (await res.json()) as { id: string; title: string };
    expect(body.id).toBe('created-1');
  });

  it('answers 200 with the existing recipe, and writes nothing, when its source link is already saved', async () => {
    const uid = await signIn(world, { drive: true });
    addRecipe(world, uid, 'existing', CURRY, 'Curry.cook');
    const google = fakeGoogle();
    const res = await create({ name: 'Curry again', cooklang: CURRY });
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBe(
      'https://chowdown.test/api/recipes/existing',
    );
    expect(google.files.size).toBe(0);
  });

  it('answers 502 and caches nothing when Drive fails', async () => {
    await signIn(world, { drive: true });
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) =>
        String(input).includes('oauth2')
          ? new Response(
              JSON.stringify({ access_token: 't', expires_in: 3599 }),
            )
          : new Response('boom', { status: 500 }),
      );
    const res = await create();
    expect(res.status).toBe(502);
    expect(
      world.raw.prepare('SELECT count(*) AS n FROM recipes').get(),
    ).toEqual({
      n: 0,
    });
  });

  it('accepts a recipe at the length limit even though its JSON is over 256 KiB', async () => {
    await signIn(world, { drive: true });
    fakeGoogle();
    // 5,000 lines of 19 emoji: just under 200,000 UTF-16 units, about 385 KB as JSON.
    const long = `${'\u{1F373}'.repeat(19)}\n`.repeat(4_999);
    const res = await create({ name: 'Long', cooklang: long });
    expect(res.status).toBe(201);
  });

  it('answers 400 for a recipe of tens of thousands of blank lines, without parsing it', async () => {
    await signIn(world, { drive: true });
    const google = fakeGoogle();
    const res = await create({
      name: 'Blank',
      cooklang: `x${'\n'.repeat(150_000)}`,
    });
    expect(res.status).toBe(400);
    expect(google.requests).toEqual([]);
  });

  it('answers 413 for a body over 1 MiB, without reading it into Drive', async () => {
    await signIn(world, { drive: true });
    const google = fakeGoogle();
    const res = await POST(
      fromApp('POST', '/api/recipes', {
        body: JSON.stringify({ name: 'x', cooklang: 'y'.repeat(1_100_000) }),
      }),
    );
    expect(res.status).toBe(413);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(google.requests).toEqual([]);
  });

  it('refuses a session that has been ended', async () => {
    await signIn(world, { drive: true });
    world.raw.prepare('UPDATE users SET session_epoch = 5').run();
    expect((await create()).status).toBe(401);
  });
});
