/**
 * @packageDocumentation
 *
 * A small in-memory cache of Google access tokens. An access token lasts about
 * an hour and costs a round trip to Google (plus decrypting the stored refresh
 * token) to mint, yet every request that touches Drive used to mint a fresh
 * one. Keeping the token for most of its life turns that into one call an hour
 * per person per server instance.
 *
 * This is the one deliberately stateful corner of the auth code: the cache
 * lives in the memory of the running Worker instance and is simply empty after
 * a restart or on another instance, which costs one extra mint and nothing
 * else. Entries are keyed by the person AND the sealed refresh token they were
 * minted from, so a token can never be handed to someone else, and a person who
 * reconnects Drive (new refresh token) stops using the old entry at once.
 */

/** The longest an access token is kept, whatever Google says (55 minutes). */
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 55 * 60;

/** How long before Google's stated expiry a token stops being reused (5 minutes). */
export const ACCESS_TOKEN_SAFETY_SECONDS = 5 * 60;

/** How many people's tokens one instance remembers before the oldest is dropped. */
const MAX_ENTRIES = 200;

/** A freshly minted access token and how long Google says it lives. */
export interface MintedToken {
  readonly access_token: string;
  readonly expires_in: number;
}

/** A token with the moment (epoch ms) after which it must not be reused. */
interface Entry {
  readonly token: string;
  readonly reusableUntil: number;
}

/** A cache of access tokens. */
export interface AccessTokenCache {
  /**
   * The cached token for `key` while it is still fresh, otherwise a newly
   * minted one (which is then cached). Callers that ask while a mint is in
   * flight share it instead of each asking Google. A failed mint is never
   * cached: the next caller tries again.
   */
  readonly resolve: (
    key: string,
    mint: () => Promise<MintedToken>,
  ) => Promise<string>;
  /** Forget every token held for a person. */
  readonly forgetUser: (userId: number) => void;
}

/** The cache key for a person's login: who, and which stored refresh token. */
export function accessTokenKey(userId: number, sealed: string): string {
  return `${userId}:${sealed}`;
}

/**
 * Make a cache. `now` is the clock in epoch milliseconds (replaceable so a
 * test can move time); `maxEntries` bounds the memory used.
 */
export function createAccessTokenCache(
  options: Readonly<{ now?: () => number; maxEntries?: number }> = {},
): AccessTokenCache {
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  const entries = new Map<string, Promise<Entry>>();

  /** Mint a token and work out how long it may be reused. */
  const mintEntry = async (
    mint: () => Promise<MintedToken>,
  ): Promise<Entry> => {
    const minted = await mint();
    const reuseSeconds = Math.min(
      ACCESS_TOKEN_MAX_AGE_SECONDS,
      minted.expires_in - ACCESS_TOKEN_SAFETY_SECONDS,
    );
    return {
      token: minted.access_token,
      reusableUntil: now() + reuseSeconds * 1000,
    };
  };

  /** Keep `pending` under `key`, dropping the oldest entries past the bound. */
  const remember = (key: string, pending: Promise<Entry>): void => {
    entries.delete(key);
    entries.set(key, pending);
    [...entries.keys()]
      .slice(0, Math.max(0, entries.size - maxEntries))
      .forEach((oldest) => entries.delete(oldest));
  };

  /** Mint a token, remember the attempt under `key`, and answer with the token. */
  const mintAndRemember = async (
    key: string,
    mint: () => Promise<MintedToken>,
  ): Promise<string> => {
    const pending = mintEntry(mint);
    remember(key, pending);
    try {
      return (await pending).token;
    } catch (error) {
      // Only forget our own failed attempt, not a newer one that replaced it.
      if (entries.get(key) === pending) {
        entries.delete(key);
      }
      throw error;
    }
  };

  return {
    resolve: async (key, mint) => {
      const existing = entries.get(key);
      if (existing) {
        const cached = await existing.catch(() => undefined);
        if (cached && cached.reusableUntil > now()) {
          return cached.token;
        }
      }
      // With nothing cached there has been no await yet, so the attempt is
      // registered before any other caller can look: callers arriving while it
      // is in flight find it above and share it.
      return mintAndRemember(key, mint);
    },
    forgetUser: (userId) => {
      const prefix = `${userId}:`;
      [...entries.keys()]
        .filter((key) => key.startsWith(prefix))
        .forEach((key) => entries.delete(key));
    },
  };
}
