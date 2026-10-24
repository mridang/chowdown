/**
 * @packageDocumentation
 *
 * The decision logic behind the MCP `import_recipe` tool, kept free of I/O so it
 * can be tested: every side effect (Drive, the model, the D1 cache) is passed in
 * as a dependency. The tool handler wires in the real ones.
 *
 * What an import does, in order:
 *   1. If this link was already imported *and* that copy holds a recipe, return
 *      it — importing the same link twice never makes a duplicate.
 *   2. Convert the content to Cooklang. If it has no ingredients or steps (a
 *      video page, a paywall), refuse and save nothing.
 *   3. Tag it, then either repair the existing hollow copy in place (a previous
 *      import that saved metadata but no recipe) or create a new file.
 */

import { parseRecipe } from '@/lib/cooklang/cooklang';
import { withImages } from '@/domain/recipe/media';
import {
  hasRecipeBody,
  type ConversionOptions,
} from '@/domain/recipe/to-cooklang';

/** What an import ended up doing. */
export type ImportOutcome =
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'existing' | 'created' | 'repaired';
      readonly id: string;
      readonly name: string;
      readonly source: string;
    };

/** A recipe already saved for this link. */
export interface ExistingRecipe {
  readonly id: string;
  readonly name: string;
  readonly source: string;
}

/** The side effects an import needs, injected so the logic is testable. */
export interface ImportDeps {
  /** The saved recipe imported from this URL, if any. */
  findExisting(url: string): Promise<ExistingRecipe | undefined>;
  /** Convert assistant-supplied content to Cooklang. */
  convert(content: string, opts: ConversionOptions): Promise<string>;
  /** Tag the Cooklang (best effort; returns it unchanged on failure). */
  tag(source: string, name: string): Promise<string>;
  /** Create a new recipe file. */
  create(
    name: string,
    source: string,
  ): Promise<{ readonly id: string; readonly name: string }>;
  /** Replace an existing recipe file's contents. */
  update(id: string, source: string): Promise<void>;
  /** Refresh the D1 cache for a written recipe. */
  index(id: string, name: string, source: string): Promise<void>;
}

/** Import one recipe's content, deduplicating, repairing or refusing as needed. */
export async function importRecipe(
  deps: ImportDeps,
  input: Readonly<{
    content: string;
    url?: string;
    name?: string;
    /** Image URLs the caller saw on the page; the first is the cover. */
    images?: readonly string[];
  }>,
): Promise<ImportOutcome> {
  const existing = input.url ? await deps.findExisting(input.url) : undefined;
  if (existing && hasRecipeBody(existing.source)) {
    return { kind: 'existing', ...existing };
  }

  const converted = await deps.convert(input.content, {
    sourceUrl: input.url,
    name: input.name,
  });
  if (!hasRecipeBody(converted)) {
    return { kind: 'refused' };
  }

  const name =
    input.name ||
    parseRecipe(converted, 'recipe.cook').title ||
    'Imported Recipe';
  // Images the caller saw in a real browser beat anything we could fetch.
  const withCover = input.images?.length
    ? withImages(converted, input.images)
    : converted;
  const source = await deps.tag(withCover, name);

  if (existing) {
    await deps.update(existing.id, source);
    await deps.index(existing.id, existing.name, source);
    return { kind: 'repaired', id: existing.id, name: existing.name, source };
  }

  const file = await deps.create(name, source);
  await deps.index(file.id, file.name, source);
  return { kind: 'created', id: file.id, name: file.name, source };
}
