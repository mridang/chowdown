import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  DRIVE_SCOPE,
  buildAuthUrl,
  exchangeCode,
  getUserInfo,
  grantedDrive,
  refreshAccessToken,
} from '../../../src/lib/auth/google-oauth';

const base = {
  clientId: 'client-id',
  redirectUri: 'https://chowdown.test/api/auth/callback',
  state: 'abc',
};

describe('buildAuthUrl', () => {
  it('asks only who the person is when signing in', () => {
    const url = new URL(buildAuthUrl({ ...base, purpose: 'signin' }));
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('scope')).not.toContain('drive');
  });

  it('asks for no refresh token when signing in', () => {
    const url = new URL(buildAuthUrl({ ...base, purpose: 'signin' }));
    expect(url.searchParams.get('access_type')).toBeNull();
    expect(url.searchParams.get('prompt')).toBeNull();
    expect(url.searchParams.get('include_granted_scopes')).toBeNull();
  });

  it('asks for Drive and a refresh token when connecting Drive', () => {
    const url = new URL(buildAuthUrl({ ...base, purpose: 'drive' }));
    expect(url.searchParams.get('scope')).toBe(`openid ${DRIVE_SCOPE}`);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('include_granted_scopes')).toBe('true');
  });

  it('points the account chooser at the signed-in account when connecting Drive', () => {
    const url = new URL(
      buildAuthUrl({ ...base, purpose: 'drive', loginHint: 'a@b.com' }),
    );
    expect(url.searchParams.get('login_hint')).toBe('a@b.com');
    const signIn = new URL(
      buildAuthUrl({ ...base, purpose: 'signin', loginHint: 'a@b.com' }),
    );
    expect(signIn.searchParams.get('login_hint')).toBeNull();
  });

  it('carries the client, the callback address and the state', () => {
    const url = new URL(buildAuthUrl({ ...base, purpose: 'drive' }));
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

describe('exchangeCode', () => {
  const params = {
    code: 'the-code',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://chowdown.test/api/auth/callback',
  };

  it('posts the code as a form and returns the tokens', async () => {
    const tokens = {
      access_token: 'at',
      refresh_token: 'rt',
      expires_in: 3600,
    };
    const fetchSpy = answerWith(tokens);
    await expect(exchangeCode(params)).resolves.toEqual(tokens);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init?.method).toBe('POST');
    const form = new URLSearchParams(String(init?.body));
    expect(Object.fromEntries(form)).toEqual({
      code: 'the-code',
      client_id: 'client-id',
      client_secret: 'client-secret',
      redirect_uri: 'https://chowdown.test/api/auth/callback',
      grant_type: 'authorization_code',
    });
  });

  it("throws with Google's answer when the exchange is refused", async () => {
    answerWith({ error: 'invalid_grant' }, 400);
    await expect(exchangeCode(params)).rejects.toThrow(
      /Token exchange failed: 400 .*invalid_grant/,
    );
  });

  it('throws when the answer has no access token', async () => {
    answerWith({ nothing: true });
    await expect(exchangeCode(params)).rejects.toThrow(/unexpected response/);
  });
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

describe('getUserInfo', () => {
  it('sends the access token as a bearer and returns who the person is', async () => {
    const user = { sub: '1', email: 'a@b.com', name: 'Ann' };
    const fetchSpy = answerWith(user);
    await expect(getUserInfo('at')).resolves.toEqual(user);
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer at',
    });
  });

  it('throws when Google refuses', async () => {
    answerWith({}, 401);
    await expect(getUserInfo('at')).rejects.toThrow('userinfo failed: 401');
  });

  it('accepts an answer with only `sub`, as a Drive-only grant gives', async () => {
    // Connecting Drive asks for `openid` and `drive.file` only, so if the earlier
    // identity grant is gone Google names the account and nothing else. That is
    // all the Drive step needs.
    answerWith({ sub: '1' });
    await expect(getUserInfo('at')).resolves.toEqual({ sub: '1' });
  });

  it('throws when the answer does not say which account it is', async () => {
    answerWith({ email: 'a@b.com' });
    await expect(getUserInfo('at')).rejects.toThrow(/unexpected response/);
  });

  it('throws when the email is not text', async () => {
    answerWith({ sub: '1', email: 7 });
    await expect(getUserInfo('at')).rejects.toThrow(/unexpected response/);
  });
});
