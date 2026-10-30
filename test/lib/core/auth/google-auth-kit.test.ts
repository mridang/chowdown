import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { NextResponse } from 'next/server';

import { STATE_COOKIE } from '@/domain/auth/app';
import type { GoogleOAuthClient, GoogleUserResponse } from '@/lib/google';
import { appRequest, installEnv, jar } from '../../../lib/auth/auth-test-kit';
import { installFakeTracing } from '../observability/fake-tracing';

const tracing = installFakeTracing();
const { GoogleAuthKit } = await import('@/lib/core/auth/google-auth-kit');

/** What the fake Google client answers. */
interface Google {
  exchange: 'ok' | 'fails' | 'throws';
  userinfo: 'ok' | 'fails';
}
const google: Google = { exchange: 'ok', userinfo: 'ok' };

const fakeClient = {
  authUrl: () => 'https://accounts.google.com/auth',
  exchangeCode: async () => {
    if (google.exchange === 'throws') {
      throw new Error('network down');
    }
    return google.exchange === 'ok'
      ? { ok: true, value: { access_token: 'at' } }
      : { ok: false, status: 400, raw: 'invalid_grant: SECRET-DETAIL' };
  },
  getUserInfo: async () =>
    google.userinfo === 'ok'
      ? { ok: true, value: { sub: 's', email: 'e@x.test' } }
      : { ok: false, status: 401 },
} as unknown as GoogleOAuthClient;

let missing: string[] = [];
const completeSignIn = jest.fn<
  (context: unknown, info: GoogleUserResponse) => Promise<NextResponse>
>(async () => NextResponse.redirect('https://app.test/app'));
const completeDrive = jest.fn(async () =>
  NextResponse.redirect('https://app.test/drive-done'),
);

const kit = new GoogleAuthKit({
  oauthClient: () => fakeClient,
  signInScopes: ['openid'],
  callbackPath: '/auth/callback',
  missingSettings: () => missing,
  extraPurposes: ['drive'],
  otherFlows: {
    drive: { failurePath: () => '/drive-failed', complete: completeDrive },
  },
  signInFailedPath: '/?signin=failed',
  completeSignIn,
});

let restore: () => void;

beforeEach(() => {
  restore = installEnv();
  jar.clear();
  missing = [];
  google.exchange = 'ok';
  google.userinfo = 'ok';
  completeSignIn.mockClear();
  for (const key of Object.keys(tracing.attributes)) {
    delete tracing.attributes[key];
  }
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  restore();
  jest.restoreAllMocks();
});

/** Run the callback for a browser that holds `cookie`, at `query`. */
function callback(query: string, cookie?: string): Promise<Response> {
  jar.clear();
  if (cookie) {
    jar.set(STATE_COOKIE, cookie);
  }
  return kit.callbackHandler()(appRequest('GET', `/auth/callback?${query}`));
}

describe('the error context of the login handler', () => {
  it('names the provider, the flow and the step', async () => {
    await kit.loginHandler()(appRequest('GET', '/auth/login'));
    expect(tracing.attributes).toEqual({
      'auth.provider': 'google',
      'auth.flow': 'login',
      'auth.step': 'start',
    });
  });

  it('adds a fixed reason when sign-in is not set up', async () => {
    missing = ['SESSION_SECRET'];
    await kit.loginHandler()(appRequest('GET', '/auth/login'));
    expect(tracing.attributes['auth.failure']).toBe('not_configured');
  });
});

describe('the error context of the callback handler', () => {
  it('names a finished sign-in and carries no failure', async () => {
    await callback('code=c&state=signin.a', 'signin.a');
    expect(tracing.attributes).toEqual({
      'auth.provider': 'google',
      'auth.flow': 'callback',
      'auth.step': 'done',
    });
  });

  it('names the other ask by its purpose', async () => {
    await callback('code=c&state=drive.a', 'drive.a');
    expect(tracing.attributes).toMatchObject({
      'auth.flow': 'drive',
      'auth.step': 'done',
    });
  });

  it('says state_mismatch when the state does not check out', async () => {
    await callback('code=c&state=signin.other', 'signin.a');
    expect(tracing.attributes).toMatchObject({
      'auth.step': 'state',
      'auth.failure': 'state_mismatch',
    });
  });

  it('says denied when Google reports an error, and no_code when it sends nothing', async () => {
    await callback('error=access_denied&state=signin.a', 'signin.a');
    expect(tracing.attributes['auth.failure']).toBe('denied');
    await callback('state=signin.a', 'signin.a');
    expect(tracing.attributes['auth.failure']).toBe('no_code');
  });

  it('says not_configured when settings are missing', async () => {
    missing = ['SESSION_SECRET'];
    await callback('code=c&state=signin.a', 'signin.a');
    expect(tracing.attributes['auth.failure']).toBe('not_configured');
  });

  it('says where the round trip failed, whatever the cause', async () => {
    google.exchange = 'fails';
    await callback('code=c&state=signin.a', 'signin.a');
    expect(tracing.attributes).toMatchObject({
      'auth.step': 'exchange',
      'auth.failure': 'token_exchange_failed',
    });
    google.exchange = 'throws';
    await callback('code=c&state=signin.a', 'signin.a');
    expect(tracing.attributes['auth.failure']).toBe('token_exchange_failed');
    google.exchange = 'ok';
    google.userinfo = 'fails';
    await callback('code=c&state=signin.a', 'signin.a');
    expect(tracing.attributes).toMatchObject({
      'auth.step': 'userinfo',
      'auth.failure': 'userinfo_failed',
    });
    google.userinfo = 'ok';
    completeSignIn.mockRejectedValueOnce(new Error('boom'));
    await callback('code=c&state=signin.a', 'signin.a');
    expect(tracing.attributes).toMatchObject({
      'auth.step': 'finish',
      'auth.failure': 'finish_failed',
    });
  });

  it('never puts the state, the code, a token or Google’s text in the context', async () => {
    google.exchange = 'fails';
    await callback('code=the-code&state=signin.a', 'signin.a');
    const everything = JSON.stringify(tracing.attributes);
    for (const secret of ['the-code', 'signin.a', 'SECRET-DETAIL', 'at']) {
      expect(everything).not.toContain(secret);
    }
  });
});
