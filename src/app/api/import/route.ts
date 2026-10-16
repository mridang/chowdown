/**
 * Bulk import preparation for the app's "Add recipes" box.
 *
 *   POST /api/import  { input: string } → { drafts: ImportDraft[] }
 *
 * The user pastes a blob of links, markdown and/or free text. We plan it into
 * units (one per URL, one per prose block), fetch each link **server-side**,
 * and convert each unit to Cooklang with our own converter — so the Cooklang
 * format stays ours to govern (never the browser's or an assistant's). Nothing
 * is written to Drive here: this returns editable drafts the wizard reviews and
 * saves one at a time via POST /api/recipes.
 *
 * Fetching arbitrary pages from the Worker can hit bot protection or paywalls;
 * a link we can't fetch comes back as a draft with an `error` so the user can
 * paste the content manually instead of the whole import failing.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { parseRecipe } from '@/lib/recipe/cooklang';
import { planImport, type ImportUnit } from '@/lib/recipe/import-blob';
import { fetchPage } from '@/lib/recipe/fetch-page';
import { tagCookSourceBestEffort } from '@/lib/recipe/tagging';
import { convertToCooklang } from '@/lib/recipe/to-cooklang';
import { getEnv } from '@/lib/util';

/** One prepared, not-yet-saved recipe for the review wizard. */
interface ImportDraft {
  /** Suggested recipe name (from the parsed Cooklang title). */
  title: string;
  /** The generated Cooklang source, editable before saving. */
  cook: string;
  /** Where it came from (a URL) for display and provenance. */
  source?: string;
  /** Set when this unit could not be fetched or converted. */
  error?: string;
}

/** Convert one planned unit into a draft, capturing any failure as `error`. */
async function prepareUnit(
  unit: ImportUnit,
  env: CloudflareEnv,
): Promise<ImportDraft> {
  try {
    const raw =
      unit.kind === 'url'
        ? await convertToCooklang(await fetchPage(unit.url), env, {
            sourceUrl: unit.url,
          })
        : await convertToCooklang(unit.text, env);
    // Auto-tag the draft so imported recipes arrive ready to filter by facet.
    const cook = await tagCookSourceBestEffort(raw, 'Imported Recipe', env);
    return {
      title: parseRecipe(cook, 'Imported Recipe').title,
      cook,
      source: unit.kind === 'url' ? unit.url : undefined,
    };
  } catch (err) {
    const where = unit.kind === 'url' ? unit.url : 'pasted text';
    return {
      title: unit.kind === 'url' ? unit.url : 'Pasted recipe',
      cook: '',
      source: unit.kind === 'url' ? unit.url : undefined,
      error: `Couldn't import ${where}: ${
        err instanceof Error ? err.message : 'unknown error'
      }. Paste the recipe text directly instead.`,
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    input?: string;
  } | null;
  const input = body?.input?.trim();
  if (!input) {
    return NextResponse.json({ error: 'input required' }, { status: 400 });
  }

  const units = planImport(input);
  if (units.length === 0) {
    return NextResponse.json(
      { error: 'No links or recipe text found in what you pasted.' },
      { status: 400 },
    );
  }

  const env = getEnv();
  // Convert sequentially: Workers AI has tight concurrency limits, and import
  // is a deliberate, low-frequency action where throughput doesn't matter.
  const drafts: ImportDraft[] = [];
  for (const unit of units) {
    drafts.push(await prepareUnit(unit, env));
  }

  return NextResponse.json({ drafts });
}
