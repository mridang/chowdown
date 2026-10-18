/**
 * Shown the instant a page is chosen, while its content loads. Because this
 * boundary exists, Next can prefetch and show this shell straight away on
 * navigation instead of leaving the old page frozen until the server answers.
 * Pages with a more specific layout have their own `loading.tsx`.
 */
export default function SiteLoading() {
  const bar = 'rounded-control bg-ink/10';
  return (
    <div
      className="mx-auto w-full max-w-[90rem] animate-pulse px-4 py-10 motion-reduce:animate-none sm:px-6 sm:py-14 lg:px-10"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>
      <div className={`${bar} h-4 w-32`} />
      <div className={`${bar} mt-4 h-12 w-2/3 max-w-md sm:h-14`} />
      <div className={`${bar} mt-8 h-14 w-full max-w-2xl`} />
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-ink/5 rounded-card h-64" />
        ))}
      </div>
    </div>
  );
}
