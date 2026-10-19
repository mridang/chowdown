import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { revokeDriveLogin } from '../../../src/lib/auth/drive-login';
import { encryptSecret } from '../../../src/lib/crypto';
import type { User } from '../../../src/lib/db/users';
import { installCloudflareContext, sqliteD1 } from '../db/sqlite-d1';
import { testEnv } from './session-fixture';

let restore: () => void;
let env: Record<string, unknown>;

beforeEach(() => {
  env = testEnv();
  restore = installCloudflareContext(sqliteD1('0001_init.sql').d1, env);
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

const userWith = (sealed: string | null) =>
  ({ id: 1, refresh_token_enc: sealed }) as unknown as User;

describe('revokeDriveLogin', () => {
  it('gives the unsealed refresh token back to Google', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    const sealed = await encryptSecret(
      'the-refresh-token',
      String(env['TOKEN_ENCRYPTION_KEY']),
    );
    await revokeDriveLogin(userWith(sealed));
    expect(String(spy.mock.calls[0]?.[0])).toBe(
      'https://oauth2.googleapis.com/revoke',
    );
    expect(
      new URLSearchParams(String(spy.mock.calls[0]?.[1]?.body)).get('token'),
    ).toBe('the-refresh-token');
  });

  it('does nothing for someone who never connected Drive', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    await revokeDriveLogin(userWith(null));
    expect(spy).not.toHaveBeenCalled();
  });

  it('swallows a refusal from Google, since the account is already deleted', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 400 }));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const sealed = await encryptSecret(
      't',
      String(env['TOKEN_ENCRYPTION_KEY']),
    );
    await expect(revokeDriveLogin(userWith(sealed))).resolves.toBeUndefined();
  });

  it('swallows a login that cannot be unsealed, and does not call Google', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      revokeDriveLogin(userWith('not-a-sealed-value')),
    ).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
