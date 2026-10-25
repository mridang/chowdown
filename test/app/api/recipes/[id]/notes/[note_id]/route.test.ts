import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { fakeCookies } from '../../../../../../lib/auth/session-fixture';
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
  await import('@/app/api/recipes/[id]/notes/[note_id]/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

const SOURCE =
  '>> title: Curry\n\nCook @onion{1}.\n\n-- [note] First\n-- [note] Second\n';

/** The context Next hands a handler for `/api/recipes/:id/notes/:note_id`. */
const ctx = (noteId: string, id = 'f1') => ({
  params: Promise.resolve({ id, note_id: noteId }),
});

/** Sign in with Drive and cache `f1` with two notes, in the cache and in the fake Drive. */
async function withNotes() {
  const uid = await signIn(world, { drive: true });
  addRecipe(world, uid, 'f1', SOURCE, 'Curry.cook');
  return fakeGoogle({ f1: { name: 'Curry.cook', content: SOURCE } });
}

describe('GET /api/recipes/:id/notes/:note_id', () => {
  it('answers 401 when nobody is signed in', async () => {
    expect((await GET(fromApp('GET', '/x'), ctx('1'))).status).toBe(401);
  });

  it('answers the note at that position', async () => {
    await withNotes();
    const res = await GET(fromApp('GET', '/x'), ctx('2'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: '2',
      scope: 'GENERAL',
      text: 'Second',
    });
  });

  it.each(['3', '0', 'abc', '-1'])(
    'answers 404 for the note id %s',
    async (id) => {
      await withNotes();
      expect((await GET(fromApp('GET', '/x'), ctx(id))).status).toBe(404);
    },
  );

  it('answers 404 for a recipe the person does not have', async () => {
    await signIn(world);
    expect((await GET(fromApp('GET', '/x'), ctx('1', 'none'))).status).toBe(
      404,
    );
  });
});

describe('PUT /api/recipes/:id/notes/:note_id', () => {
  const replace = (
    noteId: string,
    json: unknown,
    headers: Record<string, string> = {},
  ) => PUT(fromApp('PUT', '/x', { json, headers }), ctx(noteId));

  it('answers 401 when nobody is signed in', async () => {
    expect((await replace('1', { text: 'x' })).status).toBe(401);
  });

  it('replaces the note in the Drive file and answers 200 with the new ETag', async () => {
    const google = await withNotes();
    const res = await replace('1', { text: 'Changed' });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toMatch(/^"/);
    expect(google.files.get('f1')?.content).toContain('Changed');
    expect(google.files.get('f1')?.content).not.toContain('First');
  });

  it('answers 400 for a note without text', async () => {
    await withNotes();
    expect((await replace('1', {})).status).toBe(400);
  });

  it('answers 404 for a note that does not exist', async () => {
    await withNotes();
    expect((await replace('9', { text: 'x' })).status).toBe(404);
    expect((await replace('abc', { text: 'x' })).status).toBe(404);
  });

  it('answers 412 when If-Match is stale', async () => {
    await withNotes();
    expect(
      (await replace('1', { text: 'x' }, { 'if-match': '"stale"' })).status,
    ).toBe(412);
  });
});

describe('DELETE /api/recipes/:id/notes/:note_id', () => {
  const remove = (noteId: string, headers: Record<string, string> = {}) =>
    DELETE(fromApp('DELETE', '/x', { headers }), ctx(noteId));

  it('answers 401 when nobody is signed in', async () => {
    expect((await remove('1')).status).toBe(401);
  });

  it('answers 403 for a request from another site', async () => {
    await withNotes();
    expect((await remove('1', { 'sec-fetch-site': 'cross-site' })).status).toBe(
      403,
    );
  });

  it('removes the note from the Drive file and answers 204 with the new ETag', async () => {
    const google = await withNotes();
    const res = await remove('1');
    expect(res.status).toBe(204);
    expect(res.headers.get('etag')).toMatch(/^"/);
    expect(google.files.get('f1')?.content).not.toContain('First');
    expect(google.files.get('f1')?.content).toContain('Second');
  });

  it('answers 404 for a note that does not exist', async () => {
    await withNotes();
    expect((await remove('7')).status).toBe(404);
  });

  it('answers 404 for a recipe the person does not have', async () => {
    await signIn(world, { drive: true });
    fakeGoogle();
    expect(
      (await DELETE(fromApp('DELETE', '/x'), ctx('1', 'none'))).status,
    ).toBe(404);
  });
});
