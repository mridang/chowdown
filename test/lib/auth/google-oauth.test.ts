import { describe, expect, it } from '@jest/globals';

import {
  DRIVE_SCOPE,
  buildAuthUrl,
  grantedDrive,
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
