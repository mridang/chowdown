import Link from 'next/link';

import { CheckIcon, ProteinIcon } from '@/components/icons';
import type {
  FacetData,
  FacetOptionData,
} from '@/components/recipes/search-query';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/components/ui/cn';
import { Difficulty } from '@/components/ui/difficulty';

/** One filter option: a tick box, the label (or a meter) and how many recipes match. */
function FacetOption({
  facet,
  option,
}: {
  facet: FacetData;
  option: FacetOptionData;
}) {
  return (
    <Link
      href={option.href}
      scroll={false}
      role="checkbox"
      aria-checked={option.active}
      className="rounded-control hover:bg-ink/5 focus-visible:outline-ink flex min-h-9 items-center gap-3 px-2 text-[15px] transition focus-visible:outline-2"
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border transition',
          option.active
            ? 'border-ink bg-ink text-white'
            : 'border-ink/40 bg-white',
        )}
      >
        {option.active ? <CheckIcon size="xs" strokeWidth={3} /> : null}
      </span>
      <span
        className={cn(
          'flex flex-1 items-center gap-2 truncate',
          option.active && 'font-semibold',
        )}
      >
        {facet.key === 'difficulty' ? (
          <Difficulty level={option.value} />
        ) : facet.key === 'protein' ? (
          <>
            <ProteinIcon
              size="sm"
              protein={option.value}
              className="text-subtle"
            />
            {option.label}
          </>
        ) : (
          option.label
        )}
      </span>
      <span className="text-subtle text-xs tabular-nums">{option.count}</span>
    </Link>
  );
}

/** A collapsible filter group: the title is the toggle, the options are links. */
export function FacetSection({
  facet,
  defaultOpen = false,
}: {
  facet: FacetData;
  defaultOpen?: boolean;
}) {
  const active = facet.options.filter((o) => o.active).length;
  return (
    <AccordionItem open={defaultOpen}>
      <AccordionTrigger className="px-2 text-sm font-semibold">
        <span className="flex items-center gap-2">
          {facet.title}
          {active > 0 ? (
            <span className="bg-ink inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs text-white">
              {active}
            </span>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col">
          {facet.options.map((option) => (
            <FacetOption key={option.value} facet={facet} option={option} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
