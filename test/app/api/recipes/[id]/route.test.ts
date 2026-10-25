import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { entityTag } from '@/lib/core/api';
import { fakeCookies, insertUser } from '../../../../lib/auth/session-fixture';
import {
  addRecipe,
  fakeGoogle,
  fromApp,
  openWorld,
  signIn,
  type World,
} from '../../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { DELETE, GET, PATCH, PUT } =
  await import('@/app/api/recipes/[id]/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

const SOURCE = '>> title: Curry\n\nCook @onion{1} in a #pan.\n';

/** The context Next hands a handler for `/api/recipes/:id`. */
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Sign in with Drive, cache `f1`, and put the same text in the fake Drive. */
async function withRecipe() {
  const uid = await signIn(world, { drive: true });
  addRecipe(world, uid, 'f1', SOURCE, 'Curry.cook');
  const google = fakeGoogle({ f1: { name: 'Curry.cook', content: SOURCE } });
  return { uid, google };
}

describe('GET /api/recipes/:id', () => {
  it('answers 401 when nobody is signed in', async () => {
    const res = await GET(fromApp('GET', '/api/recipes/f1'), ctx('f1'));
    expect(res.status).toBe(401);
  });

  it("answers 404 for a recipe the person does not have, including one that is another person's", async () => {
    await signIn(world);
    insertUser(world.raw, { id: 99, email: 'x@y.z' });
    addRecipe(world, 99, 'theirs', SOURCE);
    expect(
      (await GET(fromApp('GET', '/api/recipes/theirs'), ctx('theirs'))).status,
    ).toBe(404);
  });

  it('answers the recipe as JSON with an ETag', async () => {
    await withRecipe();
    const res = await GET(fromApp('GET', '/api/recipes/f1'), ctx('f1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toMatch(/^"/);
    expect(res.headers.get('vary')).toBe('Accept');
    const body = (await res.json()) as { id: string; cooklang: string };
    expect(body).toMatchObject({ id: 'f1', cooklang: SOURCE });
  });

  it('answers the Cooklang text when asked for it', async () => {
    await withRecipe();
    const res = await GET(
      fromApp('GET', '/api/recipes/f1', {
        headers: { accept: 'text/x-cooklang' },
      }),
      ctx('f1'),
    );
    expect(res.headers.get('content-type')).toContain('text/x-cooklang');
    expect(await res.text()).toBe(SOURCE);
  });

  it('answers schema.org JSON-LD when asked for it', async () => {
    await withRecipe();
    const res = await GET(
      fromApp('GET', '/api/recipes/f1', {
        headers: { accept: 'application/ld+json' },
      }),
      ctx('f1'),
    );
    expect(res.headers.get('content-type')).toBe('application/ld+json');
    expect(await res.json()).toMatchObject({ '@type': 'Recipe' });
  });

  it('answers 304 when If-None-Match matches', async () => {
    await withRecipe();
    const first = await GET(fromApp('GET', '/api/recipes/f1'), ctx('f1'));
    const res = await GET(
      fromApp('GET', '/api/recipes/f1', {
        headers: { 'if-none-match': first.headers.get('etag') ?? '' },
      }),
      ctx('f1'),
    );
    expect(res.status).toBe(304);
  });
});

describe('PUT /api/recipes/:id', () => {
  const replace = (json: unknown, headers: Record<string, string> = {}) =>
    PUT(fromApp('PUT', '/api/recipes/f1', { json, headers }), ctx('f1'));

  it('answers 401 when nobody is signed in', async () => {
    expect((await replace({ cooklang: 'x' })).status).toBe(401);
  });

  it('answers 403 for a request from another site', async () => {
    await withRecipe();
    const res = await replace(
      { cooklang: 'x' },
      { 'sec-fetch-site': 'cross-site' },
    );
    expect(res.status).toBe(403);
  });

  it('answers 415 for a body that is not JSON', async () => {
    await withRecipe();
    const res = await PUT(
      fromApp('PUT', '/api/recipes/f1', { body: 'x', type: 'text/plain' }),
      ctx('f1'),
    );
    expect(res.status).toBe(415);
  });

  it('answers 413 for a body over 1 MiB, and changes nothing', async () => {
    const { google } = await withRecipe();
    const res = await PUT(
      fromApp('PUT', '/api/recipes/f1', {
        body: JSON.stringify({ cooklang: 'y'.repeat(1_100_000) }),
      }),
      ctx('f1'),
    );
    expect(res.status).toBe(413);
    expect(google.files.get('f1')?.content).toBe(SOURCE);
  });

  it('answers 400 for tens of thousands of lines, and changes nothing', async () => {
    const { google } = await withRecipe();
    const res = await replace({ cooklang: `x${'\n'.repeat(150_000)}` });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { errors: string[] }).errors).toEqual([
      'cooklang: at most 5000 lines.',
    ]);
    expect(google.files.get('f1')?.content).toBe(SOURCE);
  });

  it('answers 400 without a cooklang field', async () => {
    await withRecipe();
    expect((await replace({})).status).toBe(400);
  });

  it('writes the new text to Drive and answers 200 with the recipe', async () => {
    const { google } = await withRecipe();
    const res = await replace({ cooklang: '>> title: Better\n\nCook.\n' });
    expect(res.status).toBe(200);
    expect(google.files.get('f1')?.content).toBe('>> title: Better\n\nCook.\n');
    expect(
      world.raw
        .prepare('SELECT source FROM recipes WHERE drive_file_id = ?')
        .get('f1'),
    ).toEqual({ source: '>> title: Better\n\nCook.\n' });
  });

  it("answers 404 for another person's recipe and never touches Drive", async () => {
    await signIn(world, { drive: true });
    const google = fakeGoogle({ theirs: { name: 'T.cook', content: 'x' } });
    const res = await PUT(
      fromApp('PUT', '/api/recipes/theirs', { json: { cooklang: 'hacked' } }),
      ctx('theirs'),
    );
    expect(res.status).toBe(404);
    expect(google.files.get('theirs')?.content).toBe('x');
    expect(google.requests.filter((r) => r.includes('/files/theirs'))).toEqual(
      [],
    );
  });

  it('answers 412 when If-Match is stale, and changes nothing', async () => {
    const { google } = await withRecipe();
    const res = await replace({ cooklang: 'new' }, { 'if-match': '"stale"' });
    expect(res.status).toBe(412);
    expect(google.files.get('f1')?.content).toBe(SOURCE);
  });

  it('accepts a current If-Match', async () => {
    await withRecipe();
    const res = await replace(
      { cooklang: 'new text' },
      { 'if-match': await entityTag(SOURCE) },
    );
    expect(res.status).toBe(200);
  });

  it('answers 409 when Google Drive is not connected', async () => {
    await signIn(world, { drive: false });
    expect((await replace({ cooklang: 'x' })).status).toBe(409);
  });

  it('answers 502 when Drive fails', async () => {
    await withRecipe();
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) =>
        String(input).includes('oauth2')
          ? new Response(
              JSON.stringify({ access_token: 't', expires_in: 3599 }),
            )
          : new Response('boom', { status: 500 }),
      );
    expect((await replace({ cooklang: 'x' })).status).toBe(502);
  });
});

describe('PATCH /api/recipes/:id', () => {
  const patch = (json: unknown, type = 'application/merge-patch+json') =>
    PATCH(fromApp('PATCH', '/api/recipes/f1', { json, type }), ctx('f1'));

  it('answers 401 when nobody is signed in', async () => {
    expect((await patch({ title: 'x' })).status).toBe(401);
  });

  it('accepts the merge-patch media type and edits the title', async () => {
    const { google } = await withRecipe();
    const res = await patch({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(google.files.get('f1')?.content).toContain('>> title: Renamed');
  });

  it('accepts plain JSON too', async () => {
    await withRecipe();
    expect((await patch({ title: 'Plain' }, 'application/json')).status).toBe(
      200,
    );
  });

  it('answers 415 for another media type', async () => {
    await withRecipe();
    expect((await patch({ title: 'x' }, 'text/plain')).status).toBe(415);
  });

  it('answers 400 for a patch that is not an object', async () => {
    await withRecipe();
    expect((await patch([1])).status).toBe(400);
  });

  it('answers 400 for a patch that is not valid', async () => {
    await withRecipe();
    expect((await patch({ id: 'cannot-change' })).status).toBe(400);
  });

  it('answers 413 for a patch over 256 KiB', async () => {
    await withRecipe();
    expect((await patch({ title: 'y'.repeat(300_000) })).status).toBe(413);
  });

  it('answers 404 for a recipe the person does not have', async () => {
    await signIn(world, { drive: true });
    fakeGoogle();
    const res = await PATCH(
      fromApp('PATCH', '/api/recipes/none', {
        json: { title: 'x' },
        type: 'application/merge-patch+json',
      }),
      ctx('none'),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/recipes/:id', () => {
  const remove = (id = 'f1') =>
    DELETE(fromApp('DELETE', `/api/recipes/${id}`), ctx(id));

  it('answers 401 when nobody is signed in', async () => {
    expect((await remove()).status).toBe(401);
  });

  it('trashes the Drive file, forgets the cache and answers 204', async () => {
    const { google } = await withRecipe();
    const res = await remove();
    expect(res.status).toBe(204);
    expect(google.files.has('f1')).toBe(false);
    expect(
      world.raw.prepare('SELECT count(*) AS n FROM recipes').get(),
    ).toEqual({
      n: 0,
    });
  });

  it('answers 404 for a recipe the person does not have, without touching Drive', async () => {
    await signIn(world, { drive: true });
    const google = fakeGoogle({ theirs: { name: 'T.cook', content: 'x' } });
    expect((await remove('theirs')).status).toBe(404);
    expect(google.files.has('theirs')).toBe(true);
  });

  it('answers 409 when Google Drive is not connected', async () => {
    await signIn(world, { drive: false });
    expect((await remove()).status).toBe(409);
  });
});
