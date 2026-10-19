import type { ReactElement } from 'react';

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
import { CountBadge } from '@/components/ui/chip';
import { cn } from '@/components/ui/cn';
import { Difficulty } from '@/components/ui/difficulty';
import { ToggleLink } from '@/components/ui/toggle-link';

/**
 * What names an option: the difficulty filter draws a flame meter, the protein
 * filter puts the protein's icon before the words, and every other filter is
 * just its label.
 */
function OptionLabel({
  facetKey,
  option,
}: Readonly<{
  facetKey: FacetData['key'];
  option: FacetOptionData;
}>): ReactElement {
  switch (facetKey) {
    case 'difficulty':
      return <Difficulty level={option.value} />;
    case 'protein':
      return (
        <>
          <ProteinIcon
            size="sm"
            protein={option.value}
            className="text-subtle"
          />
          {option.label}
        </>
      );
    default:
      return <>{option.label}</>;
  }
}

/** One filter option: a tick box, the label (or a meter) and how many recipes match. */
function FacetOption({
  facet,
  option,
}: Readonly<{
  facet: FacetData;
  option: FacetOptionData;
}>): ReactElement {
  return (
    <ToggleLink
      href={option.href}
      active={option.active}
      activeText="selected"
      className="rounded-control hover:bg-ink/5 flex min-h-9 items-center gap-3 px-2 text-[15px] transition focus-ring-flush"
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border transition',
          option.active
            ? 'border-ink bg-ink text-white'
            : 'border-field bg-white',
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
        <OptionLabel facetKey={facet.key} option={option} />
      </span>
      <span className="text-subtle text-xs tabular-nums">{option.count}</span>
    </ToggleLink>
  );
}

/** A collapsible filter group: the title is the toggle, the options are links. */
export function FacetSection({
  facet,
  defaultOpen = false,
}: Readonly<{
  facet: FacetData;
  defaultOpen?: boolean;
}>): ReactElement {
  const active = facet.options.filter((o) => o.active).length;
  return (
    <AccordionItem open={defaultOpen}>
      <AccordionTrigger className="px-2 text-sm font-semibold">
        <span className="flex items-center gap-2">
          {facet.title}
          {active > 0 ? <CountBadge>{active}</CountBadge> : null}
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
