import { describe, expect, it } from '@jest/globals';

import {
  isAcceptableRedirectUri,
  redirectKind,
  redirectUriMatches,
} from '../../../src/lib/oauth/redirect-uri';

describe('isAcceptableRedirectUri', () => {
  it('accepts https, loopback http and private-use schemes', () => {
    expect(isAcceptableRedirectUri('https://chatgpt.com/cb')).toBe(true);
    expect(isAcceptableRedirectUri('http://localhost:3000/cb')).toBe(true);
    expect(isAcceptableRedirectUri('http://127.0.0.1:8080/cb')).toBe(true);
    expect(isAcceptableRedirectUri('http://[::1]:8080/cb')).toBe(true);
    expect(isAcceptableRedirectUri('claude://auth/callback')).toBe(true);
  });

  it.each([
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.com/api/mcp/auth_callback',
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'https://chatgpt.com/connector/oauth/abc123',
    'cursor://anysphere.cursor-retrieval/oauth/user-chowdown/callback',
    'http://127.0.0.1:33418/',
    'https://vscode.dev/redirect',
    'vscode://ms-vscode.mcp/auth',
    'vscode-insiders://ms-vscode.mcp/auth',
    'http://localhost:6274/oauth/callback',
    'http://localhost/callback',
    'com.example.app:/oauth2redirect',
    'io.github.someone.client://callback',
  ])('accepts the known client address %s', (uri) => {
    expect(isAcceptableRedirectUri(uri)).toBe(true);
  });

  it.each([
    'http://example.com/cb',
    'http://192.168.1.5:3000/cb',
    'http://localhost.evil.com/cb',
    'ws://localhost:3000/cb',
    'wss://example.com/cb',
    'mailto:someone@example.com',
    'tel:+15555550100',
    'intent://scan/#Intent;scheme=zxing;end',
    'chrome://settings',
    'myapp://callback',
    'ftp://example.com/cb',
    'javascript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'blob:https://example.com/abc',
    'about:blank',
  ])('rejects %s', (uri) => {
    expect(isAcceptableRedirectUri(uri)).toBe(false);
  });

  it('rejects fragments, credentials and junk', () => {
    expect(isAcceptableRedirectUri('https://a.com/cb#frag')).toBe(false);
    expect(isAcceptableRedirectUri('https://user:pw@a.com/cb')).toBe(false);
    expect(isAcceptableRedirectUri('not a url')).toBe(false);
  });
});

describe('redirectKind', () => {
  it('tells the web from this computer from an installed app', () => {
    expect(redirectKind('https://claude.ai/cb')).toBe('web');
    expect(redirectKind('http://localhost:6274/cb')).toBe('loopback');
    expect(redirectKind('http://127.0.0.1:1/')).toBe('loopback');
    expect(redirectKind('http://[::1]:1/')).toBe('loopback');
    expect(redirectKind('cursor://anysphere.cursor-retrieval/x')).toBe('app');
    expect(redirectKind('not a url')).toBe('web');
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
