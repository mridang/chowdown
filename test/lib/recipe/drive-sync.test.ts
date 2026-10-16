import { describe, expect, it } from '@jest/globals';

import { isAuthFailure } from '../../../src/lib/recipe/drive-sync';

describe('isAuthFailure', () => {
  it('is true when Google reports an invalid or revoked grant', () => {
    expect(
      isAuthFailure(
        new Error(
          'Token refresh failed: 400 {"error":"invalid_grant","error_description":"Token has been expired or revoked."}',
        ),
      ),
    ).toBe(true);
  });

  it('is true for a 400 or 401 from the token endpoint', () => {
    expect(
      isAuthFailure(new Error('Token refresh failed: 401 unauthorized')),
    ).toBe(true);
    expect(
      isAuthFailure(new Error('Token refresh failed: 400 bad request')),
    ).toBe(true);
  });

  it('is false for transient failures that should not force a re-login', () => {
    expect(
      isAuthFailure(new Error('Token refresh failed: 503 unavailable')),
    ).toBe(false);
    expect(isAuthFailure(new Error('fetch failed'))).toBe(false);
    expect(isAuthFailure(new Error('Drive list failed: 500'))).toBe(false);
  });

  it('copes with non-Error values', () => {
    expect(isAuthFailure('invalid_grant')).toBe(true);
    expect(isAuthFailure(undefined)).toBe(false);
  });
});
