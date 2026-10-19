'use client';

import { useRouter } from 'next/navigation';

import { Select } from '@/components/ui/field';

/**
 * The sort dropdown. Each option carries the URL that applies it, so choosing
 * one navigates there. Built on the shared `Select`; the caption is set in the
 * quieter `text-subtle` rather than `SelectField`'s `text-muted`, which is why
 * it brings its own label.
 */
export function SortSelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
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
