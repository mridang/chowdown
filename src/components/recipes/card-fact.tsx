import type { ReactElement, ReactNode } from 'react';

/**
 * An icon with a short value, used for the facts along the foot of a recipe
 * card (time, difficulty, protein). Not to be confused with the recipe page's
 * larger `Fact` in `components/recipe/fact.tsx`, which sits in a definition list.
 */
export function CardFact({
  icon,
  children,
}: Readonly<{
  icon: ReactNode;
  children: ReactNode;
}>): ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-subtle">
      {icon}
      {children}
    </span>
  );
}
