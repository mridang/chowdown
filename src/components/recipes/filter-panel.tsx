import type { ReactElement } from 'react';

import { Accordion } from '@/components/ui/accordion';
import { FacetSection } from '@/components/ui/facet';
import type { FacetData, FacetKey } from '@/components/recipes/search-query';

/** The groups that start open even when nothing in them is switched on. */
const OPEN_BY_DEFAULT: readonly FacetKey[] = [
  'difficulty',
  'time',
  'protein',
  'diet_type',
];

/** Whether a group starts open: a key one, or one with a filter switched on. */
function startsOpen(facet: FacetData): boolean {
  return (
    OPEN_BY_DEFAULT.includes(facet.key) || facet.options.some((o) => o.active)
  );
}

/**
 * Every filter as a collapsible group. The groups that matter most (difficulty,
 * time, protein, diet) start open, along with any group that has a filter switched on;
 * the rest start closed so the list stays short.
 */
export function FilterPanel({
  facets,
}: Readonly<{ facets: readonly FacetData[] }>): ReactElement {
  return (
    <Accordion className="border-t border-line">
      {facets.map((facet) => (
        <FacetSection
          key={facet.key}
          facet={facet}
          defaultOpen={startsOpen(facet)}
        />
      ))}
    </Accordion>
  );
}
