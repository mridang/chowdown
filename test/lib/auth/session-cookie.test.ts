import { describe, expect, it } from '@jest/globals';
import { NextResponse } from 'next/server';

import { verifySessionToken } from '../../../src/lib/auth/session';
import { setSessionCookie } from '../../../src/lib/auth/session-cookie';
import type { User } from '../../../src/lib/db/users';

const SECRET = 'test-session-secret-value';
const user = (overrides: Partial<User> = {}) =>
  ({
    id: 7,
    email: 'a@b.com',
    name: 'Ada Lovelace',
    picture: null,
    refresh_token_enc: null,
    session_epoch: 0,
    ...overrides,
  }) as User;

async function issued(
  u: User,
  options: { drive?: boolean; exp?: number } = {},
) {
  const response = NextResponse.next();
  await setSessionCookie(response, u, {
    secret: SECRET,
    secure: true,
    ...options,
  });
  const cookie = response.cookies.get('chowdown_session');
  return { cookie, payload: await verifySessionToken(cookie!.value, SECRET) };
}

describe('setSessionCookie', () => {
  it('sets a signed, httpOnly cookie carrying who the person is', async () => {
    const { cookie, payload } = await issued(user());
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(cookie?.secure).toBe(true);
    expect(payload).toMatchObject({
      uid: 7,
      email: 'a@b.com',
      name: 'Ada Lovelace',
    });
  });

  it('takes the Drive hint from the record unless told otherwise', async () => {
    expect((await issued(user())).payload?.drive).toBe(false);
    expect(
      (await issued(user({ refresh_token_enc: 'sealed' }))).payload?.drive,
    ).toBe(true);
    expect((await issued(user(), { drive: true })).payload?.drive).toBe(true);
  });

  it("stamps the session with the account's epoch, so signing out everywhere can end it", async () => {
    expect((await issued(user({ session_epoch: 4 }))).payload?.ep).toBe(4);
  });

  it('keeps an existing expiry, so correcting the hint never lengthens a session', async () => {
    const soon = Math.floor(Date.now() / 1000) + 3600;
    expect((await issued(user(), { exp: soon })).payload?.exp).toBe(soon);
  });

  it('starts a full session when no expiry is given', async () => {
    const { payload } = await issued(user());
    expect(payload!.exp).toBeGreaterThan(
      Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 29,
    );
  });
});
