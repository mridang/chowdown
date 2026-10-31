/**
 * @packageDocumentation
 *
 * What this app asks of a signed-in person before the shared approval screen
 * (`page.tsx`) lets them connect an app. An assistant has nothing to reach in
 * chowdown until the recipes' Google Drive is connected, so a person without it
 * is asked to connect it first and is then brought straight back to the
 * approval.
 */

import type { ReactElement } from 'react';

import { CenteredCard } from '@/components/site/centered-card';
import { DriveConnectPanel } from '@/components/site/drive-connect';
import {
  isDriveConnected,
  wasDriveConnected,
} from '@/domain/auth/drive-access';
import type { User } from '@/domain/auth/store';

/**
 * The screen to show instead of the approval, or null when the person may go
 * on to approve. `returnTo` is the approval page itself, to come back to.
 */
export function approvalGate(
  user: Readonly<User>,
  returnTo: string,
): ReactElement | null {
  if (isDriveConnected(user)) {
    return null;
  }
  return (
    <CenteredCard framed={false}>
      <DriveConnectPanel
        heading="h1"
        reconnect={wasDriveConnected(user)}
        returnTo={returnTo}
      />
    </CenteredCard>
  );
}
