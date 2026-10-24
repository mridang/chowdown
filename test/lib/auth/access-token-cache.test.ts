import { describe, expect, it, jest } from '@jest/globals';

import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  accessTokenKey,
  createAccessTokenCache,
  type MintedToken,
} from '@/domain/auth/access-token-cache';

/** A clock the test can move, in epoch milliseconds. */
function clock(start = 1_000_000) {
  const state = { now: start };
  return {
    now: () => state.now,
    advanceSeconds: (seconds: number) => {
      state.now += seconds * 1000;
    },
  };
}

/** A mint that hands out `t1`, `t2`, … each valid for `expiresIn` seconds. */
function minter(expiresIn = 3599) {
  const counter = { n: 0 };
  return jest.fn(
    async (): Promise<MintedToken> => ({
      access_token: `t${++counter.n}`,
      expires_in: expiresIn,
    }),
  );
}

describe('accessTokenKey', () => {
  it('tells apart people and the logins they hold', () => {
    expect(accessTokenKey(1, 'a')).not.toBe(accessTokenKey(2, 'a'));
    expect(accessTokenKey(1, 'a')).not.toBe(accessTokenKey(1, 'b'));
  });
});

describe('createAccessTokenCache', () => {
  it('mints once and reuses the token while it is fresh', async () => {
    const time = clock();
    const cache = createAccessTokenCache({ now: time.now });
    const mint = minter();
    expect(await cache.resolve('k', mint)).toBe('t1');
    time.advanceSeconds(600);
    expect(await cache.resolve('k', mint)).toBe('t1');
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('mints again once the reuse window has passed', async () => {
    const time = clock();
    const cache = createAccessTokenCache({ now: time.now });
    const mint = minter();
    await cache.resolve('k', mint);
    time.advanceSeconds(ACCESS_TOKEN_MAX_AGE_SECONDS + 1);
    expect(await cache.resolve('k', mint)).toBe('t2');
  });

  it('stops reusing a token five minutes before Google says it expires', async () => {
    const time = clock();
    const cache = createAccessTokenCache({ now: time.now });
    const mint = minter(600);
    await cache.resolve('k', mint);
    time.advanceSeconds(299);
    expect(await cache.resolve('k', mint)).toBe('t1');
    time.advanceSeconds(2);
    expect(await cache.resolve('k', mint)).toBe('t2');
  });

  it('never gives one key the token minted for another', async () => {
    const cache = createAccessTokenCache();
    const mint = minter();
    expect(await cache.resolve(accessTokenKey(1, 's'), mint)).toBe('t1');
    expect(await cache.resolve(accessTokenKey(2, 's'), mint)).toBe('t2');
    expect(await cache.resolve(accessTokenKey(1, 's2'), mint)).toBe('t3');
  });

  it('shares one mint between callers that ask while it is in flight', async () => {
    const cache = createAccessTokenCache();
    const mint = minter();
    const tokens = await Promise.all([
      cache.resolve('k', mint),
      cache.resolve('k', mint),
      cache.resolve('k', mint),
    ]);
    expect(tokens).toEqual(['t1', 't1', 't1']);
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed mint', async () => {
    const cache = createAccessTokenCache();
    const mint = jest
      .fn<() => Promise<MintedToken>>()
      .mockRejectedValueOnce(new Error('google down'))
      .mockResolvedValueOnce({ access_token: 'ok', expires_in: 3599 });
    await expect(cache.resolve('k', mint)).rejects.toThrow('google down');
    expect(await cache.resolve('k', mint)).toBe('ok');
  });

  it('forgets every token of one person and leaves the others', async () => {
    const cache = createAccessTokenCache();
    const mint = minter();
    await cache.resolve(accessTokenKey(1, 'a'), mint);
    await cache.resolve(accessTokenKey(10, 'a'), mint);
    cache.forgetUser(1);
    expect(await cache.resolve(accessTokenKey(1, 'a'), mint)).toBe('t3');
    // 10 starts with "1" but is another person.
    expect(await cache.resolve(accessTokenKey(10, 'a'), mint)).toBe('t2');
  });

  it('drops the oldest entry when it holds more than its bound', async () => {
    const cache = createAccessTokenCache({ maxEntries: 2 });
    const mint = minter();
    await cache.resolve('a', mint);
    await cache.resolve('b', mint);
    await cache.resolve('c', mint);
    expect(mint).toHaveBeenCalledTimes(3);
    await cache.resolve('b', mint);
    await cache.resolve('c', mint);
    expect(mint).toHaveBeenCalledTimes(3);
    await cache.resolve('a', mint);
    expect(mint).toHaveBeenCalledTimes(4);
  });
});
