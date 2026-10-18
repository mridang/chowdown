import { beforeEach, describe, expect, it } from '@jest/globals';

import { s256 } from '../../../src/lib/oauth/pkce';
import { hashSecret } from '../../../src/lib/oauth/secrets';
import {
  ACCESS_TTL_SECONDS,
  CODE_TTL_SECONDS,
  authenticateAccessToken,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  issueAuthorizationCode,
  revokeToken,
  type CodeRecord,
  type GrantRecord,
  type OAuthFailure,
  type OAuthStore,
  type TokenRecord,
  type TokenResponse,
} from '../../../src/lib/oauth/token-endpoint';

const RESOURCE = 'https://chowdown.example/api/mcp';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const NOW = 1_000_000;

/** An in-memory store with the same atomic-claim behaviour as D1. */
class MemoryStore implements OAuthStore {
  codes = new Map<string, CodeRecord>();
  grants = new Map<string, GrantRecord>();
  tokens = new Map<
    string,
    {
      kind: 'access' | 'refresh';
      grantId: string;
      expiresAt: number;
      usedAt: number | null;
    }
  >();
  touched: string[] = [];

  async saveCode(hash: string, code: CodeRecord) {
    this.codes.set(hash, code);
  }
  async findCode(hash: string) {
    return this.codes.get(hash);
  }
  async claimCode(hash: string, grantId: string) {
    const code = this.codes.get(hash);
    if (!code || code.grantId) {
      return false;
    }
    code.grantId = grantId;
    return true;
  }
  async createGrant(grant: Omit<GrantRecord, 'revoked' | 'lastUsedAt'>) {
    this.grants.set(grant.id, { ...grant, revoked: false, lastUsedAt: null });
  }
  async revokeGrant(grantId: string) {
    const grant = this.grants.get(grantId);
    if (grant) {
      grant.revoked = true;
    }
  }
  async saveTokens(
    tokens: {
      hash: string;
      kind: 'access' | 'refresh';
      grantId: string;
      expiresAt: number;
    }[],
  ) {
    for (const t of tokens) {
      this.tokens.set(t.hash, { ...t, usedAt: null });
    }
  }
  async findToken(hash: string): Promise<TokenRecord | undefined> {
    const token = this.tokens.get(hash);
    const grant = token && this.grants.get(token.grantId);
    return token && grant ? { ...token, grant } : undefined;
  }
  async markTokenUsed(hash: string, now: number) {
    const token = this.tokens.get(hash);
    if (!token || token.usedAt !== null) {
      return false;
    }
    token.usedAt = now;
    return true;
  }
  async touchGrant(grantId: string, now: number) {
    this.touched.push(grantId);
    const grant = this.grants.get(grantId);
    if (grant) {
      grant.lastUsedAt = now;
    }
  }
}

const isFailure = (r: TokenResponse | OAuthFailure): r is OAuthFailure =>
  'ok' in r;
const isOurs = (r: string) => r === RESOURCE;

let store: MemoryStore;
let code: string;

async function newCode(overrides: Partial<CodeRecord> = {}) {
  return issueAuthorizationCode(
    store,
    {
      clientId: 'client-1',
      userId: 7,
      redirectUri: 'https://app.example/cb',
      codeChallenge: await s256(VERIFIER),
      scope: ['recipes:read', 'recipes:write'],
      resource: RESOURCE,
      ...overrides,
    },
    NOW,
  );
}

const redeem = (
  c: string,
  overrides: Record<string, string | undefined> = {},
) =>
  exchangeAuthorizationCode(
    store,
    {
      code: c,
      clientId: 'client-1',
      redirectUri: 'https://app.example/cb',
      codeVerifier: VERIFIER,
      resource: undefined,
      ...overrides,
    },
    isOurs,
    NOW + 5,
  );

beforeEach(async () => {
  store = new MemoryStore();
  code = await newCode();
});

describe('issueAuthorizationCode', () => {
  it('stores only a hash of the code, expiring in ten minutes', async () => {
    expect(store.codes.has(code)).toBe(false);
    const record = store.codes.get(await hashSecret(code));
    expect(record?.expiresAt).toBe(NOW + CODE_TTL_SECONDS);
    expect(record?.grantId).toBeNull();
  });
});

describe('exchangeAuthorizationCode', () => {
  it('issues tokens for a valid code and PKCE verifier', async () => {
    const result = await redeem(code);
    expect(isFailure(result)).toBe(false);
    const tokens = result as TokenResponse;
    expect(tokens).toMatchObject({
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SECONDS,
      scope: 'recipes:read recipes:write',
    });
    expect(tokens.access_token).toMatch(/^cdn_at_/);
    expect(tokens.refresh_token).toMatch(/^cdn_rt_/);
  });

  it('never stores the tokens themselves, only hashes', async () => {
    const tokens = (await redeem(code)) as TokenResponse;
    expect(store.tokens.has(tokens.access_token)).toBe(false);
    expect(store.tokens.has(await hashSecret(tokens.access_token))).toBe(true);
  });

  it('rejects an unknown code', async () => {
    expect(await redeem('cdn_code_bogus')).toMatchObject({
      ok: false,
      error: 'invalid_grant',
    });
  });

  it('rejects an expired code', async () => {
    const late = await exchangeAuthorizationCode(
      store,
      {
        code,
        clientId: 'client-1',
        redirectUri: 'https://app.example/cb',
        codeVerifier: VERIFIER,
        resource: undefined,
      },
      isOurs,
      NOW + CODE_TTL_SECONDS + 1,
    );
    expect(late).toMatchObject({ ok: false, error: 'invalid_grant' });
  });

  it('rejects the wrong PKCE verifier or none', async () => {
    expect(
      await redeem(code, { codeVerifier: `${VERIFIER.slice(1)}x` }),
    ).toMatchObject({ ok: false, error: 'invalid_grant' });
    expect(await redeem(code, { codeVerifier: undefined })).toMatchObject({
      ok: false,
      error: 'invalid_grant',
    });
  });

  it('rejects a different client or redirect URI', async () => {
    expect(await redeem(code, { clientId: 'client-2' })).toMatchObject({
      ok: false,
      error: 'invalid_grant',
    });
    expect(
      await redeem(code, { redirectUri: 'https://evil.example/cb' }),
    ).toMatchObject({ ok: false, error: 'invalid_grant' });
    expect(await redeem(code, { redirectUri: undefined })).toMatchObject({
      ok: false,
      error: 'invalid_grant',
    });
  });

  it('rejects a resource that is not this server', async () => {
    expect(
      await redeem(code, { resource: 'https://other.example/api/mcp' }),
    ).toMatchObject({ ok: false, error: 'invalid_target' });
    expect(isFailure(await redeem(code, { resource: RESOURCE }))).toBe(false);
  });

  it('works only once, and a replay revokes what the first use created', async () => {
    const first = (await redeem(code)) as TokenResponse;
    expect(await redeem(code)).toMatchObject({
      ok: false,
      error: 'invalid_grant',
    });
    expect(
      await authenticateAccessToken(
        store,
        first.access_token,
        RESOURCE,
        NOW + 10,
      ),
    ).toBeUndefined();
  });
});

describe('authenticateAccessToken', () => {
  it('identifies the user and scopes behind a valid token', async () => {
    const tokens = (await redeem(code)) as TokenResponse;
    expect(
      await authenticateAccessToken(
        store,
        tokens.access_token,
        RESOURCE,
        NOW + 10,
      ),
    ).toMatchObject({ userId: 7, scope: ['recipes:read', 'recipes:write'] });
  });

  it('rejects unknown tokens, refresh tokens and tokens for another resource', async () => {
    const tokens = (await redeem(code)) as TokenResponse;
    expect(
      await authenticateAccessToken(store, 'cdn_at_bogus', RESOURCE, NOW + 10),
    ).toBeUndefined();
    expect(
      await authenticateAccessToken(
        store,
        tokens.refresh_token,
        RESOURCE,
        NOW + 10,
      ),
    ).toBeUndefined();
    expect(
      await authenticateAccessToken(
        store,
        tokens.access_token,
        'https://other.example/api/mcp',
        NOW + 10,
      ),
    ).toBeUndefined();
  });

  it('rejects an expired token', async () => {
    const tokens = (await redeem(code)) as TokenResponse;
    expect(
      await authenticateAccessToken(
        store,
        tokens.access_token,
        RESOURCE,
        NOW + 5 + ACCESS_TTL_SECONDS + 1,
      ),
    ).toBeUndefined();
  });

  it('stops working once the grant is revoked', async () => {
    const tokens = (await redeem(code)) as TokenResponse;
    await revokeToken(store, tokens.refresh_token);
    expect(
      await authenticateAccessToken(
        store,
        tokens.access_token,
        RESOURCE,
        NOW + 10,
      ),
    ).toBeUndefined();
  });

  it('records use at most every few minutes', async () => {
    const tokens = (await redeem(code)) as TokenResponse;
    await authenticateAccessToken(
      store,
      tokens.access_token,
      RESOURCE,
      NOW + 10,
    );
    await authenticateAccessToken(
      store,
      tokens.access_token,
      RESOURCE,
      NOW + 20,
    );
    expect(store.touched).toHaveLength(1);
    await authenticateAccessToken(
      store,
      tokens.access_token,
      RESOURCE,
      NOW + 1000,
    );
    expect(store.touched).toHaveLength(2);
  });
});

describe('exchangeRefreshToken', () => {
  const refresh = (
    token: string,
    overrides: Record<string, string | undefined> = {},
  ) =>
    exchangeRefreshToken(
      store,
      {
        refreshToken: token,
        clientId: 'client-1',
        scope: undefined,
        ...overrides,
      },
      NOW + 100,
    );

  it('rotates: a new pair is issued and the old refresh token is spent', async () => {
    const first = (await redeem(code)) as TokenResponse;
    const second = (await refresh(first.refresh_token)) as TokenResponse;
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(
      await authenticateAccessToken(
        store,
        second.access_token,
        RESOURCE,
        NOW + 110,
      ),
    ).toMatchObject({ userId: 7 });
  });

  it('treats reuse of a spent refresh token as theft and revokes the grant', async () => {
    const first = (await redeem(code)) as TokenResponse;
    const second = (await refresh(first.refresh_token)) as TokenResponse;
    expect(await refresh(first.refresh_token)).toMatchObject({
      ok: false,
      error: 'invalid_grant',
    });
    expect(
      await authenticateAccessToken(
        store,
        second.access_token,
        RESOURCE,
        NOW + 110,
      ),
    ).toBeUndefined();
    expect(await refresh(second.refresh_token)).toMatchObject({
      ok: false,
      error: 'invalid_grant',
    });
  });

  it('rejects an access token, an unknown token and another client', async () => {
    const first = (await redeem(code)) as TokenResponse;
    expect(await refresh(first.access_token)).toMatchObject({ ok: false });
    expect(await refresh('cdn_rt_bogus')).toMatchObject({ ok: false });
    expect(
      await refresh(first.refresh_token, { clientId: 'client-2' }),
    ).toMatchObject({ ok: false, error: 'invalid_grant' });
  });

  it('rejects an expired refresh token', async () => {
    const first = (await redeem(code)) as TokenResponse;
    const result = await exchangeRefreshToken(
      store,
      {
        refreshToken: first.refresh_token,
        clientId: 'client-1',
        scope: undefined,
      },
      NOW + 60 * 60 * 24 * 31,
    );
    expect(result).toMatchObject({ ok: false, error: 'invalid_grant' });
  });

  it('never widens the scope', async () => {
    const readOnly = await newCode({ scope: ['recipes:read'] });
    const first = (await redeem(readOnly)) as TokenResponse;
    expect(
      await refresh(first.refresh_token, {
        scope: 'recipes:read recipes:write',
      }),
    ).toMatchObject({ ok: false, error: 'invalid_scope' });
  });

  it('reports the whole grant, since tokens are not narrowed one by one', async () => {
    const code = await newCode({ scope: ['recipes:read', 'recipes:write'] });
    const first = (await redeem(code)) as TokenResponse;
    const second = (await refresh(first.refresh_token, {
      scope: 'recipes:read',
    })) as TokenResponse;
    expect(second.scope).toBe('recipes:read recipes:write');
  });
});

describe('revokeToken', () => {
  it('ignores an unknown token', async () => {
    await expect(revokeToken(store, 'cdn_at_unknown')).resolves.toBeUndefined();
  });
});
