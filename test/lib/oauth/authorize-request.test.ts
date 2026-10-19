import { describe, expect, it } from '@jest/globals';

import {
  AUTHORIZE_FIELDS,
  authorizeParamsFrom,
  redirectWith,
  validateAuthorizeRequest,
  type AuthorizeParams,
} from '../../../src/lib/oauth/authorize-request';
import type { OAuthClient } from '../../../src/lib/oauth/client';

const ORIGIN = 'https://chowdown.example';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const client: OAuthClient = {
  clientId: 'dcr_abc',
  name: 'Claude',
  redirectUris: ['https://claude.ai/cb'],
  kind: 'dcr',
};
const resolve = async (id: string) =>
  id === client.clientId ? client : undefined;

const good: AuthorizeParams = {
  client_id: 'dcr_abc',
  redirect_uri: 'https://claude.ai/cb',
  response_type: 'code',
  code_challenge: CHALLENGE,
  code_challenge_method: 'S256',
  state: 'xyz',
};

const check = (overrides: AuthorizeParams = {}) =>
  validateAuthorizeRequest({ ...good, ...overrides }, ORIGIN, resolve);

describe('validateAuthorizeRequest', () => {
  it('accepts a good request and binds it to this MCP server', async () => {
    const result = await check();
    expect(result).toMatchObject({
      ok: true,
      request: {
        redirectUri: 'https://claude.ai/cb',
        state: 'xyz',
        resource: `${ORIGIN}/api/mcp`,
        scope: ['recipes:read', 'recipes:write'],
      },
    });
  });

  it('shows an error, without redirecting, for an unknown client', async () => {
    const result = await check({ client_id: 'nobody' });
    expect(result).toMatchObject({ ok: false, error: 'invalid_client' });
    expect(result.ok === false && result.redirect).toBeFalsy();
  });

  it('shows an error, without redirecting, for a redirect URI the client never registered', async () => {
    const result = await check({ redirect_uri: 'https://evil.example/cb' });
    expect(result).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(result.ok === false && result.redirect).toBeFalsy();
  });

  it('shows an error, without redirecting, for a redirect URI the rules no longer allow', async () => {
    const old: OAuthClient = {
      ...client,
      clientId: 'dcr_old',
      redirectUris: ['http://example.com/cb', 'myapp://cb'],
    };
    for (const uri of old.redirectUris) {
      const result = await validateAuthorizeRequest(
        { ...good, client_id: 'dcr_old', redirect_uri: uri },
        ORIGIN,
        async () => old,
      );
      expect(result).toMatchObject({ ok: false, error: 'invalid_request' });
      expect(result.ok === false && result.redirect).toBeFalsy();
    }
  });

  it('accepts a loopback redirect on any port for a registered loopback address', async () => {
    const local: OAuthClient = {
      ...client,
      redirectUris: ['http://localhost:6274/oauth/callback'],
    };
    const result = await validateAuthorizeRequest(
      { ...good, redirect_uri: 'http://localhost:51234/oauth/callback' },
      ORIGIN,
      async () => local,
    );
    expect(result.ok).toBe(true);
  });

  it('asks the caller to wait, without redirecting, when the client lookup is rate limited', async () => {
    const result = await validateAuthorizeRequest(good, ORIGIN, async () => ({
      busy: true,
      retryAfterSeconds: 17,
    }));
    expect(result).toMatchObject({
      ok: false,
      error: 'temporarily_unavailable',
      retryAfterSeconds: 17,
    });
    expect(result.ok === false && result.redirect).toBeFalsy();
  });

  it('shows an error when there is no client_id', async () => {
    const result = await check({ client_id: undefined });
    expect(result).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(result.ok === false && result.redirect).toBeFalsy();
  });

  it('uses the only registered redirect URI when none is sent', async () => {
    const result = await check({ redirect_uri: undefined });
    expect(result).toMatchObject({
      ok: true,
      request: { redirectUri: 'https://claude.ai/cb' },
    });
  });

  it('reports other errors to the verified redirect URI, with the state', async () => {
    const result = await check({ response_type: 'token' });
    expect(result).toMatchObject({
      ok: false,
      error: 'unsupported_response_type',
      redirect: { uri: 'https://claude.ai/cb', state: 'xyz' },
    });
  });

  it('requires PKCE with S256', async () => {
    expect(await check({ code_challenge: undefined })).toMatchObject({
      ok: false,
      error: 'invalid_request',
    });
    expect(await check({ code_challenge_method: 'plain' })).toMatchObject({
      ok: false,
      error: 'invalid_request',
    });
    expect(await check({ code_challenge: 'short' })).toMatchObject({
      ok: false,
      error: 'invalid_request',
    });
  });

  it('refuses a resource that is not this MCP server', async () => {
    expect(
      await check({ resource: 'https://other.example/api/mcp' }),
    ).toMatchObject({ ok: false, error: 'invalid_target' });
    expect(await check({ resource: `${ORIGIN}/api/mcp` })).toMatchObject({
      ok: true,
    });
  });

  it('narrows the scope to what was asked for and rejects unknown-only scopes', async () => {
    expect(await check({ scope: 'recipes:read' })).toMatchObject({
      ok: true,
      request: { scope: ['recipes:read'] },
    });
    expect(await check({ scope: 'admin' })).toMatchObject({
      ok: false,
      error: 'invalid_scope',
    });
  });
});

describe('redirectWith', () => {
  it('adds parameters, keeps existing ones and skips undefined', () => {
    const url = redirectWith('https://a.com/cb?keep=1', {
      code: 'abc',
      state: undefined,
      iss: ORIGIN,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('keep')).toBe('1');
    expect(parsed.searchParams.get('code')).toBe('abc');
    expect(parsed.searchParams.get('iss')).toBe(ORIGIN);
    expect(parsed.searchParams.has('state')).toBe(false);
  });

  it('works for app-scheme redirect URIs', () => {
    expect(redirectWith('claude://auth/cb', { code: 'abc' })).toContain(
      'code=abc',
    );
  });
});

describe('authorizeParamsFrom', () => {
  it('keeps the authorization parameters that are text, and nothing else', () => {
    const form = new FormData();
    form.append('client_id', 'c');
    form.append('scope', 'recipes:read');
    form.append('decision', 'approve');
    form.append('resource', new Blob(['x']), 'x.txt');
    expect(authorizeParamsFrom(form)).toEqual({
      client_id: 'c',
      scope: 'recipes:read',
    });
  });

  it('knows exactly the parameters of an authorization request', () => {
    expect([...AUTHORIZE_FIELDS]).toEqual([
      'client_id',
      'redirect_uri',
      'response_type',
      'state',
      'code_challenge',
      'code_challenge_method',
      'scope',
      'resource',
    ]);
  });
});
