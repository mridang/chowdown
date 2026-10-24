import { describe, expect, it, jest } from '@jest/globals';

import type { User } from '@/lib/db/users';
import { ACCESS_PREFIX, REFRESH_PREFIX, newSecret } from '@/lib/oauth/secrets';
import { authenticateMcpRequest, type McpAuthDeps } from '@/lib/mcp/auth';

const ORIGIN = 'https://chowdown.test';
const user = { id: 7 } as User;
/** A token shaped like the ones we issue, so it gets as far as the database. */
const GOOD = newSecret(ACCESS_PREFIX);
const BAD = newSecret(ACCESS_PREFIX);

const withToken = (token?: string) =>
  new Request(`${ORIGIN}/mcp`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

/** Fake collaborators that know one good token. */
function deps(overrides: Partial<McpAuthDeps> = {}): McpAuthDeps {
  return {
    identify: async (token) =>
      token === GOOD
        ? { userId: 7, scope: ['recipes:read'], grantId: 'g' }
        : undefined,
    findUser: async (id) => (id === 7 ? user : undefined),
    now: () => 1000,
    ...overrides,
  };
}

describe('authenticateMcpRequest', () => {
  it('does not even open the database when no token was sent', async () => {
    const open = jest.fn(() => deps());
    expect(await authenticateMcpRequest(withToken(), ORIGIN, open)).toEqual({
      kind: 'no-token',
    });
    expect(open).not.toHaveBeenCalled();
  });

  it('gives back the user and the scopes they approved for a good token', async () => {
    expect(
      await authenticateMcpRequest(withToken(GOOD), ORIGIN, () => deps()),
    ).toEqual({ kind: 'ok', user, scope: ['recipes:read'] });
  });

  it('asks about the MCP server of this origin, at the current time', async () => {
    const identify = jest.fn(deps().identify);
    await authenticateMcpRequest(withToken(GOOD), ORIGIN, () =>
      deps({ identify }),
    );
    expect(identify).toHaveBeenCalledWith(
      GOOD,
      'https://chowdown.test/mcp',
      1000,
    );
  });

  it('treats an unknown token as invalid', async () => {
    expect(
      await authenticateMcpRequest(withToken(BAD), ORIGIN, () => deps()),
    ).toEqual({ kind: 'invalid-token' });
  });

  it('treats a token whose user has gone as invalid', async () => {
    expect(
      await authenticateMcpRequest(withToken(GOOD), ORIGIN, () =>
        deps({ findUser: async () => undefined }),
      ),
    ).toEqual({ kind: 'invalid-token' });
  });

  it.each([
    ['a short made-up string', 'abc'],
    ['a refresh token', newSecret(REFRESH_PREFIX)],
    ['a token with the right prefix and too little after it', 'cdn_at_short'],
    ['a token with characters no secret of ours contains', `${GOOD}!!`],
    ['a token that is absurdly long', `cdn_at_${'a'.repeat(5000)}`],
  ])(
    'turns away %s as invalid without touching the database',
    async (_name, token) => {
      const open = jest.fn(() => deps());
      expect(
        await authenticateMcpRequest(withToken(token), ORIGIN, open),
      ).toEqual({ kind: 'invalid-token' });
      expect(open).not.toHaveBeenCalled();
    },
  );

  it('accepts the shape of every access token we issue', () => {
    expect(GOOD).toMatch(/^cdn_at_[A-Za-z0-9_-]{43}$/);
  });
});
