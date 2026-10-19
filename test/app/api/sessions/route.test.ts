import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { SESSION_COOKIE } from '../../../../src/lib/auth/session';
import { fakeCookies } from '../../../lib/auth/session-fixture';
import { fromApp, openWorld, signIn, type World } from '../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { DELETE } = await import('../../../../src/app/api/sessions/route');
const { GET } = await import('../../../../src/app/api/users/self/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

const epochOf = (id: number) =>
  world.raw
    .prepare('SELECT session_epoch AS e FROM users WHERE id = ?')
    .get(id);

describe('DELETE /api/sessions', () => {
  it('answers 401 when nobody is signed in', async () => {
    expect((await DELETE(fromApp('DELETE', '/api/sessions'))).status).toBe(401);
  });

  it('answers 403 for a request from another site, and ends nothing', async () => {
    await signIn(world);
    const res = await DELETE(
      fromApp('DELETE', '/api/sessions', {
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
    );
    expect(res.status).toBe(403);
    expect(epochOf(1)).toEqual({ e: 0 });
  });

  it('moves the account to the next epoch, clears this cookie and answers 204', async () => {
    await signIn(world);
    const res = await DELETE(fromApp('DELETE', '/api/sessions'));
    expect(res.status).toBe(204);
    expect(epochOf(1)).toEqual({ e: 1 });
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
  });

  it('ends the session of another device too: its cookie stops working', async () => {
    await signIn(world);
    // This is the "other device": the same cookie, kept aside.
    const otherDevice = await GET(fromApp('GET', '/api/users/self'));
    expect(otherDevice.status).toBe(200);
    await DELETE(fromApp('DELETE', '/api/sessions'));
    expect((await GET(fromApp('GET', '/api/users/self'))).status).toBe(401);
  });

  it("leaves other people's sessions alone", async () => {
    await signIn(world);
    world.raw
      .prepare(
        "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (2, 's2', 'b@c.d', 'n', 'n')",
      )
      .run();
    await DELETE(fromApp('DELETE', '/api/sessions'));
    expect(epochOf(2)).toEqual({ e: 0 });
  });

  it('lets the person sign in again afterwards under the new epoch', async () => {
    await signIn(world);
    await DELETE(fromApp('DELETE', '/api/sessions'));
    const { jar, sessionTokenFor } =
      await import('../../../lib/auth/session-fixture');
    jar.set(SESSION_COOKIE, await sessionTokenFor({ id: 1 }, { ep: 1 }));
    expect((await GET(fromApp('GET', '/api/users/self'))).status).toBe(200);
  });
});
