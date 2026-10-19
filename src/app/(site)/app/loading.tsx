import type { ReactElement } from 'react';

import { Container } from '@/components/ui/layout';
import { Skeleton, SkeletonFrame } from '@/components/ui/skeleton';

/** One key per placeholder row in the filter sidebar. */
const SIDEBAR_ROWS = [0, 1, 2, 3, 4] as const;

/** One key per placeholder recipe card. */
const CARDS = [0, 1, 2, 3, 4, 5] as const;

/**
 * The recipe list's shell, shown while the list itself loads: the heading, the
 * search box and a grid of card-shaped blocks, so nothing jumps when it arrives.
 */
export default function AppLoading(): ReactElement {
  return (
    <SkeletonFrame label="Loading your recipes">
      <div className="border-line border-b">
        <Container className="py-8 sm:py-12">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-12 w-48" />
          <Skeleton className="mt-6 h-14 w-full max-w-2xl" />
        </Container>
      </div>
      <Container className="grid grid-cols-1 gap-6 py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
        <div className="hidden md:block">
          {SIDEBAR_ROWS.map((i) => (
            <Skeleton key={i} className="mb-3 h-10 w-full" />
          ))}
        </div>
        <div className="grid gap-5 min-[1700px]:grid-cols-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {CARDS.map((i) => (
            <Skeleton key={i} tone="block" className="h-80" />
          ))}
        </div>
      </Container>
    </SkeletonFrame>
  );
}
