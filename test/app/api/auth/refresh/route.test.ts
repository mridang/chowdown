import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  SESSION_COOKIE,
  verifySessionToken,
} from '../../../../../src/lib/auth/session';
import {
  SESSION_SECRET,
  fakeCookies,
  jar,
  sessionTokenFor,
} from '../../../../lib/auth/session-fixture';
import {
  locationOf,
  nextRequest,
  openWorld,
  signIn,
  type World,
} from '../../world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { GET } = await import('../../../../../src/app/api/auth/refresh/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

/** The session the route put in its response cookie. */
async function reissued(res: Awaited<ReturnType<typeof GET>>) {
  const value = res.cookies.get(SESSION_COOKIE)?.value;
  return value ? verifySessionToken(value, SESSION_SECRET) : null;
}

describe('GET /api/auth/refresh', () => {
  it('sends someone who is not signed in to the home page', async () => {
    const res = await GET(nextRequest('/api/auth/refresh'));
    expect(locationOf(res)?.pathname).toBe('/');
  });

  it('clears a session cookie that no longer stands for anyone', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 1').run();
    const res = await GET(nextRequest('/api/auth/refresh?returnTo=%2Fapp'));
    expect(locationOf(res)?.pathname).toBe('/');
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
  });

  it('reissues the cookie with the current Drive state and sends the person on', async () => {
    await signIn(world, { drive: true });
    const res = await GET(
      nextRequest('/api/auth/refresh?returnTo=%2Frecipe%2Fx'),
    );
    expect(locationOf(res)?.pathname).toBe('/recipe/x');
    expect((await reissued(res))?.drive).toBe(true);
  });

  it('goes to /app when there is no returnTo, or an unsafe one', async () => {
    await signIn(world);
    for (const query of [
      '',
      '?returnTo=https%3A%2F%2Fevil.example',
      '?returnTo=%2F%2Fevil.example',
    ]) {
      const res = await GET(nextRequest(`/api/auth/refresh${query}`));
      expect(locationOf(res)?.href).toBe('https://chowdown.test/app');
    }
  });

  it('never lengthens the session', async () => {
    await signIn(world);
    const soon = Math.floor(Date.now() / 1000) + 3600;
    jar.set(SESSION_COOKIE, await sessionTokenFor({ id: 1 }, { exp: soon }));
    const res = await GET(nextRequest('/api/auth/refresh'));
    expect((await reissued(res))?.exp).toBe(soon);
  });

  it("carries the account's current epoch into the new cookie", async () => {
    await signIn(world, { epoch: 3 });
    const res = await GET(nextRequest('/api/auth/refresh'));
    expect((await reissued(res))?.ep).toBe(3);
  });
});
