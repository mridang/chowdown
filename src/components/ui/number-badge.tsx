import { cn } from '@/components/ui/cn';

const SIZES = {
  sm: 'h-7 w-7 text-sm',
  md: 'h-9 w-9 text-base',
  lg: 'h-12 w-12 text-xl',
} as const;

const TONES = {
  flame: 'bg-flame text-ink',
  quiet: 'bg-ink/10 text-ink/70',
} as const;

/**
 * The numbered circle beside a step. Purely decorative: the list it sits in
 * (an `ol`) already numbers its items for assistive technology.
 */
export function NumberBadge({
  value,
  size = 'sm',
  tone = 'flame',
  className,
}: {
  value: number;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {value}
    </span>
  );
}
