import { describe, expect, it } from '@jest/globals';

import { setSearchParams, withQueryParams } from '@/lib/util/query';

describe('setSearchParams', () => {
  it('appends a parameter that is not there yet', () => {
    expect(setSearchParams('', { a: '1' })).toBe('?a=1');
    expect(setSearchParams('?x=1', { a: '2' })).toBe('?x=1&a=2');
  });

  it('replaces a parameter where it stood and drops its repeats', () => {
    expect(setSearchParams('?a=1&b=2&a=3', { a: '9' })).toBe('?a=9&b=2');
  });

  it('sets several and encodes values', () => {
    expect(setSearchParams('', { a: 'x y', b: '&' })).toBe('?a=x+y&b=%26');
  });

  it('is empty when there is nothing to say', () => {
    expect(setSearchParams('', {})).toBe('');
  });
});

describe('withQueryParams', () => {
  it('adds to a plain address', () => {
    expect(withQueryParams('https://app.test/cb', { code: 'c' })).toBe(
      'https://app.test/cb?code=c',
    );
  });

  it('keeps the query the address already has', () => {
    expect(
      withQueryParams('https://app.test/cb?x=1', { code: 'c', state: 's' }),
    ).toBe('https://app.test/cb?x=1&code=c&state=s');
  });

  it('keeps the fragment after the query', () => {
    expect(withQueryParams('https://app.test/cb#frag', { code: 'c' })).toBe(
      'https://app.test/cb?code=c#frag',
    );
  });

  it('works for app-scheme addresses', () => {
    expect(withQueryParams('app://callback', { code: 'c' })).toBe(
      'app://callback?code=c',
    );
  });

  it('leaves the address alone when there is nothing to add', () => {
    expect(withQueryParams('https://app.test/cb?x=%20', {})).toBe(
      'https://app.test/cb?x=%20',
    );
  });
});
