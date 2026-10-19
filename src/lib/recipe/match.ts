/**
 * @packageDocumentation
 *
 * Resolve the recipe an assistant means from a free-text reference. Tools take
 * a recipe *name*, but names aren't unique (two recipes can share a title), so
 * an exact Drive file id is accepted too and always wins — that is how a caller
 * disambiguates when it knows which copy it wants.
 */

import type { DriveFile } from '../drive/drive-client';
import { recipeDisplayName } from './cook-text';

/**
 * Find the file a reference points at: an exact file id first, then an exact
 * (case-insensitive) display name, then the first display name containing the
 * reference.
 */
export function matchFile(
  files: readonly DriveFile[],
  reference: string,
): DriveFile | undefined {
  const ref = reference.trim();
  const target = ref.toLowerCase();
  return (
    files.find((f) => f.id === ref) ??
    files.find((f) => recipeDisplayName(f.name).toLowerCase() === target) ??
    files.find((f) => recipeDisplayName(f.name).toLowerCase().includes(target))
  );
}
