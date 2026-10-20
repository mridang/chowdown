import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  DRIVE_SCOPE,
  buildDriveAuthUrl,
  grantedDrive,
  refreshAccessToken,
  revokeToken,
} from '../../../src/lib/auth/drive-oauth';

const base = {
  clientId: 'client-id',
  redirectUri: 'https://chowdown.test/api/auth/callback',
  state: 'abc',
};

describe('buildDriveAuthUrl', () => {
  it('asks for Drive and a refresh token', () => {
    const url = new URL(buildDriveAuthUrl(base));
    expect(url.searchParams.get('scope')).toBe(`openid ${DRIVE_SCOPE}`);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('include_granted_scopes')).toBe('true');
  });

  it('points the account chooser at the signed-in account', () => {
    const url = new URL(buildDriveAuthUrl({ ...base, loginHint: 'a@b.com' }));
    expect(url.searchParams.get('login_hint')).toBe('a@b.com');
    expect(
      new URL(buildDriveAuthUrl(base)).searchParams.get('login_hint'),
    ).toBeNull();
  });

  it('carries the client, the callback address and the state', () => {
    const url = new URL(buildDriveAuthUrl(base));
    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(base.redirectUri);
    expect(url.searchParams.get('state')).toBe('abc');
    expect(url.searchParams.get('response_type')).toBe('code');
  });
});

describe('grantedDrive', () => {
  it('is true when the granted scopes include Drive', () => {
    expect(grantedDrive(`openid ${DRIVE_SCOPE}`)).toBe(true);
  });

  it('is false when the person unticked Drive, or Google said nothing', () => {
    expect(grantedDrive('openid email profile')).toBe(false);
    expect(grantedDrive('')).toBe(false);
    expect(grantedDrive(undefined)).toBe(false);
  });

  it('does not match a longer scope that merely starts the same way', () => {
    expect(grantedDrive(`${DRIVE_SCOPE}.readonly`)).toBe(false);
  });
});

/** Answer the next `fetch` with a JSON body (or a failure status) and report the request. */
function answerWith(body: unknown, status = 200) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('refreshAccessToken', () => {
  const params = {
    refreshToken: 'rt',
    clientId: 'client-id',
    clientSecret: 'client-secret',
  };

  it('posts the refresh token and returns the new access token', async () => {
    const fetchSpy = answerWith({ access_token: 'new', expires_in: 3599 });
    await expect(refreshAccessToken(params)).resolves.toEqual({
      access_token: 'new',
      expires_in: 3599,
    });
    const form = new URLSearchParams(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(form.get('grant_type')).toBe('refresh_token');
    expect(form.get('refresh_token')).toBe('rt');
  });

  it('keeps invalid_grant in the message so the login can be recognised as revoked', async () => {
    answerWith({ error: 'invalid_grant' }, 400);
    await expect(refreshAccessToken(params)).rejects.toThrow(/invalid_grant/);
  });

  it('throws when the answer is not a token', async () => {
    answerWith({ access_token: 5, expires_in: 'soon' });
    await expect(refreshAccessToken(params)).rejects.toThrow(
      /Token refresh failed: unexpected response/,
    );
  });
});

describe('revokeToken', () => {
  it('posts the token to the revocation endpoint', async () => {
    const fetchSpy = answerWith({});
    await revokeToken('the-token');
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('https://oauth2.googleapis.com/revoke');
    expect(init?.method).toBe('POST');
    expect(new URLSearchParams(String(init?.body)).get('token')).toBe(
      'the-token',
    );
  });

  it('throws when Google refuses', async () => {
    answerWith({}, 400);
    await expect(revokeToken('t')).rejects.toThrow('400');
  });
});
