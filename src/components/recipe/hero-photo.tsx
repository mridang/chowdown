'use client';

import { useState } from 'react';

import { CoverImage } from '@/components/cover-image';
import { PanIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import type { Tone } from '@/lib/recipe/card-data';

/** The soft tint a recipe without a photo (or with a broken one) wears. */
const TINTS: Record<Tone, string> = {
  flame: 'bg-flame/15 text-flame',
  marigold: 'bg-marigold/30 text-ink',
  forest: 'bg-forest/15 text-forest',
  sand: 'bg-sand text-muted',
  ink: 'bg-ink/10 text-ink',
};

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
}: {
  /** Photo addresses, the cover first. */
  images: string[];
  title: string;
  tone: Tone;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const tile = (
    <div className={cn('grid h-full w-full place-items-center', TINTS[tone])}>
      <PanIcon className="h-1/4 w-1/4 opacity-40" strokeWidth={1.1} />
    </div>
  );
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
