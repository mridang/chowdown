import type { ReactElement } from 'react';

import { PanIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';
import type { Tone } from '@/lib/recipe/card-data';

/** Soft tints, so a missing photo is a quiet block of colour and not a loud one. */
const TINTS: Readonly<Record<Tone, string>> = {
  flame: 'bg-flame/15 text-flame',
  marigold: 'bg-marigold/30 text-ink',
  forest: 'bg-forest/15 text-forest',
  sand: 'bg-sand text-muted',
  ink: 'bg-ink/10 text-ink',
};

/**
 * The stand-in for a recipe photo: a tinted block with a pan on it. The caller
 * sets the shape with `className` (a ratio, `h-full w-full` inside a frame).
 */
export function TintTile({
  tone,
  className,
}: Readonly<{
  tone: Tone;
  className?: string;
}>): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn('grid place-items-center', TINTS[tone], className)}
    >
      <PanIcon className="h-1/4 w-1/4 opacity-40" strokeWidth={1.1} />
    </div>
  );
}
