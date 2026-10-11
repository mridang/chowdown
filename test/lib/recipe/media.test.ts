import { describe, expect, it } from '@jest/globals';

import type { ParsedRecipe } from '../../../src/lib/recipe/cooklang';
import { extractMedia } from '../../../src/lib/recipe/media';

function recipe(metadata: [string, string][]): ParsedRecipe {
  return { title: 'X', metadata, ingredients: [], cookware: [], steps: [] };
}

describe('extractMedia', () => {
  it('treats the first image as the cover and the rest as extras', () => {
    const media = extractMedia(
      recipe([['images', 'https://a.com/1.jpg https://a.com/2.jpg https://a.com/3.jpg']]),
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
