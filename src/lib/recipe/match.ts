/**
 * @packageDocumentation
 *
 * Resolve the recipe an assistant means from a free-text reference. Tools take
 * a recipe *name*, but names aren't unique (two recipes can share a title), so
 * an exact Drive file id is accepted too and always wins — that is how a caller
 * disambiguates when it knows which copy it wants. Names are compared the way
 * `search_recipes` compares them, ignoring case and accents, so "creme brulee"
 * finds "Crème brûlée".
 */

import type { DriveFile } from '@/lib/google/drive';
import { foldText } from '@/lib/intl';
import { recipeDisplayName } from '@/lib/cooklang/cook-text';

/** What a reference to a recipe turned out to mean. */
export type FileMatch =
  /** Nothing in the folder fits. */
  | { readonly kind: 'none' }
  /** Exactly one recipe fits. */
  | { readonly kind: 'one'; readonly file: DriveFile }
  /** Several fit equally well; `files` has the best first. */
  | {
      readonly kind: 'many';
      readonly files: readonly [DriveFile, ...DriveFile[]];
    };

/** One file, several, or none, from the files that matched at one level. */
function outcome(files: readonly DriveFile[]): FileMatch {
  const [first, ...rest] = files;
  if (!first) {
    return { kind: 'none' };
  }
  return rest.length === 0
    ? { kind: 'one', file: first }
    : { kind: 'many', files: [first, ...rest] };
}

/**
 * Work out which recipe a reference points at, and whether it is certain: an
 * exact file id first, then recipes whose display name equals the reference
 * (ignoring case and accents), then recipes whose display name contains it. The first
 * level that matches anything decides, and if it matches more than one recipe
 * the answer is {@link FileMatch} `many` so a caller that must not guess (one
 * that is about to change a file) can ask which was meant.
 *
 * A blank reference points at nothing: every name "contains" the empty string,
 * so without this a missing recipe argument would silently pick the first recipe
 * in the folder, and a write tool would change the wrong file.
 */
export function resolveFile(
  files: readonly DriveFile[],
  reference: string,
): FileMatch {
  const ref = reference.trim();
  if (!ref) {
    return { kind: 'none' };
  }
  const byId = files.find((f) => f.id === ref);
  if (byId) {
    return { kind: 'one', file: byId };
  }
  const target = foldText(ref);
  const named = (f: DriveFile): string => foldText(recipeDisplayName(f.name));
  const exact = files.filter((f) => named(f) === target);
  return exact.length > 0
    ? outcome(exact)
    : outcome(files.filter((f) => named(f).includes(target)));
}

/**
 * Find the file a reference points at: an exact file id first, then an exact
 * (case-insensitive) display name, then the first display name containing the
 * reference. When several fit this takes the best; use {@link resolveFile} to
 * tell that apart from a certain match.
 */
export function matchFile(
  files: readonly DriveFile[],
  reference: string,
): DriveFile | undefined {
  const match = resolveFile(files, reference);
  switch (match.kind) {
    case 'one':
      return match.file;
    case 'many':
      return match.files[0];
    case 'none':
      return undefined;
  }
}
