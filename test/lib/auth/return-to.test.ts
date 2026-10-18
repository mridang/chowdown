import { describe, expect, it } from '@jest/globals';

import {
  driveResultPath,
  safeReturnPath,
} from '../../../src/lib/auth/return-to';

describe('safeReturnPath', () => {
  it('allows a path on this site, with its query', () => {
    expect(safeReturnPath('/oauth/authorize?client_id=x&state=y')).toBe(
      '/oauth/authorize?client_id=x&state=y',
    );
    expect(safeReturnPath('/app')).toBe('/app');
  });

  it('refuses anything that could leave the site', () => {
    expect(safeReturnPath('https://evil.example')).toBeUndefined();
    expect(safeReturnPath('//evil.example')).toBeUndefined();
    expect(safeReturnPath('/\\evil.example')).toBeUndefined();
    expect(safeReturnPath('javascript:alert(1)')).toBeUndefined();
  });

  it('refuses control characters and empty values', () => {
    expect(safeReturnPath('/a\nb')).toBeUndefined();
    expect(safeReturnPath('')).toBeUndefined();
    expect(safeReturnPath(null)).toBeUndefined();
    expect(safeReturnPath(undefined)).toBeUndefined();
  });
});

describe('driveResultPath', () => {
  it('lands on the recipe list with a fixed reason', () => {
    expect(driveResultPath('denied')).toBe('/app?drive=denied');
    expect(driveResultPath('error')).toBe('/app?drive=error');
  });

  it('is itself a path safeReturnPath accepts', () => {
    expect(safeReturnPath(driveResultPath('denied'))).toBe('/app?drive=denied');
  });
});
