'use client';

import { useRouter } from 'next/navigation';

import { ChevronIcon } from '@/components/icons';

/** The sort dropdown. Each option carries the URL that applies it. */
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
      <span className="relative">
        <select
          value={value}
          onChange={(e) => {
            const chosen = options.find((o) => o.value === e.target.value);
            if (chosen) {
              router.push(chosen.href, { scroll: false });
            }
          }}
          className="rounded-control border-ink/25 text-ink hover:border-ink focus:border-ink h-10 appearance-none border bg-white pr-9 pl-3 text-sm font-medium transition outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronIcon
          size="sm"
          className="text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        />
      </span>
    </label>
  );
}
