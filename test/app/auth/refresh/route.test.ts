import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { SESSION_COOKIE } from '@/domain/auth/app';
import { SessionTokens } from '@/lib/session';
import { sessionTokenFor } from '../../../domain/auth/session-fixture';
import {
  SESSION_SECRET,
  fakeCookies,
  jar,
  nextResponseOf,
} from '../../../domain/auth/auth-test-kit';
import { locationOf, nextRequest, openWorld, signIn } from '../../api/world';
import type { World } from '../../api/world';

// eslint-disable-next-line tslop/no-module-mocking -- next/headers is a framework module the code under test imports directly, and it only works inside a Next request
jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { GET } = await import('@/app/auth/refresh/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(async () => world.close());

/** The session the route put in its response cookie. */
async function reissued(res: Awaited<ReturnType<typeof GET>>) {
  const value = nextResponseOf(res).cookies.get(SESSION_COOKIE)?.value;
  return value ? new SessionTokens(SESSION_SECRET).verify(value) : null;
}

describe('GET /auth/refresh', () => {
  it('sends someone who is not signed in to the home page', async () => {
    const res = await GET(nextRequest('/auth/refresh'));
    expect(locationOf(res)?.pathname).toBe('/');
  });

  it('clears a session cookie that no longer stands for anyone', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 1').run();
    const res = await GET(nextRequest('/auth/refresh?returnTo=%2Fapp'));
    expect(locationOf(res)?.pathname).toBe('/');
    expect(res.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`);
  });

  it('reissues the cookie with the current Drive state and sends the person on', async () => {
    await signIn(world, { drive: true });
    const res = await GET(nextRequest('/auth/refresh?returnTo=%2Frecipe%2Fx'));
    expect(locationOf(res)?.pathname).toBe('/recipe/x');
    const session = await reissued(res);
    expect(session?.['drive']).toBe(true);
  });

  it.each([
    '',
    '?returnTo=https%3A%2F%2Fevil.example',
    '?returnTo=%2F%2Fevil.example',
  ])(
    'goes to /app when there is no returnTo, or an unsafe one (%j)',
    async (query) => {
      await signIn(world);
      const res = await GET(nextRequest(`/auth/refresh${query}`));
      expect(locationOf(res)?.href).toBe('https://chowdown.test/app');
    },
  );

  it('never lengthens the session', async () => {
    await signIn(world);
    const soon = Math.floor(Date.now() / 1000) + 3600;
    jar.set(SESSION_COOKIE, await sessionTokenFor({ id: 1 }, { exp: soon }));
    const res = await GET(nextRequest('/auth/refresh'));
    const session = await reissued(res);
    expect(session?.exp).toBe(soon);
  });

  it("carries the account's current epoch into the new cookie", async () => {
    await signIn(world, { epoch: 3 });
    const res = await GET(nextRequest('/auth/refresh'));
    const session = await reissued(res);
    expect(session?.ep).toBe(3);
  });
});
