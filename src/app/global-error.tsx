'use client';

import './globals.css';

/**
 * The last resort: shown when the root layout itself fails, so nothing else on
 * the page can be relied on. It stands alone, with its own document, the global
 * styles and plain markup (no shared components), and falls back to system
 * fonts because the font loader lives in the layout that just failed.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-paper text-ink flex min-h-full flex-col font-sans">
        <title>Something went wrong · chowdown</title>
        <div className="bg-marigold h-1.5" />
        <main
          id="main"
          className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 sm:px-6"
        >
          <p className="text-label text-ember font-semibold uppercase">
            Something went wrong
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            That didn&apos;t work
          </h1>
          <p className="text-ink/75 mt-5 text-lg leading-relaxed">
            chowdown hit a problem it could not recover from. Try again in a
            moment, and your recipes will still be in your Drive either way.
          </p>
          {error.digest ? (
            <p className="text-ink/65 mt-3 font-mono text-sm">
              Reference: {error.digest}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="rounded-control bg-ink hover:bg-ink/85 focus-visible:outline-ink inline-flex h-12 items-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Try again
            </button>
            {/* A plain link: this page has no router to rely on. */}
            <a
              href="/"
              className="rounded-control border-ink/25 hover:border-ink focus-visible:outline-ink inline-flex h-12 items-center border bg-white px-6 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Back to the home page
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
