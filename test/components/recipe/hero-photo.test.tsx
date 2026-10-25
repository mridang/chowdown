import { describe, expect, it } from '@jest/globals';

import { HeroPhoto } from '@/components/recipe/hero-photo';
import { html } from '../render';

describe('HeroPhoto', () => {
  it('shows a tinted tile in the recipe colour when there is no photo', () => {
    const out = html(<HeroPhoto images={[]} title="Dal" tone="forest" />);
    expect(out).toContain('bg-forest/15');
    expect(out).toContain('size-full');
    expect(out).not.toContain('<img');
  });

  it('shows the cover with a description when there is a photo', () => {
    const out = html(
      <HeroPhoto
        images={['https://example.com/dal.jpg']}
        title="Dal"
        tone="sand"
      />,
    );
    expect(out).toContain('alt="Photo of Dal"');
    expect(out).not.toContain('aria-pressed');
  });

  it('adds a strip to switch photos only when there is more than one', () => {
    const out = html(
      <HeroPhoto
        images={['https://example.com/1.jpg', 'https://example.com/2.jpg']}
        title="Dal"
        tone="sand"
      />,
    );
    expect(out).toContain('aria-label="Photos"');
    expect(out).toContain('Show photo 2 of 2');
  });

  it('scrolls the strip inside itself and snaps the thumbnails, rather than widening the page', () => {
    const out = html(
      <HeroPhoto
        images={['https://example.com/1.jpg', 'https://example.com/2.jpg']}
        title="Dal"
        tone="sand"
      />,
    );
    const strip =
      /<div[^>]*aria-label="Photos"[^>]*class="([^"]*)"/.exec(out)?.[1] ??
      /<div[^>]*class="([^"]*)"[^>]*aria-label="Photos"/.exec(out)?.[1];
    expect(strip).toContain('overflow-x-auto');
    expect(strip).toContain('max-w-max');
    expect(strip).toContain('snap-x');
    expect(out).toContain('snap-start');
  });
});
