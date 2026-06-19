/** Page title + one-line description for the Cooklang viewer. */
export function Header() {
  return (
    <header className="mb-5 sm:mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        🍳 chowdown
      </h1>
      <p className="mt-0.5 text-[13px] text-slate-500">
        A viewer for Cooklang{' '}
        <code className="rounded bg-slate-100 px-1">.cook</code> recipes, opened
        from Google Drive.
      </p>
    </header>
  );
}
