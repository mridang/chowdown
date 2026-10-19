/**
 * @packageDocumentation
 *
 * Preparing a recipe import: plan the pasted text into units (one per link, one
 * per block of prose), fetch each link server-side and convert each unit to
 * Cooklang with our own converter — so the Cooklang format stays ours to govern.
 * Nothing is saved here; the result is a draft per unit, or a problem for a
 * unit that couldn't be fetched or converted, so one bad link never fails the
 * whole import.
 */

import { parseRecipe } from './cooklang';
import { fetchPage } from './fetch-page';
import { planImport, type ImportUnit } from './import-blob';
import { mapSequentially } from './map-sequentially';
import { tagCookSourceBestEffort } from './tagging';
import { convertToCooklang } from './to-cooklang';

/** One prepared unit of an import. */
export interface ImportItem {
  /** The page it came from, for links. */
  readonly source_url?: string;
  /** Suggested name (the parsed title), or the link/label when it failed. */
  readonly title: string;
  readonly status: 'DRAFT' | 'FAILED';
  /** The generated Cooklang, editable before it is saved as a recipe. */
  readonly cooklang?: string;
  /** Why it failed, for a failed item. */
  readonly problem?: string;
}

/** Convert one planned unit into an item, capturing any failure as `FAILED`. */
async function prepareUnit(
  unit: Readonly<ImportUnit>,
  env: CloudflareEnv,
): Promise<ImportItem> {
  const sourceUrl = unit.kind === 'url' ? unit.url : undefined;
  try {
    const raw =
      unit.kind === 'url'
        ? await convertToCooklang(await fetchPage(unit.url), env, {
            sourceUrl: unit.url,
          })
        : await convertToCooklang(unit.text, env);
    // Tag the draft so imported recipes arrive ready to filter by facet.
    const cooklang = await tagCookSourceBestEffort(raw, 'Imported Recipe', env);
    return {
      title: parseRecipe(cooklang, 'Imported Recipe').title,
      status: 'DRAFT',
      cooklang,
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
    };
  } catch (err) {
    const where = sourceUrl ?? 'pasted text';
    return {
      title: sourceUrl ?? 'Pasted recipe',
      status: 'FAILED',
      problem: `Couldn't import ${where}: ${
        err instanceof Error ? err.message : 'unknown error'
      }. Paste the recipe text directly instead.`,
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
    };
  }
}

/**
 * Prepare every unit in what the user pasted, one after another (Workers AI has
 * tight concurrency limits, and an import is a deliberate, occasional action).
 * Returns an empty list when the text holds no links or recipe text.
 */
export async function prepareImport(
  input: string,
  env: CloudflareEnv,
): Promise<readonly ImportItem[]> {
  return mapSequentially(planImport(input), (unit) => prepareUnit(unit, env));
}
