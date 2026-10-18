import { describe, expect, it } from '@jest/globals';

import {
  parsePreloadList,
  preloadLinkHeader,
} from '../../../src/lib/http/preload';

describe('preloadLinkHeader', () => {
  it('builds a preload header for each built script', () => {
    expect(
      preloadLinkHeader(['static/chunks/a.js', 'static/chunks/b.js']),
    ).toBe(
      '</_next/static/chunks/a.js>; rel=preload; as=script, </_next/static/chunks/b.js>; rel=preload; as=script',
    );
  });

  it('skips anything that is not a built script', () => {
    expect(
      preloadLinkHeader(['static/chunks/a.css', '../etc/passwd', 'x.js']),
    ).toBe('');
  });
});

describe('parsePreloadList', () => {
  it('reads a list of file names', () => {
    expect(parsePreloadList('["static/a.js","static/b.js"]')).toEqual([
      'static/a.js',
      'static/b.js',
    ]);
  });

  it('survives anything else', () => {
    expect(parsePreloadList('not json')).toEqual([]);
    expect(parsePreloadList('{"a":1}')).toEqual([]);
    expect(parsePreloadList('[1,"static/a.js",null]')).toEqual(['static/a.js']);
  });
});
