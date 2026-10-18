import { Accordion } from './ui/accordion';
import { FacetSection } from './ui/facet';
import type { FacetData } from './search-query';

/**
 * Every filter as a collapsible group. The groups that matter most (difficulty,
 * time, protein) start open, along with any group that has a filter switched on;
 * the rest start closed so the list stays short.
 */
export function FilterPanel({ facets }: { facets: FacetData[] }) {
  const open = facets
    .filter(
      (f) =>
        ['difficulty', 'time', 'protein'].includes(f.key) ||
        f.options.some((o) => o.active),
    )
    .map((f) => f.key);
  return (
    <Accordion
      type="multiple"
      defaultValue={open}
      className="border-ink/10 border-t"
    >
      {facets.map((facet) => (
        <FacetSection key={facet.key} facet={facet} />
      ))}
    </Accordion>
  );
}
