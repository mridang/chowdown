import { Skeleton, SkeletonFrame } from '@/components/ui/skeleton';
import { Container } from '@/components/ui/layout';

/**
 * Shown the instant a recipe card is clicked, while the page itself loads.
 * Because this boundary exists, Next can prefetch and display this shell
 * immediately on navigation instead of leaving the old page frozen until the
 * server responds. It mirrors the real page's layout (split hero, facts, then
 * ingredients beside the method) so nothing jumps when the content arrives.
 */
export default function RecipeLoading() {
  return (
    <SkeletonFrame label="Loading recipe">
      <div className="border-ink/10 border-b">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <Skeleton
            shape="square"
            className="aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[32rem]"
          />
          <div className="px-4 py-8 sm:px-6 lg:order-1 lg:py-14 lg:pr-16 lg:pl-10">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 h-4 w-32" />
            <Skeleton className="mt-4 h-12 w-4/5 sm:h-16" />
            <Skeleton className="mt-3 h-12 w-2/3 sm:h-16" />
            <Skeleton className="mt-6 h-8 w-56" />
            <div className="mt-7 flex gap-2.5">
              <Skeleton className="h-12 w-36" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>
      </div>
      <Container>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3.5">
              <Skeleton className="h-11 w-11 shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-5 w-28" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-[19rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-20">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-4 h-12 w-full" />
            <div className="mt-4 flex flex-col gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </div>
          <div className="flex max-w-3xl flex-col gap-8">
            <Skeleton className="h-8 w-32" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-5">
                <Skeleton shape="circle" className="h-9 w-9 shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="mt-2 h-5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </SkeletonFrame>
  );
}
