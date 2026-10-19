import { beforeEach, describe, expect, it } from '@jest/globals';

import { s256 } from '../../../src/lib/oauth/pkce';
import {
  formField,
  handleTokenRequest,
  type TokenRequestResult,
} from '../../../src/lib/oauth/token-request';
import { issueAuthorizationCode } from '../../../src/lib/oauth/token-endpoint';
import { MemoryStore } from './memory-store';

const ORIGIN = 'https://chowdown.example';
const RESOURCE = `${ORIGIN}/api/mcp`;
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const NOW = 1_000_000;

const form = (fields: Record<string, string>) =>
  Object.entries(fields).reduce((data, [key, value]) => {
    data.append(key, value);
    return data;
  }, new FormData());

let store: MemoryStore;

/** A code issued to client-1 for the user 7. */
async function newCode() {
  return issueAuthorizationCode(
    store,
    {
      clientId: 'client-1',
      userId: 7,
      redirectUri: 'https://app.example/cb',
      codeChallenge: await s256(VERIFIER),
      scope: ['recipes:read'],
      resource: RESOURCE,
    },
    NOW,
  );
}

/** What went wrong, for a refused request. */
function refusal(result: TokenRequestResult) {
  if (result.ok) {
    throw new Error('expected a refusal');
  }
  return result;
}

beforeEach(() => {
  store = new MemoryStore();
});

describe('formField', () => {
  it('reads a text field, and ignores empty or missing ones', () => {
    const data = form({ a: 'x', b: '' });
    expect(formField(data, 'a')).toBe('x');
    expect(formField(data, 'b')).toBeUndefined();
    expect(formField(data, 'c')).toBeUndefined();
  });

  it('ignores a file upload', () => {
    const data = new FormData();
    data.append('a', new Blob(['x']), 'a.txt');
    expect(formField(data, 'a')).toBeUndefined();
  });
});

describe('handleTokenRequest', () => {
  it('wants a client_id, answering 401', async () => {
    expect(
      refusal(await handleTokenRequest(form({}), store, ORIGIN, NOW)),
    ).toMatchObject({ error: 'invalid_client', status: 401 });
  });

  it('refuses a grant type it does not offer', async () => {
    expect(
      refusal(
        await handleTokenRequest(
          form({ client_id: 'c', grant_type: 'password' }),
          store,
          ORIGIN,
          NOW,
        ),
      ),
    ).toMatchObject({ error: 'unsupported_grant_type', status: 400 });
    expect(
      refusal(
        await handleTokenRequest(form({ client_id: 'c' }), store, ORIGIN, NOW),
      ).error,
    ).toBe('unsupported_grant_type');
  });

  it('wants a code for the authorization_code grant', async () => {
    expect(
      refusal(
        await handleTokenRequest(
          form({ client_id: 'c', grant_type: 'authorization_code' }),
          store,
          ORIGIN,
          NOW,
        ),
      ),
    ).toMatchObject({
      error: 'invalid_request',
      description: 'The request has no code.',
    });
  });

  it('wants a refresh_token for the refresh_token grant', async () => {
    expect(
      refusal(
        await handleTokenRequest(
          form({ client_id: 'c', grant_type: 'refresh_token' }),
          store,
          ORIGIN,
          NOW,
        ),
      ),
    ).toMatchObject({
      error: 'invalid_request',
      description: 'The request has no refresh_token.',
    });
  });

  it('trades a code and its verifier for tokens', async () => {
    const result = await handleTokenRequest(
      form({
        client_id: 'client-1',
        grant_type: 'authorization_code',
        code: await newCode(),
        redirect_uri: 'https://app.example/cb',
        code_verifier: VERIFIER,
        resource: RESOURCE,
      }),
      store,
      ORIGIN,
      NOW,
    );
    expect(result).toMatchObject({
      ok: true,
      tokens: { token_type: 'Bearer', scope: 'recipes:read' },
    });
  });

  it('passes on the reason a code is refused, as a 400', async () => {
    expect(
      refusal(
        await handleTokenRequest(
          form({
            client_id: 'client-1',
            grant_type: 'authorization_code',
            code: await newCode(),
            redirect_uri: 'https://app.example/cb',
            code_verifier: 'x'.repeat(43),
          }),
          store,
          ORIGIN,
          NOW,
        ),
      ),
    ).toMatchObject({ error: 'invalid_grant', status: 400 });
  });

  it("refuses a resource that is not this site's MCP server", async () => {
    expect(
      refusal(
        await handleTokenRequest(
          form({
            client_id: 'client-1',
            grant_type: 'authorization_code',
            code: await newCode(),
            redirect_uri: 'https://app.example/cb',
            code_verifier: VERIFIER,
            resource: 'https://elsewhere.example/api/mcp',
          }),
          store,
          ORIGIN,
          NOW,
        ),
      ).error,
    ).toBe('invalid_target');
  });

  it('rotates a refresh token', async () => {
    const first = await handleTokenRequest(
      form({
        client_id: 'client-1',
        grant_type: 'authorization_code',
        code: await newCode(),
        redirect_uri: 'https://app.example/cb',
        code_verifier: VERIFIER,
      }),
      store,
      ORIGIN,
      NOW,
    );
    if (!first.ok) {
      throw new Error('expected tokens');
    }
    const second = await handleTokenRequest(
      form({
        client_id: 'client-1',
        grant_type: 'refresh_token',
        refresh_token: first.tokens.refresh_token,
      }),
      store,
      ORIGIN,
      NOW + 5,
    );
    expect(second).toMatchObject({ ok: true });
    expect(second.ok && second.tokens.refresh_token).not.toBe(
      first.tokens.refresh_token,
    );
  });
});
