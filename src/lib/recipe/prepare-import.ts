/**
 * @packageDocumentation
 *
 * Preparing a recipe import: take the planned units (one per link, one per
 * block of prose, see `import-blob.ts`), fetch each link server-side and
 * convert each unit to Cooklang with our own converter, so the Cooklang format
 * stays ours to govern. Nothing is saved here; the result is a draft per unit, or a problem for a
 * unit that couldn't be fetched or converted, so one bad link never fails the
 * whole import.
 */

import { withAuthor } from './author';
import { parseRecipe } from './cooklang';
import { fetchPage, PageFetchError } from './fetch-page';
import { MAX_IMPORT_UNITS, type ImportUnit } from './import-blob';
import { mapSequentially } from './map-sequentially';
import { tagCookSourceBestEffort } from './tagging';
import {
  ConversionError,
  convertToCooklang,
  hasRecipeBody,
} from './to-cooklang';

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

/**
 * Why a unit failed, in a fixed vocabulary: `fetch failed (403)`, `timed out`,
 * `blocked`, `not a web page`, `unreachable`, `not a recipe`, `converter
 * unavailable`, or `unexpected error`. The words of whatever threw (a fetch
 * library, the model service) are for the logs, not for the person looking at
 * the result.
 */
function failureReason(error: unknown): string {
  if (error instanceof PageFetchError || error instanceof ConversionError) {
    return error.failure;
  }
  return 'unexpected error';
}

/** Convert one planned unit into an item, capturing any failure as `FAILED`. */
async function prepareUnit(
  unit: Readonly<ImportUnit>,
  env: CloudflareEnv,
): Promise<ImportItem> {
  const sourceUrl = unit.kind === 'url' ? unit.url : undefined;
  try {
    const page = unit.kind === 'url' ? await fetchPage(unit.url) : undefined;
    const converted =
      unit.kind === 'url'
        ? await convertToCooklang(page ?? '', env, { sourceUrl: unit.url })
        : await convertToCooklang(unit.text, env);
    // The page says who wrote the recipe far more often than the text of it does.
    const raw =
      page === undefined ? converted : await withAuthor(converted, page, env);
    // A page the converter could not find a recipe on comes back as a title and
    // a placeholder sentence; saved, that would be an empty recipe in Drive.
    if (!hasRecipeBody(raw)) {
      throw new ConversionError('not a recipe');
    }
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
      problem: `Couldn't import ${where}: ${failureReason(err)}. Paste the recipe text directly instead.`,
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
    };
  }
}

/**
 * Prepare the planned units of an import, one after another (Workers AI has
 * tight concurrency limits, and an import is a deliberate, occasional action).
 * At most {@link MAX_IMPORT_UNITS} are prepared: callers refuse a longer plan
 * before getting here, and this is the second lock on the door, since each
 * unit costs a fetch and model calls.
 */
export async function prepareImport(
  units: readonly ImportUnit[],
  env: CloudflareEnv,
): Promise<readonly ImportItem[]> {
  return mapSequentially(units.slice(0, MAX_IMPORT_UNITS), (unit) =>
    prepareUnit(unit, env),
  );
}
