'use client';

import * as ToggleGroup from '@radix-ui/react-toggle-group';

import { cn } from './cn';

/**
 * A segmented control: one option selected at a time (units, view mode). Built
 * on Radix's toggle group, so it is a proper radio-like group for keyboards and
 * screen readers. Selecting the active option does nothing, never deselects.
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
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        if (next) {
          onValueChange(next as T);
        }
      }}
      className="rounded-control border-ink/20 inline-flex border bg-white p-0.5"
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            'h-8 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-medium transition',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
            'data-[state=on]:bg-ink data-[state=on]:text-white data-[state=off]:text-ink/75 data-[state=off]:hover:bg-ink/5',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
