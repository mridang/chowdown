import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { NextResponse } from 'next/server';

import { SessionTokens } from '@/lib/session';
import { SESSION_COOKIE } from '@/domain/auth/app';
import {
  SESSION_SECRET,
  fakeCookies,
  jar,
  sessionTokenFor,
} from '../../../lib/auth/session-fixture';
import {
  locationOf,
  nextRequest,
  openWorld,
  signIn,
  type World,
} from '../../api/world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const { GET } = await import('@/app/auth/drive/route');

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

describe('GET /auth/drive', () => {
  it('sends someone who is not signed in to sign in first, then straight back here', async () => {
    const res = await GET(nextRequest('/auth/drive?returnTo=%2Fconnect'));
    const login = locationOf(res);
    expect(login?.pathname).toBe('/auth/login');
    expect(login?.searchParams.get('returnTo')).toBe(
      '/auth/drive?returnTo=%2Fconnect',
    );
  });

  it('sends a signed-in person without Drive to Google for the Drive permission', async () => {
    await signIn(world, { email: 'ada@example.com' });
    const res = await GET(nextRequest('/auth/drive?returnTo=%2Fconnect'));
    const target = locationOf(res);
    expect(target?.host).toBe('accounts.google.com');
    expect(target?.searchParams.get('scope')).toContain('drive.file');
    expect(target?.searchParams.get('access_type')).toBe('offline');
    expect(target?.searchParams.get('login_hint')).toBe('ada@example.com');
    const state = target?.searchParams.get('state');
    expect(state).toMatch(/^drive\./);
    expect(
      (res as NextResponse).cookies.get('chowdown_oauth_state')?.value,
    ).toBe(state);
    expect((res as NextResponse).cookies.get('chowdown_return_to')?.value).toBe(
      '/connect',
    );
  });

  it('does not go to Google again for someone already connected, and keeps their session length', async () => {
    await signIn(world, { drive: true });
    const soon = Math.floor(Date.now() / 1000) + 3600;
    jar.set(SESSION_COOKIE, await sessionTokenFor({ id: 1 }, { exp: soon }));
    const res = await GET(nextRequest('/auth/drive?returnTo=%2Fconnect'));
    expect(locationOf(res)?.href).toBe('https://chowdown.test/connect');
    const cookie =
      (res as NextResponse).cookies.get(SESSION_COOKIE)?.value ?? '';
    const session = await new SessionTokens(SESSION_SECRET).verify(cookie);
    expect(session).toMatchObject({ drive: true, exp: soon });
  });

  it('goes to Google anyway with force=1, for a stored login that no longer works', async () => {
    await signIn(world, { drive: true });
    const res = await GET(nextRequest('/auth/drive?force=1'));
    expect(locationOf(res)?.host).toBe('accounts.google.com');
  });

  it('treats a session that was ended as signed out', async () => {
    await signIn(world);
    world.raw.prepare('UPDATE users SET session_epoch = 1').run();
    const res = await GET(nextRequest('/auth/drive'));
    expect(locationOf(res)?.pathname).toBe('/auth/login');
  });

  it('ignores a returnTo that leaves the site', async () => {
    await signIn(world);
    const res = await GET(
      nextRequest(
        `/auth/drive?returnTo=${encodeURIComponent('https://evil.example')}`,
      ),
    );
    expect(
      (res as NextResponse).cookies.get('chowdown_return_to')?.value ?? '',
    ).toBe('');
  });
});
