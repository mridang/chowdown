import { cn } from './cn';

/** How many of the three bars each level fills. */
const LEVELS: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

/**
 * Difficulty as a small three-bar meter plus its name: Easy lights one bar,
 * Medium two, Hard all three. The bars rise left to right so the level reads at
 * a glance even without the word.
 */
export function Difficulty({
  level,
  showLabel = true,
  onDark = false,
  className,
}: {
  level: string;
  showLabel?: boolean;
  /** Draw the bars for a dark background (a selected chip). */
  onDark?: boolean;
  className?: string;
}) {
  const filled = LEVELS[level] ?? 1;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className="inline-flex items-end gap-[2px]"
        role="img"
        aria-label={`${level} difficulty, ${filled} of 3`}
      >
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              'w-[3px] rounded-[1px]',
              bar === 1 ? 'h-2' : bar === 2 ? 'h-3' : 'h-4',
              bar <= filled
                ? onDark
                  ? 'bg-marigold'
                  : 'bg-ember'
                : onDark
                  ? 'bg-white/35'
                  : 'bg-ink/20',
            )}
          />
        ))}
      </span>
      {showLabel ? <span>{level}</span> : null}
    </span>
  );
}
