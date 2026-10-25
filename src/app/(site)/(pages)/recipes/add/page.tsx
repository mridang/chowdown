import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { DriveConnectPanel } from '@/components/site/drive-connect';
import { Container } from '@/components/ui/layout';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import {
  isDriveConnected,
  wasDriveConnected,
} from '@/domain/auth/drive-access';

import { AddRecipesPage } from '@/app/(site)/(pages)/recipes/add/_components/add-recipes-page';
import {
  addRecipesPath,
  sharedImportInput,
  type ShareParams,
} from '@/app/(site)/(pages)/recipes/add/_components/shared-input';

/** The tab title of the Add recipes page. */
export const metadata: Metadata = { title: 'Add recipes' };

/**
 * The "Add recipes" page, its own route and not a panel on `/app`. Auth-gates
 * (sending anyone signed out to sign in and then straight back here), asks
 * anyone who hasn't connected their Google Drive to do that first (there is
 * nowhere to save a recipe until they have), then hands off to the client flow
 * that lets the user choose how to add recipes (import links/text, or write
 * one by hand).
 *
 * It is also where the installed app's share target lands (`?title=&text=&url=`,
 * see `src/app/manifest.ts`): whatever was shared becomes the importer's
 * starting text, and is kept through signing in and connecting Drive. It is
 * never imported on its own; the person presses the button.
 */
export default async function AddRecipesRoute({
  searchParams,
}: Readonly<{ searchParams: Promise<ShareParams> }>): Promise<ReactElement> {
  const shared = sharedImportInput(await searchParams);
  const here = addRecipesPath(shared);
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(here)}`);
  }
  if (!isDriveConnected(user)) {
    return (
      <Container className="py-12">
        <DriveConnectPanel
          heading="h1"
          reconnect={wasDriveConnected(user)}
          returnTo={here}
        />
      </Container>
    );
  }
  return <AddRecipesPage sharedInput={shared} />;
}
