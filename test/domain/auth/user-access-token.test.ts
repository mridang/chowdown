import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import { encryptSecret } from '@/lib/crypto';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';
import { insertUser, testEnv } from '../../lib/auth/session-fixture';

const { forgetAccessTokens, getUserAccessToken } =
  await import('@/domain/auth/user-access-token');

let raw: DatabaseSync;
let restore: () => void;
let env: Record<string, unknown>;

beforeEach(() => {
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  env = testEnv();
  restore = installCloudflareContext(made.d1, env);
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
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
    const { getUserById } = await import('@/domain/db/users');
    const { getDatabase } = await import('@/domain/db/client');
    const user = await getUserById(getDatabase(), id);
    if (!user) {
      throw new Error('user not inserted');
    }
    return user;
  }

  it('says Drive is not connected when there is no stored login', async () => {
    insertUser(raw, { id: 20 });
    const { getUserById } = await import('@/domain/db/users');
    const { getDatabase } = await import('@/domain/db/client');
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
