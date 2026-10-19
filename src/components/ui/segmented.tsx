'use client';

import { useId } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * A segmented control: one option selected at a time (units, view mode). It is a
 * group of native radio buttons, so arrow keys, focus and screen-reader roles are
 * the browser's own, and there is nothing to download.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="rounded-control border-ink/20 inline-flex border bg-white p-0.5"
    >
      {options.map((option) => (
        <label key={option.value} className="relative">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onValueChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'flex h-8 cursor-pointer items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-medium transition',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ink',
              'text-muted hover:bg-ink/5 peer-checked:bg-ink peer-checked:text-white peer-checked:hover:bg-ink',
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
