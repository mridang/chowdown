import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy — chowdown',
  robots: { index: true, follow: true },
};

/**
 * Privacy policy. Required for the Google OAuth consent screen / production
 * publishing, and a plain statement of exactly what chowdown touches. Kept
 * deliberately short and concrete.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-slate-700 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">
        Last updated: 11 October 2026
      </p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        <p>
          chowdown is a personal recipe app. It stores your recipes as Cooklang
          (<code>.cook</code>) files in your own Google Drive. This policy
          explains what it accesses and keeps.
        </p>

        <section>
          <h2 className="font-semibold text-slate-900">What we access</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Your Google account’s basic identity (name, email, profile
              picture) — to sign you in.
            </li>
            <li>
              Google Drive, using the <code>drive.file</code> scope only. This
              grants access{' '}
              <strong>
                solely to the recipe files chowdown itself creates
              </strong>{' '}
              in a “Recipes” folder — never the rest of your Drive.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">What we store</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your name, email and Google account id.</li>
            <li>
              A Google refresh token, <strong>encrypted at rest</strong>, so the
              app can sync your recipes when you’re away.
            </li>
            <li>
              A cached copy of your recipe files, to make the app and your MCP
              link fast. Your Drive remains the source of truth.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">What we don’t do</h2>
          <p className="mt-2">
            We don’t sell or share your data, show ads, or access anything in
            your Drive beyond the recipe files the app created. Your recipe data
            is never used to train any model.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Deleting your data</h2>
          <p className="mt-2">
            Remove chowdown’s access at{' '}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-amber-700 underline-offset-2 hover:underline"
            >
              your Google account permissions
            </a>
            , and email us to delete your stored record. Your <code>.cook</code>{' '}
            files always remain yours in your Drive.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-900">Contact</h2>
          <p className="mt-2">mridang.agarwalla@gmail.com</p>
        </section>
      </div>

      <p className="mt-10 text-xs text-slate-400">
        <a href="/" className="hover:text-slate-600">
          ← Back to chowdown
        </a>
      </p>
    </main>
  );
}
