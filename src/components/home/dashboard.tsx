import type { ShellUser } from '@/lib/auth/shell-user';

/** The signed-in home. (Placeholder: being built.) */
export async function Dashboard({ user }: { user: ShellUser }) {
  return <p className="p-8">Welcome back, {user.firstName}</p>;
}
