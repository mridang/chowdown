import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/current-user';

/** A single feature bullet on the landing page. */
function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

/**
 * The logged-out marketing landing page. Signed-in users are sent straight to
 * the app. Everyone else gets the pitch and a single "Sign in with Google"
 * call to action that kicks off the OAuth flow at `/api/auth/login`.
 */
export default async function Home() {
  if (await getCurrentUser()) {
    redirect('/app');
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-20">
      <section className="text-center">
        <p className="text-sm font-semibold tracking-wider text-amber-600 uppercase">
          🍳 chowdown
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Your recipes, in plain text, in your own Google Drive.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600">
          chowdown keeps your recipes as portable{' '}
          <a
            href="https://cooklang.org"
            className="font-medium text-amber-700 underline-offset-2 hover:underline"
          >
            Cooklang
          </a>{' '}
          files in a folder you own. Write, search and cook from them here — and
          plug your kitchen into any AI assistant with your own recipe MCP.
        </p>
        <div className="mt-8 flex justify-center">
          <a
            href="/api/auth/login"
            className="inline-flex items-center gap-2.5 rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                fill="#fff"
                d="M12 10.8v3.6h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1A9.3 9.3 0 0 0 21.3 12c0-.7-.1-1.3-.2-1.9H12Z"
              />
              <path
                fill="#fff"
                d="M12 21.3c2.5 0 4.6-.8 6.1-2.3l-3.1-2.4c-.8.6-1.9.9-3 .9-2.3 0-4.3-1.6-5-3.7H3.8v2.4A9.3 9.3 0 0 0 12 21.3Z"
                opacity=".85"
              />
            </svg>
            Sign in with Google
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          chowdown only touches the recipe files it creates — nothing else in
          your Drive.
        </p>
      </section>

      <section className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Feature
          title="Own your data"
          body="Every recipe is a real .cook file in your Drive. Edit it anywhere — here, in Drive, or any Cooklang tool. Leave any time, keep everything."
        />
        <Feature
          title="Cook, don't scroll"
          body="A clean view with ingredients, cookware and timers highlighted inline. Search across every recipe you've saved."
        />
        <Feature
          title="Bring your own AI"
          body="Get a personal MCP link to add to Claude or ChatGPT — capture ideas, log what you cooked, and ask what to make next."
        />
      </section>

      <footer className="mt-20 text-center text-xs text-slate-400">
        <a href="/privacy" className="hover:text-slate-600">
          Privacy
        </a>
      </footer>
    </main>
  );
}
