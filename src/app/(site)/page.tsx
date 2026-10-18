import { Dashboard } from '@/components/home/dashboard';
import { HomeLanding } from '@/components/landing/home-landing';
import { getShellUser } from '@/lib/auth/shell-user';

/**
 * The home page: a welcome and a way back into the recipes for someone signed
 * in, the pitch and a sign-in button for everyone else.
 */
export default async function Home() {
  const user = await getShellUser();
  return user ? <Dashboard user={user} /> : <HomeLanding />;
}
