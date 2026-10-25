import type { Metadata } from 'next';
import { Suspense, type ReactElement } from 'react';

import { Dashboard } from '@/components/home/dashboard';
import { HomeLanding } from '@/components/landing/home-landing';
import { PageSkeleton } from '@/components/site/page-skeleton';
import { getShellUser } from '@/lib/core/auth/shell-user';

/**
 * The same address serves two pages: the landing page for visitors, which
 * search engines may index, and the dashboard for someone signed in, which they
 * may not. (A crawler is never signed in, but the tag should still be right.)
 * The title, description and social card come from the root layout.
 */
export async function generateMetadata(): Promise<Metadata> {
  const signedIn = (await getShellUser()) !== null;
  return signedIn
    ? { robots: { index: false, follow: false } }
    : { robots: { index: true, follow: true }, alternates: { canonical: '/' } };
}

/**
 * The home page: a welcome and a way back into the recipes for someone signed
 * in, the pitch and a sign-in button for everyone else.
 */
export default async function Home({
  searchParams,
}: Readonly<{
  searchParams: Promise<
    Readonly<Record<string, string | readonly string[] | undefined>>
  >;
}>): Promise<ReactElement> {
  const user = await getShellUser();
  if (user) {
    // The dashboard reads the person's recipes, so it streams in behind a
    // placeholder. The landing page below needs no data and must be in the
    // first HTML as it is.
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard user={user} />
      </Suspense>
    );
  }
  // `?error=auth` is where a failed Google sign-in lands.
  const signInFailed = (await searchParams)['error'] === 'auth';
  return <HomeLanding signInFailed={signInFailed} />;
}
