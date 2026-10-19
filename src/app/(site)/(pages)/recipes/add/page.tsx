import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { DriveConnectPanel } from '@/components/site/drive-connect';
import { Container } from '@/components/ui/layout';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isDriveConnected, wasDriveConnected } from '@/lib/auth/drive-access';

import { AddRecipesPage } from './_components/add-recipes-page';

/** The tab title of the Add recipes page. */
export const metadata: Metadata = { title: 'Add recipes · chowdown' };

/**
 * The "Add recipes" page, its own route and not a panel on `/app`. Auth-gates
 * (sending anyone signed out to sign in and then straight back here), asks
 * anyone who hasn't connected their Google Drive to do that first (there is
 * nowhere to save a recipe until they have), then hands off to the client flow
 * that lets the user choose how to add recipes (import links/text, or write
 * one by hand).
 */
export default async function AddRecipesRoute(): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/api/auth/login?returnTo=${encodeURIComponent('/recipes/add')}`);
  }
  if (!isDriveConnected(user)) {
    return (
      <Container className="py-12">
        <DriveConnectPanel
          heading="h1"
          reconnect={wasDriveConnected(user)}
          returnTo="/recipes/add"
        />
      </Container>
    );
  }
  return <AddRecipesPage />;
}
