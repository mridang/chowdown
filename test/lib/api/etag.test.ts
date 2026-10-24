import { describe, expect, it } from '@jest/globals';

import {
  entityTag,
  ifMatchSatisfied,
  ifNoneMatchHit,
  representationTag,
} from '@/lib/rest-json/etag';

describe('entityTag', () => {
  it('is a quoted, stable hash that changes with the content', async () => {
    const a = await entityTag('>> title: A');
    expect(a).toMatch(/^"[0-9a-f]{16}"$/);
    expect(a).toBe(await entityTag('>> title: A'));
    expect(a).not.toBe(await entityTag('>> title: B'));
  });
});

describe('ifMatchSatisfied', () => {
  it('allows a write when there is no If-Match', () => {
    expect(ifMatchSatisfied(null, '"abc"')).toBe(true);
  });

  it('allows a matching tag, a list containing it, a weak tag, or *', () => {
    expect(ifMatchSatisfied('"abc"', '"abc"')).toBe(true);
    expect(ifMatchSatisfied('"zzz", "abc"', '"abc"')).toBe(true);
    expect(ifMatchSatisfied('W/"abc"', '"abc"')).toBe(true);
    expect(ifMatchSatisfied('*', '"abc"')).toBe(true);
  });

  it('refuses a stale tag', () => {
    expect(ifMatchSatisfied('"old"', '"abc"')).toBe(false);
  });
});

describe('ifNoneMatchHit', () => {
  it('is a hit only when the client already holds the current tag', () => {
    expect(ifNoneMatchHit('"abc"', '"abc"')).toBe(true);
    expect(ifNoneMatchHit('"old"', '"abc"')).toBe(false);
    expect(ifNoneMatchHit(null, '"abc"')).toBe(false);
  });
});

describe('representationTag', () => {
  it('keeps the base tag for JSON and gives each other representation its own', () => {
    expect(representationTag('"abc"', 'json')).toBe('"abc"');
    expect(representationTag('"abc"', 'cooklang')).toBe('"abc-cooklang"');
    expect(representationTag('"abc"', 'ld')).toBe('"abc-ld"');
  });

  it('is never mistaken for another representation by If-None-Match', () => {
    const json = representationTag('"abc"', 'json');
    const cook = representationTag('"abc"', 'cooklang');
    expect(ifNoneMatchHit(json, cook)).toBe(false);
    expect(ifNoneMatchHit(cook, cook)).toBe(true);
  });

  it('still lets any representation tag stand for the content in If-Match', () => {
    expect(ifMatchSatisfied('"abc-cooklang"', '"abc"')).toBe(true);
    expect(ifMatchSatisfied('"old-ld"', '"abc"')).toBe(false);
  });
});
