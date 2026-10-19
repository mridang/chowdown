import { describe, expect, it } from '@jest/globals';

import {
  CORS_HEADERS,
  bearerToken,
  noStoreJson,
  oauthError,
  preflight,
} from '../../../src/lib/oauth/http';

const withAuth = (value?: string) =>
  new Request('https://chowdown.test/x', {
    headers: value === undefined ? {} : { authorization: value },
  });

describe('bearerToken', () => {
  it('reads the token from a Bearer header, in any case', () => {
    expect(bearerToken(withAuth('Bearer abc.def'))).toBe('abc.def');
    expect(bearerToken(withAuth('bearer abc'))).toBe('abc');
  });

  it('is undefined without a header or with another scheme', () => {
    expect(bearerToken(withAuth())).toBeUndefined();
    expect(bearerToken(withAuth('Basic abc'))).toBeUndefined();
  });

  it('is undefined for a header with extra words or no token', () => {
    expect(bearerToken(withAuth('Bearer'))).toBeUndefined();
    expect(bearerToken(withAuth('Bearer a b'))).toBeUndefined();
  });
});

describe('preflight', () => {
  it('answers 204 with the CORS headers', () => {
    const response = preflight();
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-headers')).toBe(
      CORS_HEADERS['Access-Control-Allow-Headers'],
    );
  });
});

describe('noStoreJson', () => {
  it('is never cached, and open to browsers', async () => {
    const response = noStoreJson({ a: 1 });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(await response.json()).toEqual({ a: 1 });
  });

  it('carries a status and extra headers', () => {
    const response = noStoreJson({}, 201, { 'X-Test': '1' });
    expect(response.status).toBe(201);
    expect(response.headers.get('x-test')).toBe('1');
  });
});

describe('oauthError', () => {
  it('is an RFC 6749 error body, 400 unless told otherwise', async () => {
    const response = oauthError('invalid_request', 'Nope.');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Nope.',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('can carry another status', () => {
    expect(oauthError('invalid_client', 'x', 401).status).toBe(401);
  });
});
