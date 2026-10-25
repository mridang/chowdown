import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { entityTag } from '@/lib/core/api';
import { fakeCookies } from '../../../../../lib/auth/session-fixture';
import {
  addRecipe,
  fakeGoogle,
  fromApp,
  openWorld,
  signIn,
  type World,
} from '../../../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { GET, POST } = await import('@/app/api/recipes/[id]/notes/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

const SOURCE = '>> title: Curry\n\nCook @onion{1}.\n';
const WITH_NOTE = `${SOURCE}\n-- [note] Use less salt\n`;

/** The context Next hands a handler for `/api/recipes/:id/notes`. */
const ctx = (id = 'f1') => ({ params: Promise.resolve({ id }) });

/** Sign in with Drive and cache `f1`, in the cache and in the fake Drive. */
async function withRecipe(source = SOURCE) {
  const uid = await signIn(world, { drive: true });
  addRecipe(world, uid, 'f1', source, 'Curry.cook');
  return fakeGoogle({ f1: { name: 'Curry.cook', content: source } });
}

describe('GET /api/recipes/:id/notes', () => {
  it('answers 401 when nobody is signed in', async () => {
    expect(
      (await GET(fromApp('GET', '/api/recipes/f1/notes'), ctx())).status,
    ).toBe(401);
  });

  it('answers 404 for a recipe the person does not have', async () => {
    await signIn(world);
    expect(
      (await GET(fromApp('GET', '/api/recipes/none/notes'), ctx('none')))
        .status,
    ).toBe(404);
  });

  it('lists the notes numbered from 1', async () => {
    await withRecipe(WITH_NOTE);
    const res = await GET(fromApp('GET', '/api/recipes/f1/notes'), ctx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string; text: string; scope: string }[];
    };
    expect(body.items).toEqual([
      { id: '1', scope: 'GENERAL', text: 'Use less salt' },
    ]);
  });
});

describe('POST /api/recipes/:id/notes', () => {
  const add = (json: unknown, headers: Record<string, string> = {}) =>
    POST(fromApp('POST', '/api/recipes/f1/notes', { json, headers }), ctx());

  it('answers 401 when nobody is signed in', async () => {
    expect((await add({ text: 'x' })).status).toBe(401);
  });

  it('answers 403 for a request from another site', async () => {
    await withRecipe();
    const res = await add({ text: 'x' }, { 'sec-fetch-site': 'cross-site' });
    expect(res.status).toBe(403);
  });

  it('answers 400 for a note without text', async () => {
    await withRecipe();
    expect((await add({})).status).toBe(400);
  });

  it('answers 400 when both an ingredient and a step are given', async () => {
    await withRecipe();
    expect(
      (await add({ text: 'x', ingredient: 'onion', step: 1 })).status,
    ).toBe(400);
  });

  it('appends the note to the Drive file and answers 201 with Location and ETag', async () => {
    const google = await withRecipe();
    const res = await add({ text: 'Use less salt' });
    expect(res.status).toBe(201);
    expect(res.headers.get('location')).toBe(
      'https://chowdown.test/api/recipes/f1/notes/1',
    );
    expect(res.headers.get('etag')).toBe(
      await entityTag(google.files.get('f1')?.content ?? ''),
    );
    expect(google.files.get('f1')?.content).toContain('Use less salt');
    expect(await res.json()).toEqual({
      id: '1',
      scope: 'GENERAL',
      text: 'Use less salt',
    });
  });

  it('numbers a second note 2', async () => {
    await withRecipe(WITH_NOTE);
    const res = await add({ text: 'And more pepper' });
    expect(((await res.json()) as { id: string }).id).toBe('2');
  });

  it('answers 404 for a recipe the person does not have, without touching Drive', async () => {
    await signIn(world, { drive: true });
    const google = fakeGoogle();
    const res = await POST(
      fromApp('POST', '/api/recipes/none/notes', { json: { text: 'x' } }),
      ctx('none'),
    );
    expect(res.status).toBe(404);
    expect(google.requests.filter((r) => r.includes('/files/none'))).toEqual(
      [],
    );
  });

  it('answers 412 when If-Match is stale', async () => {
    await withRecipe();
    expect((await add({ text: 'x' }, { 'if-match': '"stale"' })).status).toBe(
      412,
    );
  });

  it('answers 409 when Google Drive is not connected', async () => {
    await signIn(world, { drive: false });
    expect((await add({ text: 'x' })).status).toBe(409);
  });
});
