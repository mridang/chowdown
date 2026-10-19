import { describe, expect, it, jest } from '@jest/globals';

import type { User } from '../../../src/lib/db/users';
import {
  authenticateMcpRequest,
  type McpAuthDeps,
} from '../../../src/lib/mcp/auth';

const ORIGIN = 'https://chowdown.test';
const user = { id: 7 } as User;

const withToken = (token?: string) =>
  new Request(`${ORIGIN}/api/mcp`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

/** Fake collaborators that know one good token. */
function deps(overrides: Partial<McpAuthDeps> = {}): McpAuthDeps {
  return {
    identify: async (token) =>
      token === 'good'
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
      await authenticateMcpRequest(withToken('good'), ORIGIN, () => deps()),
    ).toEqual({ kind: 'ok', user, scope: ['recipes:read'] });
  });

  it('asks about the MCP server of this origin, at the current time', async () => {
    const identify = jest.fn(deps().identify);
    await authenticateMcpRequest(withToken('good'), ORIGIN, () =>
      deps({ identify }),
    );
    expect(identify).toHaveBeenCalledWith(
      'good',
      'https://chowdown.test/api/mcp',
      1000,
    );
  });

  it('treats an unknown token as invalid', async () => {
    expect(
      await authenticateMcpRequest(withToken('bad'), ORIGIN, () => deps()),
    ).toEqual({ kind: 'invalid-token' });
  });

  it('treats a token whose user has gone as invalid', async () => {
    expect(
      await authenticateMcpRequest(withToken('good'), ORIGIN, () =>
        deps({ findUser: async () => undefined }),
      ),
    ).toEqual({ kind: 'invalid-token' });
  });
});
