'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { preload } from 'react-dom';

import {
  coverSrc,
  coverSrcSet,
  isFetchableImageUrl,
} from '@/lib/images/cover-proxy';

/**
 * The `sizes` attribute for an image: for one that loads lazily, `auto` first,
 * so a browser that supports it (Chrome 126, Firefox 150, Safari 27) picks the
 * file from the width the image really has once laid out, which is always right
 * and needs no hand-kept list; `fallback` follows it for every other browser,
 * which skips the keyword they do not know and reads the list. `auto` is only
 * allowed on a lazy image that states its width and height (without them the
 * browser has no layout to measure before the file arrives), and the eager
 * hero photo is chosen before layout exists, so those keep the plain list.
 *
 * @param fallback The media-condition list that describes the layout.
 * @param lazy Whether the image loads lazily.
 * @param sized Whether the image states its width and height.
 */
export function sizesFor(
  fallback: string,
  lazy: boolean,
  sized: boolean,
): string {
  return lazy && sized ? `auto, ${fallback}` : fallback;
}

/**
 * A recipe cover image that degrades gracefully. Covers belong to the recipe's
 * source site, so they are loaded through our own `/api/cover-images` (scaled,
 * cached, and without handing the site your cookies or referrer), at the widths
 * in `widths` so a phone doesn't download a desktop-sized photo. Any of them can
 * still break (the site goes down, the file moves); when the image fails to
 * load we render `fallback` instead of the browser's empty broken-image box.
 *
 * Images load lazily by default. The one photo at the top of a page can pass
 * `priority` so it loads straight away at high priority instead, which is what
 * keeps the largest-contentful-paint photo quick.
 */
export function CoverImage({
  src,
  className,
  fallback,
  alt = '',
  priority = false,
  width,
  height,
  widths = [320, 480, 640],
  sizes = '(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw',
}: Readonly<{
  src: string;
  className: string;
  /** What to show if the image fails to load. */
  fallback: ReactNode;
  alt?: string;
  /** Load immediately at high priority (the page's hero photo only). */
  priority?: boolean;
  /** The image's intrinsic size, so the browser can reserve its space. */
  width?: number;
  height?: number;
  /** The widths to offer the browser, in pixels. */
  widths?: readonly number[];
  /**
   * How wide the image is laid out, so the browser can pick one. Lazy images
   * with a stated size get `auto` in front of it (see {@link sizesFor}), so this
   * list is what browsers without `sizes="auto"` use.
   */
  sizes?: string;
}>): ReactElement {
  const [failed, setFailed] = useState(false);
  const proxied = isFetchableImageUrl(src);
  const largestWidth = widths.at(-1);
  const largest =
    proxied && largestWidth !== undefined ? coverSrc(src, largestWidth) : src;
  if (priority && !failed) {
    // Tell the browser about the page's main photo in the head, before it has
    // read as far as the <img>, so it starts downloading at once.
    preload(largest, {
      as: 'image',
      imageSrcSet: proxied ? coverSrcSet(src, widths) : undefined,
      imageSizes: proxied ? sizes : undefined,
      fetchPriority: 'high',
    });
  }
  if (failed) {
    return <>{fallback}</>;
  }
  return (
    <img
      src={largest}
      srcSet={proxied ? coverSrcSet(src, widths) : undefined}
      sizes={
        proxied
          ? sizesFor(
              sizes,
              !priority,
              width !== undefined && height !== undefined,
            )
          : undefined
      }
      alt={alt}
      width={width}
      height={height}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? undefined : 'async'}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
