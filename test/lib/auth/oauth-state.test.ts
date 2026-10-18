import { describe, expect, it } from '@jest/globals';

import { newState, purposeOf } from '../../../src/lib/auth/oauth-state';

describe('newState', () => {
  it('names its purpose and is different every time', () => {
    expect(newState('signin')).toMatch(/^signin\.[0-9a-f-]{36}$/);
    expect(newState('drive')).toMatch(/^drive\.[0-9a-f-]{36}$/);
    expect(newState('drive')).not.toBe(newState('drive'));
  });
});

describe('purposeOf', () => {
  it('reads the purpose back out', () => {
    expect(purposeOf(newState('signin'))).toBe('signin');
    expect(purposeOf(newState('drive'))).toBe('drive');
  });

  it('refuses anything that is not one of ours', () => {
    expect(purposeOf('')).toBeUndefined();
    expect(purposeOf('drive')).toBeUndefined();
    expect(purposeOf('drive.')).toBeUndefined();
    expect(purposeOf('admin.123')).toBeUndefined();
    expect(purposeOf('123e4567-e89b-12d3-a456-426614174000')).toBeUndefined();
  });
});
