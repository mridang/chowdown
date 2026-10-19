import { beforeEach, describe, expect, it } from '@jest/globals';

import { s256 } from '../../../src/lib/oauth/pkce';
import {
  formField,
  handleTokenRequest,
  type TokenRequestResult,
} from '../../../src/lib/oauth/token-request';
import { issueAuthorizationCode } from '../../../src/lib/oauth/token-endpoint';
import { MemoryStore } from './memory-store';
import { quietSecurityLogs } from './quiet-logs';

const ORIGIN = 'https://chowdown.example';
const RESOURCE = `${ORIGIN}/api/mcp`;
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const NOW = 1_000_000;

const form = (fields: Record<string, string>) =>
  Object.entries(fields).reduce((data, [key, value]) => {
    data.append(key, value);
    return data;
  }, new FormData());

quietSecurityLogs();

let store: MemoryStore;

/** A code issued to client-1 for the user 7. */
async function newCode() {
  return issueAuthorizationCode(
    store,
    {
      clientId: 'client-1',
      userId: 7,
      redirectUri: 'https://app.example/cb',
      redirectUriSent: true,
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
  it('wants a client_id: a request without one is malformed (400), not unauthenticated', async () => {
    const result = refusal(
      await handleTokenRequest(form({}), store, ORIGIN, NOW),
    );
    expect(result).toMatchObject({
      error: 'invalid_request',
      description: 'The request has no client_id.',
      status: 400,
    });
    expect(result).not.toHaveProperty('wwwAuthenticate');
  });

  it('answers 401 with a challenge when the client tried to authenticate with a Basic header instead of client_id', async () => {
    expect(
      refusal(
        await handleTokenRequest(form({}), store, ORIGIN, NOW, {
          basicAuthAttempted: true,
        }),
      ),
    ).toMatchObject({
      error: 'invalid_client',
      status: 401,
      wwwAuthenticate: expect.stringMatching(/^Basic realm="chowdown"/),
    });
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
  });

  it('calls a missing grant_type an invalid request, as RFC 6749 5.2 does for any missing parameter', async () => {
    expect(
      refusal(
        await handleTokenRequest(form({ client_id: 'c' }), store, ORIGIN, NOW),
      ),
    ).toMatchObject({
      error: 'invalid_request',
      description: 'The request has no grant_type.',
      status: 400,
    });
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

  it('checks a resource sent with a refresh too (RFC 8707)', async () => {
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
    const refresh = (resource: string) =>
      handleTokenRequest(
        form({
          client_id: 'client-1',
          grant_type: 'refresh_token',
          refresh_token: first.tokens.refresh_token,
          resource,
        }),
        store,
        ORIGIN,
        NOW + 5,
      );
    expect(
      refusal(await refresh('https://elsewhere.example/api/mcp')).error,
    ).toBe('invalid_target');
    expect(await refresh(RESOURCE)).toMatchObject({ ok: true });
  });
});

describe('error_description is printable ASCII without quotes or backslashes (RFC 6749 5.2)', () => {
  it.each<Record<string, string>>([
    {},
    { client_id: 'c' },
    { client_id: 'c', grant_type: 'password' },
    { client_id: 'c', grant_type: 'authorization_code' },
    { client_id: 'c', grant_type: 'refresh_token' },
    { client_id: 'c', grant_type: 'authorization_code', code: 'nope' },
    { client_id: 'c', grant_type: 'refresh_token', refresh_token: 'nope' },
  ])('for %j', async (fields) => {
    const result = refusal(
      await handleTokenRequest(form(fields), store, ORIGIN, NOW),
    );
    expect(result.description).toMatch(/^[\x20\x21\x23-\x5b\x5d-\x7e]+$/);
  });
});
