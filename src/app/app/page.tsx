import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/current-user';

import { RecipeApp } from './_components/recipe-app';

/**
 * The authenticated app. A thin server gate: resolve the signed-in user (or
 * bounce to the landing page) and hand the interactive surface the identity it
 * needs — their display name and personal MCP link.
 */
export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }
  return (
    <RecipeApp
      userName={user.name ?? user.email}
      mcpToken={user.mcp_token}
    />
  );
}
