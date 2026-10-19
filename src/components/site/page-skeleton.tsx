import { Skeleton, SkeletonFrame } from '@/components/ui/skeleton';

/**
 * The grey placeholder shown while a signed-in page's content loads: a heading,
 * a search bar and a row of cards. Used by the route-level `loading.tsx` files
 * and wherever a page streams one part in behind a `Suspense` boundary.
 */
export function PageSkeleton() {
  return (
    <SkeletonFrame className="mx-auto w-full max-w-[90rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-12 w-2/3 max-w-md sm:h-14" />
      <Skeleton className="mt-8 h-14 w-full max-w-2xl" />
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} tone="block" className="h-64" />
        ))}
      </div>
    </SkeletonFrame>
  );
}
