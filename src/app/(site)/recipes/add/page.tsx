import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/current-user';

import { AddRecipesPage } from './_components/add-recipes-page';

export const metadata: Metadata = { title: 'Add recipes · chowdown' };

/**
 * The "Add recipes" page — its own route, not a panel on `/app`. Auth-gates,
 * then hands off to the client flow that lets the user choose how to add
 * recipes (import links/text, or write one by hand).
 */
export default async function AddRecipesRoute() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }
  return <AddRecipesPage />;
}
