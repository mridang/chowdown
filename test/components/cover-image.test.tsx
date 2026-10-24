/* eslint-disable tailwindcss/no-custom-classname -- fixture class names that are not Tailwind classes. */
import { describe, expect, it } from '@jest/globals';

import { CoverImage, sizesFor } from '@/components/cover-image';
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
    expect(out).toMatch(/<img[^>]*src="\/img\?/);
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

describe('sizesFor', () => {
  const list = '(min-width: 640px) 50vw, 100vw';

  it('puts `auto` before the list for a lazy image that states its size', () => {
    expect(sizesFor(list, true, true)).toBe(`auto, ${list}`);
  });

  it('keeps the plain list for an eager image, which is chosen before layout', () => {
    expect(sizesFor(list, false, true)).toBe(list);
  });

  it('keeps the plain list when the image does not state its size', () => {
    expect(sizesFor(list, true, false)).toBe(list);
  });
});

describe('CoverImage sizes', () => {
  const props = {
    src: 'https://cdn.example.com/a.jpg',
    className: 'c',
    fallback: FALLBACK,
    sizes: '50vw',
  } as const;

  it('lets a lazy, sized image be measured by the browser, with the list as the fallback', () => {
    const out = html(<CoverImage {...props} width={640} height={480} />);
    expect(out).toContain('sizes="auto, 50vw"');
    expect(out).toContain('loading="lazy"');
  });

  it('keeps the explicit list on the page’s main photo', () => {
    const out = html(
      <CoverImage {...props} width={640} height={480} priority />,
    );
    expect(out).toContain('sizes="50vw"');
  });

  it('keeps the explicit list when no size is stated', () => {
    expect(html(<CoverImage {...props} />)).toContain('sizes="50vw"');
  });
});
