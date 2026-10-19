/**
 * @packageDocumentation
 *
 * The one way the app asks the server to delete something on the person's
 * behalf (a recipe, their whole account), so each confirmation dialog can show
 * the same kind of outcome and none of them has to handle a thrown error.
 */

import { problemMessage } from '@/lib/problem-message';

/** How a deletion ended: done, or the sentence to show the person. */
export type DeletionResult =
  | Readonly<{ deleted: true }>
  | Readonly<{ deleted: false; message: string }>;

/**
 * Send `DELETE` to an API address and say how it ended. Never throws: a
 * refusal carries the server's own words, and a request that could not be made
 * at all carries `unreachable`, since the browser's "Failed to fetch" helps
 * nobody.
 *
 * @param url The API address of the thing to delete.
 * @param unreachable What to say when the server could not be reached; it
 *   should make clear that nothing was deleted.
 */
export async function requestDeletion(
  url: string,
  unreachable: string,
): Promise<DeletionResult> {
  try {
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok
      ? { deleted: true }
      : { deleted: false, message: await problemMessage(res) };
  } catch {
    return { deleted: false, message: unreachable };
  }
}
