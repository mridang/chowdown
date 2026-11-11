import { describe, expect, it } from '@jest/globals';

import { bestRenditions } from '@/domain/recipe/image-renditions';

const UPLOADS = 'https://hot-thai-kitchen.com/wp-content/uploads/2016/01';

/** The `image` array of a real recipe page, smallest copy first. */
const WORDPRESS_COPIES = [
  `${UPLOADS}/pad-gaprao-new-sq-3-225x225.jpg`,
  `${UPLOADS}/pad-gaprao-new-sq-3-260x195.jpg`,
  `${UPLOADS}/pad-gaprao-new-sq-3-320x180.jpg`,
  `${UPLOADS}/pad-gaprao-new-sq-3.jpg`,
];

describe('bestRenditions', () => {
  it('keeps the original of a photo listed as several sizes, smallest first', () => {
    expect(bestRenditions(WORDPRESS_COPIES)).toEqual([
      `${UPLOADS}/pad-gaprao-new-sq-3.jpg`,
    ]);
  });

  it('keeps the same choice whatever order the copies come in', () => {
    expect(bestRenditions([...WORDPRESS_COPIES].toReversed())).toEqual([
      `${UPLOADS}/pad-gaprao-new-sq-3.jpg`,
    ]);
  });

  it('keeps the biggest copy when the original is not listed', () => {
    expect(bestRenditions(WORDPRESS_COPIES.slice(0, 3))).toEqual([
      `${UPLOADS}/pad-gaprao-new-sq-3-320x180.jpg`,
    ]);
  });

  it('keeps different photos, in the order they first appeared', () => {
    expect(
      bestRenditions([
        `${UPLOADS}/a-150x150.jpg`,
        `${UPLOADS}/b.jpg`,
        `${UPLOADS}/a.jpg`,
        `${UPLOADS}/b-300x200.jpg`,
      ]),
    ).toEqual([`${UPLOADS}/a.jpg`, `${UPLOADS}/b.jpg`]);
  });

  it('does not mix up photos with different names, folders or hosts', () => {
    const urls = [
      `${UPLOADS}/pad-gaprao-new-sq-3-180x180.jpg`,
      `${UPLOADS}/pad-gaprao-new-4x5-vert.jpg`,
      'https://hot-thai-kitchen.com/wp-content/uploads/2017/01/pad-gaprao-new-sq-3.jpg',
      'https://cdn.example.com/wp-content/uploads/2016/01/pad-gaprao-new-sq-3.jpg',
    ];
    expect(bestRenditions(urls)).toEqual(urls);
  });

  it('reads sizes from the query, whichever of the usual parameters is used', () => {
    expect(
      bestRenditions([
        'https://img.example/p.jpg?w=300',
        'https://img.example/p.jpg?width=1200&q=80',
        'https://img.example/p.jpg?resize=440,400',
      ]),
    ).toEqual(['https://img.example/p.jpg?width=1200&q=80']);
  });

  it('treats an address with no size as the original, even beside a big copy', () => {
    expect(
      bestRenditions([
        'https://img.example/p.jpg?w=4000',
        'https://img.example/p.jpg',
      ]),
    ).toEqual(['https://img.example/p.jpg']);
  });

  it('does not merge photos that differ in a parameter that is not a size', () => {
    const urls = [
      'https://img.example/view?id=1&w=300',
      'https://img.example/view?id=2&w=300',
    ];
    expect(bestRenditions(urls)).toEqual(urls);
  });

  it('keeps a lone sized address as it is', () => {
    expect(bestRenditions([`${UPLOADS}/wallpaper-1920x1080.jpg`])).toEqual([
      `${UPLOADS}/wallpaper-1920x1080.jpg`,
    ]);
  });

  it('lets the first of two equal copies win', () => {
    expect(
      bestRenditions([
        'https://img.example/p.jpg?w=300&fit=cover',
        'https://img.example/p.jpg?w=300',
      ]),
    ).toEqual(['https://img.example/p.jpg?w=300&fit=cover']);
  });

  it('passes through what it cannot read as an address, and an empty list', () => {
    expect(bestRenditions(['not a url', 'not a url'])).toEqual(['not a url']);
    expect(bestRenditions([])).toEqual([]);
  });
});
