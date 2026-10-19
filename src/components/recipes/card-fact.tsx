import type { ReactNode } from 'react';

/**
 * An icon with a short value, used for the facts along the foot of a recipe
 * card (time, difficulty, protein). Not to be confused with the recipe page's
 * larger `Fact` in `components/recipe/fact.tsx`, which sits in a definition list.
 */
export function CardFact({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="text-subtle inline-flex items-center gap-1.5 text-[13px]">
      {icon}
      {children}
    </span>
  );
}
