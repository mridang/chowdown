'use client';

import { useState } from 'react';

/**
 * A recipe cover image that degrades gracefully. Covers are hotlinked from the
 * recipe's source site, so any of them can later break (the site goes down, the
 * file moves, or it is served over plain http). When the image fails to load we
 * render `fallback` instead of the browser's empty broken-image box.
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
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <>{fallback}</>;
  }
  return (
    <img
      src={src}
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
