/**
 * @packageDocumentation
 *
 * The header's Google Drive entry, as data: what it says and where it goes.
 * One entry is shared by the header button, the phone menu and the account
 * menu, so the three can never disagree about whether Drive is connected or
 * where "Open Drive" leads.
 */

import { driveConnectHref } from '@/domain/auth/drive-access';
import { isDriveFileId } from '@/lib/google';

/** Where "Open Drive" goes when the Recipes folder is not known: Drive's home page. */
export const DRIVE_HOME_HREF = 'https://drive.google.com/drive/my-drive';

/**
 * What a link that leaves the app carries: a new tab, and no handle back to
 * this page (`noopener`) nor a referrer (`noreferrer`).
 */
export const NEW_TAB = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;

/** The address of a folder in Google Drive's web app. */
const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/';

/** What the Drive entry says and where it goes. */
export type DriveLink = Readonly<{
  /** The words on it: "Connect Google Drive", or "Open Drive" once connected. */
  label: string;
  /** Where it goes: our connect route, or a Google Drive address. */
  href: string;
  /** Whether it leaves the app, and so opens in a new tab. */
  external: boolean;
}>;

/**
 * The address of the person's Recipes folder, or Drive's home page when the
 * folder is not known. The id comes out of a cookie, so it is only used in a
 * link if it is shaped like a Drive id (letters, digits, `_` and `-`); anything
 * else, which could bend the address, falls back to the home page.
 */
export function driveOpenHref(recipesFolderId?: string): string {
  return recipesFolderId !== undefined && isDriveFileId(recipesFolderId)
    ? `${DRIVE_FOLDER_URL}${recipesFolderId}`
    : DRIVE_HOME_HREF;
}

/**
 * The Drive entry for a signed-in person. Not connected, it starts connecting
 * (an ordinary route in this app). Connected, it opens Google Drive itself:
 * their Recipes folder when known, otherwise Drive's home page.
 */
export function driveLink(
  person: Readonly<{ driveConnected: boolean; recipesFolderId?: string }>,
): DriveLink {
  return person.driveConnected
    ? {
        label: 'Open Drive',
        href: driveOpenHref(person.recipesFolderId),
        external: true,
      }
    : {
        label: 'Connect Google Drive',
        href: driveConnectHref(),
        external: false,
      };
}
