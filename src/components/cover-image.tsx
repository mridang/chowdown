'use client';

import { useState } from 'react';
import { preload } from 'react-dom';

import {
  coverSrc,
  coverSrcSet,
  isFetchableImageUrl,
} from '@/lib/images/cover-proxy';

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
}: {
  src: string;
  className: string;
  /** What to show if the image fails to load. */
  fallback: React.ReactNode;
  alt?: string;
  /** Load immediately at high priority (the page's hero photo only). */
  priority?: boolean;
  /** The image's intrinsic size, so the browser can reserve its space. */
  width?: number;
  height?: number;
  /** The widths to offer the browser, in pixels. */
  widths?: readonly number[];
  /** How wide the image is laid out, so the browser can pick one. */
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = isFetchableImageUrl(src);
  const largest = proxied ? coverSrc(src, widths[widths.length - 1]!) : src;
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
      sizes={proxied ? sizes : undefined}
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
