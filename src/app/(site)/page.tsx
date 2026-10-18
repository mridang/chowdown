import type { Metadata } from 'next';

import { Dashboard } from '@/components/home/dashboard';
import { HomeLanding } from '@/components/landing/home-landing';
import { getShellUser } from '@/lib/auth/shell-user';

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
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getShellUser();
  if (user) {
    return <Dashboard user={user} />;
  }
  // `?error=auth` is where a failed Google sign-in lands.
  const signInFailed = (await searchParams)['error'] === 'auth';
  return <HomeLanding signInFailed={signInFailed} />;
}
