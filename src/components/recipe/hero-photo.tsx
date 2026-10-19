'use client';

import { useState, type ReactElement } from 'react';

import { CoverImage } from '@/components/cover-image';
import { cn } from '@/components/ui/cn';
import { TintTile } from '@/components/ui/tint-tile';
import type { Tone } from '@/lib/recipe/card-data';

/**
 * The recipe's big photo. The caller sets the shape with `className` (an aspect
 * ratio or a height); the photo fills it, so the space is reserved before the
 * image arrives and nothing jumps.
 *
 * The first photo is the page's hero, so it loads straight away at high
 * priority. When a recipe has more than one photo a strip of thumbnails sits
 * over the bottom edge to switch between them; a recipe without any gets a soft
 * colour tile instead.
 */
export function HeroPhoto({
  images,
  title,
  tone,
  className,
}: Readonly<{
  /** Photo addresses, the cover first. */
  images: readonly string[];
  title: string;
  tone: Tone;
  className?: string;
}>): ReactElement {
  const [index, setIndex] = useState(0);
  // What a recipe without a photo (or with a broken one) shows instead.
  const tile = <TintTile tone={tone} className="h-full w-full" />;
  const current = images[index];
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {current ? (
        <CoverImage
          key={current}
          src={current}
          alt={`Photo of ${title}`}
          width={1280}
          height={800}
          priority={index === 0}
          widths={[640, 960, 1280]}
          sizes="(min-width: 1024px) 50vw, 100vw"
          fallback={<div className="absolute inset-0">{tile}</div>}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0">{tile}</div>
      )}

      {images.length > 1 ? (
        <div
          role="group"
          aria-label="Photos"
          className="bg-paper/90 rounded-card absolute right-3 bottom-3 left-3 flex max-w-max gap-1.5 overflow-x-auto p-1.5 print:hidden"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'rounded-control focus-visible:outline-ink relative h-12 w-12 shrink-0 overflow-hidden border-2 transition focus-visible:outline-2 focus-visible:outline-offset-1',
                i === index ? 'border-flame' : 'border-transparent',
              )}
            >
              <CoverImage
                src={src}
                width={96}
                height={96}
                widths={[320]}
                sizes="48px"
                fallback={<span className="bg-ink/10 absolute inset-0" />}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
