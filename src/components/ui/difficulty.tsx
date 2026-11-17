import { cn } from '@/components/ui/cn';
import type { ReactElement } from 'react';

/** How many of the three bars each level fills; an unknown level fills one. */
const LEVELS = new Map<string, number>(
  Object.entries({
    Easy: 1,
    Medium: 2,
    Hard: 3,
  }),
);

/** The height of each bar, left to right: they rise so the level reads at a glance. */
const BAR_HEIGHTS = ['h-2', 'h-3', 'h-4'] as const;

/**
 * Difficulty as a small three-bar meter plus its name: Easy lights one bar,
 * Medium two, Hard all three. The bars rise left to right so the level reads at
 * a glance even without the word.
 */
export function Difficulty({
  level,
  showLabel = true,
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className,
}: Readonly<{
  /** `Easy`, `Medium` or `Hard`. */
  level: string;
  /** Show the word beside the bars; off where the bars alone are enough. */
  showLabel?: boolean;
  // eslint-disable-next-line unicorn/no-keyword-prefix -- className is the React prop name
  className?: string;
}>): ReactElement {
  const filled = LEVELS.get(level) ?? 1;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- the bars are drawn from elements, and an img element cannot hold children */}
      <span
        className="inline-flex items-end gap-[2px]"
        role="img"
        aria-label={`${level} difficulty, ${filled} of 3`}
      >
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className={cn(
              'w-[3px] rounded-[1px]',
              height,
              index < filled ? 'bg-ember' : 'bg-ink/20',
            )}
          />
        ))}
      </span>
      {showLabel ? <span>{level}</span> : null}
    </span>
  );
}
