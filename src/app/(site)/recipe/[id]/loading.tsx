/**
 * Shown the instant a recipe card is clicked, while the page itself loads.
 * Because this boundary exists, Next can prefetch and display this shell
 * immediately on navigation instead of leaving the old page frozen until the
 * server responds. It mirrors the real page's layout so nothing jumps when the
 * content arrives.
 */
export default function RecipeLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl flex-1 animate-pulse px-4 py-6 sm:px-6"
      aria-busy="true"
      aria-label="Loading recipe"
    >
      <div className="h-5 w-28 rounded bg-slate-200" />
      <div className="mt-6 h-72 w-full rounded-xl bg-slate-200" />
      <div className="mt-6 h-9 w-2/3 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[18rem_1fr]">
        <div className="h-72 rounded-xl border border-slate-200 bg-white" />
        <div className="h-72 rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
