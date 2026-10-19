'use client';

import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import { Select } from '@/components/ui/field';

/** One way to order the list: its value, its label and the address that applies it. */
export interface SortOption {
  readonly value: string;
  readonly label: string;
  readonly href: string;
}

/**
 * The sort dropdown. Each option carries the URL that applies it, so choosing
 * one navigates there. Built on the shared `Select`; the caption is set in the
 * quieter `text-subtle` rather than `SelectField`'s `text-muted`, which is why
 * it brings its own label.
 */
export function SortSelect({
  value,
  options,
}: Readonly<{
  /** The value of the order in force. */
  value: string;
  options: readonly SortOption[];
}>): ReactElement {
  const router = useRouter();
  return (
    <label className="text-subtle flex items-center gap-2.5 text-sm">
      <span>Sort</span>
      <Select
        value={value}
        onChange={(e) => {
          const chosen = options.find((o) => o.value === e.target.value);
          if (chosen) {
            router.push(chosen.href, { scroll: false });
          }
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
