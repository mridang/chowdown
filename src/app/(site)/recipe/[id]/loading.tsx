/**
 * Shown the instant a recipe card is clicked, while the page itself loads.
 * Because this boundary exists, Next can prefetch and display this shell
 * immediately on navigation instead of leaving the old page frozen until the
 * server responds. It mirrors the real page's layout (split hero, facts, then
 * ingredients beside the method) so nothing jumps when the content arrives.
 */
export default function RecipeLoading() {
  const bar = 'rounded-control bg-ink/10';
  return (
    <div
      className="animate-pulse motion-reduce:animate-none"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading recipe</span>
      <div className="border-ink/10 border-b">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="bg-ink/10 aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[32rem]" />
          <div className="px-4 py-8 sm:px-6 lg:order-1 lg:py-14 lg:pr-16 lg:pl-10">
            <div className={`${bar} h-5 w-40`} />
            <div className={`${bar} mt-6 h-4 w-32`} />
            <div className={`${bar} mt-4 h-12 w-4/5 sm:h-16`} />
            <div className={`${bar} mt-3 h-12 w-2/3 sm:h-16`} />
            <div className={`${bar} mt-6 h-8 w-56`} />
            <div className="mt-7 flex gap-2.5">
              <div className={`${bar} h-12 w-36`} />
              <div className={`${bar} h-10 w-32`} />
              <div className={`${bar} h-10 w-24`} />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10">
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className={`${bar} h-11 w-11 shrink-0`} />
              <div className="flex-1">
                <div className={`${bar} h-3 w-20`} />
                <div className={`${bar} mt-2 h-5 w-28`} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-[19rem_minmax(0,1fr)] lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-20">
          <div>
            <div className={`${bar} h-8 w-40`} />
            <div className={`${bar} mt-4 h-12 w-full`} />
            <div className="mt-4 flex flex-col gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`${bar} h-6 w-full`} />
              ))}
            </div>
          </div>
          <div className="flex max-w-3xl flex-col gap-8">
            <div className={`${bar} h-8 w-32`} />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-5">
                <div className="bg-ink/10 h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1">
                  <div className={`${bar} h-5 w-full`} />
                  <div className={`${bar} mt-2 h-5 w-3/4`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
