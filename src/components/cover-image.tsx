'use client';

import { useState } from 'react';

/**
 * A recipe cover image that degrades gracefully. Covers are hotlinked from the
 * recipe's source site, so any of them can later break (the site goes down, the
 * file moves, or it is served over plain http). When the image fails to load we
 * render `fallback` instead of the browser's empty broken-image box.
 */
export function CoverImage({
  src,
  className,
  fallback,
  alt = '',
}: {
  src: string;
  className: string;
  /** What to show if the image fails to load. */
  fallback: React.ReactNode;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <>{fallback}</>;
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
