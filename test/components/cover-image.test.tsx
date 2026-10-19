import { describe, expect, it } from '@jest/globals';

import { CoverImage } from '../../src/components/cover-image';
import { html } from './render';

const FALLBACK = <p>No photo</p>;

describe('CoverImage', () => {
  it('loads a recipe site’s photo through our own image route, at several widths', () => {
    const out = html(
      <CoverImage
        src="https://cdn.example.com/a.jpg"
        className="cover"
        fallback={FALLBACK}
        alt="Tacos"
      />,
    );
    expect(out).toMatch(/<img[^>]*src="\/api\/cover-images\?/);
    expect(out).toMatch(/srcSet="[^"]*320w[^"]*480w[^"]*640w/);
    expect(out).toContain('alt="Tacos"');
    expect(out).toContain('class="cover"');
  });

  it('keeps the person’s cookies and referrer away from the recipe’s site', () => {
    const out = html(
      <CoverImage
        src="https://cdn.example.com/a.jpg"
        className="c"
        fallback={FALLBACK}
      />,
    );
    expect(out).toContain('referrerPolicy="no-referrer"');
  });

  it('loads lazily, unless it is the page’s main photo', () => {
    const lazy = html(
      <CoverImage
        src="https://cdn.example.com/a.jpg"
        className="c"
        fallback={FALLBACK}
      />,
    );
    expect(lazy).toContain('loading="lazy"');
    const eager = html(
      <CoverImage
        src="https://cdn.example.com/a.jpg"
        className="c"
        fallback={FALLBACK}
        priority
      />,
    );
    expect(eager).toContain('loading="eager"');
    expect(eager).toContain('fetchPriority="high"');
  });

  it('shows an image that is not ours to proxy as it is', () => {
    const out = html(
      <CoverImage src="/local/photo.jpg" className="c" fallback={FALLBACK} />,
    );
    expect(out).toContain('src="/local/photo.jpg"');
    expect(out).not.toContain('srcSet');
  });

  it('describes a decorative photo with empty alt text', () => {
    const out = html(
      <CoverImage src="/local/photo.jpg" className="c" fallback={FALLBACK} />,
    );
    expect(out).toContain('alt=""');
  });

  it('can be told the size of the image so the page does not jump', () => {
    const out = html(
      <CoverImage
        src="/local/photo.jpg"
        className="c"
        fallback={FALLBACK}
        width={640}
        height={480}
      />,
    );
    expect(out).toContain('width="640"');
    expect(out).toContain('height="480"');
  });
});
