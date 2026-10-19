import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { SESSION_COOKIE } from '../../../../../src/lib/auth/session';
import { fakeCookies } from '../../../../lib/auth/session-fixture';
import { settleBackground } from '../../../../lib/db/sqlite-d1';
import {
  addRecipe,
  fakeGoogle,
  fromApp,
  openWorld,
  signIn,
  type World,
} from '../../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { DELETE, GET, PATCH } =
  await import('../../../../../src/app/api/users/self/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

describe('GET /api/users/self', () => {
  it('answers 401 when nobody is signed in', async () => {
    expect((await GET(fromApp('GET', '/api/users/self'))).status).toBe(401);
  });

  it('answers the profile', async () => {
    await signIn(world, { email: 'ada@example.com' });
    const res = await GET(fromApp('GET', '/api/users/self'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(await res.json()).toEqual({ id: '1', email: 'ada@example.com' });
  });

  it('answers 401 once the session was ended', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 1').run();
    expect((await GET(fromApp('GET', '/api/users/self'))).status).toBe(401);
  });
});

describe('PATCH /api/users/self', () => {
  const patch = (json: unknown, type = 'application/merge-patch+json') =>
    PATCH(fromApp('PATCH', '/api/users/self', { json, type }));

  it('answers 401 when nobody is signed in', async () => {
    expect((await patch({ measurement_system: 'US' })).status).toBe(401);
  });

  it('answers 403 for a request from another site', async () => {
    await signIn(world);
    const res = await PATCH(
      fromApp('PATCH', '/api/users/self', {
        json: {},
        type: 'application/merge-patch+json',
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('sets the measurement system with a merge patch', async () => {
    await signIn(world);
    const res = await patch({ measurement_system: 'US' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ measurement_system: 'US' });
    expect(world.raw.prepare('SELECT units FROM users').get()).toEqual({
      units: 'us',
    });
  });

  it('clears it with null', async () => {
    await signIn(world);
    await patch({ measurement_system: 'METRIC' });
    const res = await patch({ measurement_system: null });
    expect((await res.json()) as object).not.toHaveProperty(
      'measurement_system',
    );
    expect(world.raw.prepare('SELECT units FROM users').get()).toEqual({
      units: null,
    });
  });

  it('accepts plain JSON as well', async () => {
    await signIn(world);
    expect(
      (await patch({ measurement_system: 'IMPERIAL' }, 'application/json'))
        .status,
    ).toBe(200);
  });

  it('answers 415 for another media type', async () => {
    await signIn(world);
    expect((await patch({}, 'text/plain')).status).toBe(415);
  });

  it('answers 400 for a patch that is not an object', async () => {
    await signIn(world);
    expect((await patch([])).status).toBe(400);
  });

  it('answers 400 for a value that is not allowed', async () => {
    await signIn(world);
    expect((await patch({ measurement_system: 'FURLONGS' })).status).toBe(400);
  });

  it('answers 400 for a field that cannot be edited, and changes nothing', async () => {
    await signIn(world);
    expect((await patch({ email: 'new@example.com' })).status).toBe(400);
    expect(world.raw.prepare('SELECT email FROM users').get()).toEqual({
      email: 'user1@example.com',
    });
  });
});

describe('DELETE /api/users/self', () => {
  const remove = (headers: Record<string, string> = {}) =>
    DELETE(fromApp('DELETE', '/api/users/self', { headers }));

  /** Everything the person has, in every table that keeps something about them. */
  async function populate() {
    const uid = await signIn(world, { drive: true });
    addRecipe(world, uid, 'f1', '>> title: A\n');
    world.raw
      .prepare(
        "INSERT INTO embeddings (user_id, drive_file_id, title, vector) VALUES (?, 'f1', 'A', '[]')",
      )
      .run(uid);
    world.raw
      .prepare(
        "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, 'f1', 'n')",
      )
      .run(uid);
    world.raw
      .prepare(
        "INSERT INTO recipe_imports (id, user_id, status, items, created_at) VALUES ('i', ?, 'COMPLETED', '[]', 'n')",
      )
      .run(uid);
    world.raw
      .prepare(
        "INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at) VALUES ('c', 'dcr', 'C', '[]', 'n')",
      )
      .run();
    world.raw
      .prepare(
        "INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES ('g', ?, 'c', 's', 'r', 'n')",
      )
      .run(uid);
    world.raw
      .prepare(
        "INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at) VALUES ('t', 'access', 'g', 1)",
      )
      .run();
    return fakeGoogle({ f1: { name: 'A.cook', content: '>> title: A\n' } });
  }

  const count = (table: string) =>
    world.raw.prepare(`SELECT count(*) AS n FROM ${table}`).get();

  it('answers 401 when nobody is signed in', async () => {
    expect((await remove()).status).toBe(401);
  });

  it('answers 403 for a request from another site, and deletes nothing', async () => {
    await populate();
    expect((await remove({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(count('users')).toEqual({ n: 1 });
  });

  it('deletes the account and everything kept about it, and answers 204', async () => {
    await populate();
    const res = await remove();
    expect(res.status).toBe(204);
    for (const table of [
      'users',
      'recipes',
      'embeddings',
      'favourites',
      'recipe_imports',
      'oauth_grants',
      'oauth_tokens',
    ]) {
      expect(count(table)).toEqual({ n: 0 });
    }
  });

  it('ends the session: the cookie is cleared and the same cookie no longer works', async () => {
    await populate();
    const res = await remove();
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
    expect((await GET(fromApp('GET', '/api/users/self'))).status).toBe(401);
  });

  it("leaves the person's files in their own Google Drive alone", async () => {
    const google = await populate();
    await remove();
    expect(google.files.has('f1')).toBe(true);
    expect(google.requests.some((r) => r.startsWith('PATCH'))).toBe(false);
  });

  it('gives the Drive login back to Google', async () => {
    const google = await populate();
    await remove();
    await settleBackground();
    expect(google.requests).toContain(
      'POST https://oauth2.googleapis.com/revoke',
    );
  });

  it("does not touch another person's data", async () => {
    await populate();
    await signIn(world, { id: 2, email: 'other@example.com' });
    addRecipe(world, 2, 'other-file', '>> title: B\n');
    // Delete as the second person.
    await remove();
    expect(count('users')).toEqual({ n: 1 });
    expect(
      world.raw.prepare('SELECT drive_file_id AS f FROM recipes').all(),
    ).toEqual([{ f: 'f1' }]);
  });
});
