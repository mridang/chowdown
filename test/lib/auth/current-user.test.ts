import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { DriveNotConnectedError } from '../../../src/lib/auth/drive-access';
import { encryptSecret } from '../../../src/lib/crypto';
import { APP_MIGRATIONS } from '../db/migrations';
import { installCloudflareContext, sqliteD1 } from '../db/sqlite-d1';
import {
  fakeCookies,
  insertUser,
  jar,
  sessionTokenFor,
  testEnv,
} from './session-fixture';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));

const {
  forgetAccessTokens,
  getCurrentUser,
  getLiveSessionUid,
  getSession,
  getSessionUid,
  getUserAccessToken,
} = await import('../../../src/lib/auth/current-user');

let raw: DatabaseSync;
let restore: () => void;
let env: Record<string, unknown>;

beforeEach(() => {
  jar.clear();
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  env = testEnv();
  restore = installCloudflareContext(made.d1, env);
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

/** Send the session cookie for a person. */
async function signIn(
  user: { id: number },
  options: { ep?: number; exp?: number } = {},
) {
  jar.set('chowdown_session', await sessionTokenFor(user, options));
}

describe('getCurrentUser', () => {
  it('is null without a cookie', async () => {
    insertUser(raw);
    expect(await getCurrentUser()).toBeNull();
  });

  it('is the person a valid cookie names', async () => {
    insertUser(raw, { email: 'ada@b.com' });
    await signIn({ id: 1 });
    expect((await getCurrentUser())?.email).toBe('ada@b.com');
  });

  it('is null for a cookie signed with another secret', async () => {
    insertUser(raw);
    const { createSessionToken } =
      await import('../../../src/lib/auth/session');
    jar.set(
      'chowdown_session',
      await createSessionToken({ uid: 1, email: 'a@b.com' }, 'another-secret'),
    );
    expect(await getCurrentUser()).toBeNull();
  });

  it('is null for a cookie that has expired', async () => {
    insertUser(raw);
    await signIn({ id: 1 }, { exp: Math.floor(Date.now() / 1000) - 10 });
    expect(await getCurrentUser()).toBeNull();
  });

  it('is null for a malformed cookie', async () => {
    insertUser(raw);
    jar.set('chowdown_session', 'not-a-token');
    expect(await getCurrentUser()).toBeNull();
  });

  it('is null when the account no longer exists', async () => {
    await signIn({ id: 5 });
    expect(await getCurrentUser()).toBeNull();
  });

  it('is null once the person has signed out everywhere', async () => {
    insertUser(raw, { session_epoch: 1 });
    await signIn({ id: 1 }, { ep: 0 });
    expect(await getCurrentUser()).toBeNull();
  });

  it('accepts a cookie issued before epochs existed while the epoch is still 0', async () => {
    insertUser(raw);
    await signIn({ id: 1 });
    expect(await getCurrentUser()).not.toBeNull();
  });

  it('accepts a cookie issued under the current epoch', async () => {
    insertUser(raw, { session_epoch: 3 });
    await signIn({ id: 1 }, { ep: 3 });
    expect(await getCurrentUser()).not.toBeNull();
  });
});

describe('getSession and getSessionUid', () => {
  it('read the claims from the cookie alone, with no database read', async () => {
    // No such account in the database at all.
    await signIn({ id: 9 });
    expect((await getSession())?.uid).toBe(9);
    expect(await getSessionUid()).toBe(9);
  });

  it('are null for no cookie or a bad one', async () => {
    expect(await getSession()).toBeNull();
    expect(await getSessionUid()).toBeNull();
    jar.set('chowdown_session', 'x.y');
    expect(await getSessionUid()).toBeNull();
  });
});

describe('getLiveSessionUid', () => {
  it('is the id of a session that is still current', async () => {
    insertUser(raw, { session_epoch: 2 });
    await signIn({ id: 1 }, { ep: 2 });
    expect(await getLiveSessionUid()).toBe(1);
  });

  it('is null after the person signed out everywhere, though the cookie still verifies', async () => {
    insertUser(raw, { session_epoch: 3 });
    await signIn({ id: 1 }, { ep: 2 });
    expect(await getSessionUid()).toBe(1);
    expect(await getLiveSessionUid()).toBeNull();
  });

  it('is null for an account that is gone, and for no cookie', async () => {
    await signIn({ id: 4 });
    expect(await getLiveSessionUid()).toBeNull();
    jar.clear();
    expect(await getLiveSessionUid()).toBeNull();
  });
});

describe('getUserAccessToken', () => {
  /** Answer Google's token endpoint, counting how often it is asked. */
  function googleAnswers(
    ...answers: readonly (Response | Error)[]
  ): jest.SpiedFunction<typeof fetch> {
    const spy = jest.spyOn(globalThis, 'fetch');
    answers.forEach((answer) =>
      spy.mockImplementationOnce(async () => {
        if (answer instanceof Error) {
          throw answer;
        }
        return answer;
      }),
    );
    return spy;
  }

  const token = (value: string, expiresIn = 3599) =>
    new Response(
      JSON.stringify({ access_token: value, expires_in: expiresIn }),
    );

  /** A user row with a refresh token sealed under the test key. */
  async function connectedUser(id: number) {
    const sealed = await encryptSecret(
      'refresh-token',
      String(env['TOKEN_ENCRYPTION_KEY']),
    );
    insertUser(raw, { id, refresh_token_enc: sealed });
    const { getUserById } = await import('../../../src/lib/db/users');
    const { getDatabase } = await import('../../../src/lib/util');
    const user = await getUserById(getDatabase(), id);
    if (!user) {
      throw new Error('user not inserted');
    }
    return user;
  }

  it('says Drive is not connected when there is no stored login', async () => {
    insertUser(raw, { id: 20 });
    const { getUserById } = await import('../../../src/lib/db/users');
    const { getDatabase } = await import('../../../src/lib/util');
    const user = await getUserById(getDatabase(), 20);
    await expect(getUserAccessToken(user!)).rejects.toThrow(
      DriveNotConnectedError,
    );
  });

  it('trades the stored login for an access token once, then reuses it', async () => {
    const user = await connectedUser(30);
    const spy = googleAnswers(token('first'), token('second'));
    expect(await getUserAccessToken(user)).toBe('first');
    expect(await getUserAccessToken(user)).toBe('first');
    expect(spy).toHaveBeenCalledTimes(1);
    forgetAccessTokens(30);
  });

  it('sends the stored refresh token to Google', async () => {
    const user = await connectedUser(31);
    const spy = googleAnswers(token('t'));
    await getUserAccessToken(user);
    const body = new URLSearchParams(String(spy.mock.calls[0]?.[1]?.body));
    expect(body.get('refresh_token')).toBe('refresh-token');
    expect(body.get('grant_type')).toBe('refresh_token');
    forgetAccessTokens(31);
  });

  it('never hands one person the token minted for another', async () => {
    const first = await connectedUser(32);
    const second = await connectedUser(33);
    googleAnswers(token('for-32'), token('for-33'));
    expect(await getUserAccessToken(first)).toBe('for-32');
    expect(await getUserAccessToken(second)).toBe('for-33');
    forgetAccessTokens(32);
    forgetAccessTokens(33);
  });

  it('asks Google again after the cached token is forgotten', async () => {
    const user = await connectedUser(34);
    const spy = googleAnswers(token('one'), token('two'));
    await getUserAccessToken(user);
    forgetAccessTokens(34);
    expect(await getUserAccessToken(user)).toBe('two');
    expect(spy).toHaveBeenCalledTimes(2);
    forgetAccessTokens(34);
  });

  it('forgets a login Google has revoked and says Drive is not connected', async () => {
    const user = await connectedUser(35);
    googleAnswers(new Response('{"error":"invalid_grant"}', { status: 400 }));
    await expect(getUserAccessToken(user)).rejects.toThrow(
      DriveNotConnectedError,
    );
    expect(
      raw
        .prepare('SELECT refresh_token_enc AS t FROM users WHERE id = 35')
        .get(),
    ).toEqual({ t: null });
  });

  it('does not cache a failure', async () => {
    const user = await connectedUser(36);
    googleAnswers(new TypeError('fetch failed'), token('recovered'));
    await expect(getUserAccessToken(user)).rejects.toThrow('fetch failed');
    expect(await getUserAccessToken(user)).toBe('recovered');
    forgetAccessTokens(36);
  });
});
