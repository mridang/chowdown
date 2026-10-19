import { describe, expect, it } from '@jest/globals';

import {
  checkState,
  newState,
  purposeOf,
} from '../../../src/lib/auth/oauth-state';

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

describe('checkState', () => {
  it('trusts a state that matches the cookie and names its purpose', () => {
    const state = newState('drive');
    expect(checkState(state, state)).toEqual({ ok: true, purpose: 'drive' });
  });

  it('stops when either side is missing', () => {
    const state = newState('signin');
    expect(checkState(null, state)).toEqual({ ok: false, claimed: undefined });
    expect(checkState(state, undefined)).toEqual({
      ok: false,
      claimed: 'signin',
    });
    expect(checkState('', '')).toEqual({ ok: false, claimed: undefined });
  });

  it('stops when the two differ, still reporting the label for the wording', () => {
    expect(checkState(newState('drive'), newState('drive'))).toEqual({
      ok: false,
      claimed: 'drive',
    });
  });

  it('stops for a matching state that is not one of ours', () => {
    expect(checkState('admin.123', 'admin.123')).toEqual({
      ok: false,
      claimed: undefined,
    });
  });
});
