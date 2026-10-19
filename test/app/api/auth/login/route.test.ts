import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET } from '../../../../../src/app/api/auth/login/route';
import { locationOf, nextRequest, openWorld, type World } from '../../world';

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

describe('GET /api/auth/login', () => {
  it('sends the browser to Google asking only who the person is', async () => {
    const res = GET(nextRequest('/api/auth/login'));
    const target = locationOf(res);
    expect(res.status).toBe(307);
    expect(`${target?.origin}${target?.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(target?.searchParams.get('client_id')).toBe('client-id');
    expect(target?.searchParams.get('redirect_uri')).toBe(
      'https://chowdown.test/api/auth/callback',
    );
    expect(target?.searchParams.get('scope')).toBe('openid email profile');
  });

  it('keeps the same one-time state in the address and in an httpOnly cookie', () => {
    const res = GET(nextRequest('/api/auth/login'));
    const state = locationOf(res)?.searchParams.get('state');
    expect(state).toMatch(/^signin\./);
    expect(res.cookies.get('chowdown_oauth_state')).toMatchObject({
      value: state,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 600,
    });
  });

  it('gives each visit a different state', () => {
    const state = () =>
      locationOf(GET(nextRequest('/api/auth/login')))?.searchParams.get(
        'state',
      );
    expect(state()).not.toBe(state());
  });

  it('remembers a safe returnTo in a cookie', () => {
    const res = GET(nextRequest('/api/auth/login?returnTo=%2Frecipe%2Fabc'));
    expect(res.cookies.get('chowdown_return_to')?.value).toBe('/recipe/abc');
  });

  it.each([
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/a\r\nb',
  ])('refuses to remember the returnTo %s', (target) => {
    const res = GET(
      nextRequest(`/api/auth/login?returnTo=${encodeURIComponent(target)}`),
    );
    expect(res.cookies.get('chowdown_return_to')?.value ?? '').toBe('');
  });
});
