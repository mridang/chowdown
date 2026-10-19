import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';
import { Skeleton, SkeletonFrame } from '@/components/ui/skeleton';

/** The four card-shaped blocks the placeholder shows, as keys. */
const CARDS = [0, 1, 2, 3] as const;

/**
 * The grey placeholder shown while a signed-in page's content loads: a heading,
 * a search bar and a row of cards. Used by the route-level `loading.tsx` files
 * and wherever a page streams one part in behind a `Suspense` boundary.
 */
export function PageSkeleton(): ReactElement {
  return (
    <SkeletonFrame>
      <Container className="py-10 sm:py-14">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-12 w-2/3 max-w-md sm:h-14" />
        <Skeleton className="mt-8 h-14 w-full max-w-2xl" />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card) => (
            <Skeleton key={card} tone="block" className="h-64" />
          ))}
        </div>
      </Container>
    </SkeletonFrame>
  );
}
