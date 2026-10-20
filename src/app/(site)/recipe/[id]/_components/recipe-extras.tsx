import type { ReactElement } from 'react';

import { isAuthorKey } from './byline';

/**
 * Whatever else the recipe's file says that the page has no place for (a
 * yield, anything typed by hand), as a quiet list of "name value" pairs under
 * the tags, so no line of a recipe is hidden. The author is not listed here:
 * it is in the byline under the title. Draws nothing when there is nothing
 * left over.
 */
export function RecipeExtras({
  extras,
}: Readonly<{
  /** The leftover metadata as `[name, value]` pairs, in file order. */
  extras: readonly (readonly [name: string, value: string])[];
}>): ReactElement | null {
  const shown = extras.filter(([name]) => !isAuthorKey(name));
  if (shown.length === 0) {
    return null;
  }
  return (
    <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
      {shown.map(([name, value]) => (
        <div key={name} className="flex gap-1.5">
          <dt className="font-semibold capitalize">{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
