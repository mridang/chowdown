import { describe, expect, it, jest } from '@jest/globals';

import {
  accessTokenFor,
  type AccessTokenDeps,
} from '../../../src/lib/auth/access-token';
import { DriveNotConnectedError } from '../../../src/lib/auth/drive-access';

function deps(overrides: Partial<AccessTokenDeps> = {}) {
  const forget = jest.fn<AccessTokenDeps['forget']>().mockResolvedValue();
  const all: AccessTokenDeps = {
    decrypt: async () => 'refresh-token',
    refresh: async () => 'access-token',
    forget,
    ...overrides,
  };
  return { all, forget };
}

describe('accessTokenFor', () => {
  it('trades a working login for an access token', async () => {
    const { all, forget } = deps();
    expect(await accessTokenFor('sealed', all)).toBe('access-token');
    expect(forget).not.toHaveBeenCalled();
  });

  it('says Drive is not connected when there is no stored login', async () => {
    const { all, forget } = deps();
    await expect(accessTokenFor(null, all)).rejects.toThrow(
      DriveNotConnectedError,
    );
    expect(forget).not.toHaveBeenCalled();
  });

  it('forgets a login Google has revoked, once, and says Drive is not connected', async () => {
    const { all, forget } = deps({
      refresh: async () => {
        throw new Error('Token refresh failed: 400 {"error":"invalid_grant"}');
      },
    });
    await expect(accessTokenFor('sealed', all)).rejects.toThrow(
      DriveNotConnectedError,
    );
    expect(forget).toHaveBeenCalledTimes(1);
    expect(forget).toHaveBeenCalledWith('sealed');
  });

  it('does not forget a login over our own misconfiguration', async () => {
    const { all, forget } = deps({
      refresh: async () => {
        throw new Error('Token refresh failed: 401 {"error":"invalid_client"}');
      },
    });
    await expect(accessTokenFor('sealed', all)).rejects.toThrow(
      'invalid_client',
    );
    expect(forget).not.toHaveBeenCalled();
  });

  it('rethrows a network failure without forgetting anything', async () => {
    const { all, forget } = deps({
      refresh: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(accessTokenFor('sealed', all)).rejects.toThrow('fetch failed');
    expect(forget).not.toHaveBeenCalled();
  });

  it('treats a login that cannot be unsealed as unusable, but never wipes it', async () => {
    // A wrong key (a bad deploy) must not destroy every stored login for good.
    const { all, forget } = deps({
      decrypt: async () => {
        throw new Error('OperationError');
      },
    });
    await expect(accessTokenFor('sealed', all)).rejects.toThrow(
      DriveNotConnectedError,
    );
    expect(forget).not.toHaveBeenCalled();
  });
});
