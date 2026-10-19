import { Skeleton, SkeletonFrame } from '@/components/ui/skeleton';

/**
 * The recipe list's shell, shown while the list itself loads: the heading, the
 * search box and a grid of card-shaped blocks, so nothing jumps when it arrives.
 */
export default function AppLoading() {
  return (
    <SkeletonFrame label="Loading your recipes">
      <div className="border-ink/10 border-b">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-12 w-48" />
          <Skeleton className="mt-6 h-14 w-full max-w-2xl" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-6 px-4 py-8 sm:px-6 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10 lg:px-10">
        <div className="hidden md:block">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="mb-3 h-10 w-full" />
          ))}
        </div>
        <div className="grid gap-5 min-[1700px]:grid-cols-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} tone="block" className="h-80" />
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}
