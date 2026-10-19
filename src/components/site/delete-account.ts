/**
 * @packageDocumentation
 *
 * The request behind "Delete account". It lives apart from the dialog so the
 * outcome (done, or a sentence saying why not) can be decided, and tested,
 * without a browser.
 */

import {
  requestDeletion,
  type DeletionResult,
} from '@/components/ui/request-deletion';

/** What the person is told when the request could not be made at all. */
const OFFLINE_MESSAGE =
  "Couldn't reach chowdown. Nothing was deleted; please try again.";

/**
 * Ask the server to delete the signed-in person's account and everything it
 * keeps about them (`DELETE /api/users/self`). The recipe files in their Google
 * Drive are not touched. The server also ends the session, so on success the
 * caller only has to leave the signed-in pages.
 *
 * Never throws: a refusal carries the server's own words, and a network
 * failure carries a fixed sentence.
 */
export function deleteAccount(): Promise<DeletionResult> {
  return requestDeletion('/api/users/self', OFFLINE_MESSAGE);
}
