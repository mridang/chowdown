import { describe, expect, it } from '@jest/globals';

import type { ParsedRecipe } from '../../../src/lib/recipe/cooklang';
import {
  extractMedia,
  normalizeImageUrl,
  validImageUrls,
  withImages,
} from '../../../src/lib/recipe/media';

function recipe(metadata: [string, string][]): ParsedRecipe {
  return { title: 'X', metadata, ingredients: [], cookware: [], steps: [] };
}

describe('extractMedia', () => {
  it('treats the first image as the cover and the rest as extras', () => {
    const media = extractMedia(
      recipe([
        [
          'images',
          'https://a.com/1.jpg https://a.com/2.jpg https://a.com/3.jpg',
        ],
      ]),
    );
    expect(media.cover).toBe('https://a.com/1.jpg');
    expect(media.rest).toEqual(['https://a.com/2.jpg', 'https://a.com/3.jpg']);
  });

  it('keeps a URL that contains a comma intact (whitespace delimiter)', () => {
    const media = extractMedia(
      recipe([['images', 'https://img.example/pic.jpg?resize=440,400']]),
    );
    expect(media.cover).toBe('https://img.example/pic.jpg?resize=440,400');
    expect(media.rest).toEqual([]);
  });

  it('reads a video url', () => {
    const media = extractMedia(recipe([['video', 'https://youtu.be/abc']]));
    expect(media.video).toBe('https://youtu.be/abc');
  });

  it('drops non-http values', () => {
    const media = extractMedia(
      recipe([
        ['images', 'not-a-url https://a.com/ok.jpg javascript:alert(1)'],
        ['video', 'ftp://x'],
      ]),
    );
    expect(media.cover).toBe('https://a.com/ok.jpg');
    expect(media.rest).toEqual([]);
    expect(media.video).toBeUndefined();
  });

  it('is empty when there is no media', () => {
    const media = extractMedia(recipe([['cuisine', 'Indian']]));
    expect(media.cover).toBeUndefined();
    expect(media.rest).toEqual([]);
    expect(media.video).toBeUndefined();
  });
});

describe('validImageUrls', () => {
  it('keeps distinct http(s) urls in order and drops the rest', () => {
    expect(
      validImageUrls([
        'https://a.com/1.jpg',
        'javascript:alert(1)',
        '/relative.jpg',
        ' https://a.com/1.jpg ',
        'http://b.com/2.png',
        '',
      ]),
    ).toEqual(['https://a.com/1.jpg', 'http://b.com/2.png']);
  });
});

describe('withImages', () => {
  it('adds an images line to the metadata block', () => {
    const out = withImages('>> title: T\n\nCook.\n', ['https://a.com/1.jpg']);
    expect(out).toContain('>> images: https://a.com/1.jpg');
    expect(out).toContain('Cook.');
  });

  it('replaces an existing images line and keeps the order', () => {
    const out = withImages('>> title: T\n>> images: https://old.com/x.jpg\n', [
      'https://a.com/1.jpg',
      'https://a.com/2.jpg',
    ]);
    expect(out).toContain('>> images: https://a.com/1.jpg https://a.com/2.jpg');
    expect(out).not.toContain('old.com');
  });

  it('leaves the source alone when no url is valid', () => {
    const src = '>> title: T\n>> images: https://keep.com/x.jpg\n';
    expect(withImages(src, ['not a url', 'javascript:x'])).toBe(src);
  });
});

describe('normalizeImageUrl', () => {
  it('percent-encodes spaces so a url survives the space-separated list', () => {
    expect(
      normalizeImageUrl('https://a.com/Chilli Chicken Hero 1.1.avif'),
    ).toBe('https://a.com/Chilli%20Chicken%20Hero%201.1.avif');
  });

  it('rejects placeholder paths like /undefined', () => {
    expect(normalizeImageUrl('https://a.com/2012/undefined')).toBeUndefined();
    expect(normalizeImageUrl('https://a.com/null')).toBeUndefined();
  });

  it('rejects non-http schemes and relative paths', () => {
    expect(normalizeImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeImageUrl('/img/x.jpg')).toBeUndefined();
    expect(normalizeImageUrl('')).toBeUndefined();
  });

  it('keeps a normal url, including a query string with a comma', () => {
    expect(normalizeImageUrl('https://a.com/p.jpg?resize=440,400')).toBe(
      'https://a.com/p.jpg?resize=440,400',
    );
  });
});
