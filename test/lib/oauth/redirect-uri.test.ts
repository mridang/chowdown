import { describe, expect, it } from '@jest/globals';

import {
  isAcceptableRedirectUri,
  redirectUriMatches,
} from '../../../src/lib/oauth/redirect-uri';

describe('isAcceptableRedirectUri', () => {
  it('accepts https, loopback http and private-use schemes', () => {
    expect(isAcceptableRedirectUri('https://chatgpt.com/cb')).toBe(true);
    expect(isAcceptableRedirectUri('http://localhost:3000/cb')).toBe(true);
    expect(isAcceptableRedirectUri('http://127.0.0.1:8080/cb')).toBe(true);
    expect(isAcceptableRedirectUri('claude://auth/callback')).toBe(true);
  });

  it('rejects plain http to a real host', () => {
    expect(isAcceptableRedirectUri('http://example.com/cb')).toBe(false);
  });

  it('rejects script, data and file schemes', () => {
    expect(isAcceptableRedirectUri('javascript:alert(1)')).toBe(false);
    expect(isAcceptableRedirectUri('data:text/html,hi')).toBe(false);
    expect(isAcceptableRedirectUri('file:///etc/passwd')).toBe(false);
  });

  it('rejects fragments, credentials and junk', () => {
    expect(isAcceptableRedirectUri('https://a.com/cb#frag')).toBe(false);
    expect(isAcceptableRedirectUri('https://user:pw@a.com/cb')).toBe(false);
    expect(isAcceptableRedirectUri('not a url')).toBe(false);
  });
});

describe('redirectUriMatches', () => {
  const registered = ['https://a.com/cb', 'http://localhost:3000/cb'];

  it('matches a registered URI exactly', () => {
    expect(redirectUriMatches('https://a.com/cb', registered)).toBe(true);
  });

  it('refuses anything else, including a different path or query', () => {
    expect(redirectUriMatches('https://a.com/other', registered)).toBe(false);
    expect(redirectUriMatches('https://a.com/cb?x=1', registered)).toBe(false);
    expect(redirectUriMatches('https://evil.com/cb', registered)).toBe(false);
  });

  it('lets a loopback URI use any port', () => {
    expect(redirectUriMatches('http://localhost:54321/cb', registered)).toBe(
      true,
    );
    expect(redirectUriMatches('http://localhost:54321/other', registered)).toBe(
      false,
    );
  });

  it('does not extend the port freedom to real hosts', () => {
    expect(redirectUriMatches('https://a.com:8443/cb', registered)).toBe(false);
  });
});
