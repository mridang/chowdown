/**
 * @packageDocumentation
 *
 * Server-side conversion of arbitrary recipe content into Cooklang, kept under
 * our control rather than the calling assistant's. The import flow is: the
 * assistant fetches the page (dodging bot protection) and passes the raw text
 * or HTML; *we* turn it into Cooklang so the output format is consistent and
 * ours to govern.
 *
 * Two strategies, in order:
 *   1. If the content carries schema.org `Recipe` JSON-LD, parse it
 *      deterministically (no model, exact and free).
 *   2. Otherwise run Workers AI with our own system prompt, so the Cooklang
 *      conventions are dictated here, not by the client.
 */

import {
  removeEmptyMetadata,
  sourceUrlOf,
  upsertMetadata,
} from '@/lib/cooklang/cook-text';
import { parseRecipe } from '@/lib/cooklang/cooklang';
import { withAuthor } from '@/domain/recipe/author';
import { withoutScriptsAndStyles } from '@/domain/recipe/html-text';
import { fetchPage } from '@/domain/recipe/fetch-page';
import {
  extractOgImage,
  extractRecipeFromHtml,
} from '@/domain/recipe/import-schema-org';

/** The model used for conversion. Swappable; fp8-fast balances quality/latency. */
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Max characters of source content sent to the model (keeps within context). */
const MAX_CONTENT = 12000;

/** Our Cooklang authoring rules — the single place the format is defined. */
const SYSTEM_PROMPT = `You convert recipes into Cooklang. Output ONLY valid Cooklang — no commentary, no explanations, no markdown code fences.

Cooklang rules:
- Put metadata at the very top, one per line as ">> key: value". Always include ">> title: <name>" and, when known, ">> servings: <n>", ">> time: <duration>", and ">> source: <url>".
- Write the method as paragraphs of plain text. Separate each step with a blank line.
- Mark ingredients inline as @name{quantity%unit}, e.g. @flour{200%g}, @eggs{2}, @salt{}. Multi-word ingredient names REQUIRE the braces: @olive oil{2%tbsp}.
- Mark cookware inline as #item{}, e.g. #pan{}, #large bowl{}.
- Mark timers inline as ~{10%minutes} or ~name{1%hour}.
Stay faithful to the source; never invent ingredients or steps. If the content is not a recipe, output just ">> title: Unknown" and nothing else.`;

/** What the caller already knows about the content it hands us. */
export type ConversionOptions = Readonly<{
  /** The page the content came from. */
  sourceUrl?: string;
  /** The recipe's name, if known. */
  name?: string;
}>;

/** The ways converting content to Cooklang fails, in the fixed words import shows people. */
export type ConversionFailure = 'not a recipe' | 'converter unavailable';

/** Content that could not be converted, and which way it failed. */
export class ConversionError extends Error {
  override readonly name = 'ConversionError';

  /** @param failure Which way it failed, in words that are safe to show. */
  constructor(readonly failure: ConversionFailure) {
    super(failure);
  }
}

/** The text of a page, or null if it can't be fetched (never throws). */
async function fetchPageOrNull(url: string): Promise<string | null> {
  try {
    return await fetchPage(url);
  } catch {
    return null;
  }
}

/**
 * Ask the model to convert. What the model service says when it fails is not
 * for people to read, so any failure of the call itself becomes one fixed
 * outcome.
 */
async function askModel(
  env: CloudflareEnv,
  userMessage: string,
): Promise<unknown> {
  try {
    return await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });
  } catch {
    throw new ConversionError('converter unavailable');
  }
}

/** Strip accidental markdown code fences a model may wrap the output in. */
function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/**
 * Convert fetched recipe `content` (plain text or HTML) into Cooklang source.
 *
 * @param content - Raw page text/HTML the assistant fetched.
 * @param env - Worker env (for the AI binding).
 * @param opts - Optional source URL and name to seed metadata.
 */
export async function convertToCooklang(
  content: string,
  env: CloudflareEnv,
  opts: ConversionOptions = {},
): Promise<string> {
  // 1. Deterministic: schema.org Recipe JSON-LD, if the HTML still carries it.
  // Only trust it when it really holds a recipe: some sites ship JSON-LD with
  // the metadata filled in but empty ingredient/instruction lists, and the real
  // text lives in the page body — those must fall through to the model.
  const fromSchema = extractRecipeFromHtml(content, opts.sourceUrl);
  if (fromSchema && hasRecipeBody(fromSchema)) {
    return fromSchema;
  }

  // 2. Controlled LLM conversion of whatever was passed.
  const userMessage = [
    opts.name ? `Recipe name: ${opts.name}` : '',
    opts.sourceUrl ? `Source URL: ${opts.sourceUrl}` : '',
    'Convert the following recipe content into Cooklang:',
    '',
    withoutScriptsAndStyles(content).slice(0, MAX_CONTENT),
  ]
    .filter(Boolean)
    .join('\n');

  const result = await askModel(env, userMessage);

  const response =
    typeof result === 'object' && result !== null && 'response' in result
      ? result.response
      : undefined;
  const cooklang = stripFences(typeof response === 'string' ? response : '');
  if (!cooklang) {
    throw new ConversionError('not a recipe');
  }
  return `${removeEmptyMetadata(cooklang)}\n`;
}

/**
 * Convert content handed to us by an assistant, enriching it from the source
 * URL when we can. An assistant usually passes plain article text, which has
 * lost the page's structured data (and so its images, times and author). When a
 * `sourceUrl` is given we make one best-effort server-side fetch of the page:
 *
 *   - if the page carries `Recipe` JSON-LD, that is the better source, so use it;
 *   - otherwise convert the assistant's content as usual and attach the page's
 *     `og:image` as the cover if the conversion produced no images.
 *
 * A failed fetch (bot protection, timeout, paywall) is silent: the import
 * proceeds with the assistant's content, just without the extras.
 */
export async function convertImport(
  content: string,
  env: CloudflareEnv,
  opts: ConversionOptions = {},
): Promise<string> {
  const direct = extractRecipeFromHtml(content, opts.sourceUrl);
  if (direct && hasRecipeBody(direct)) {
    return withAuthor(direct, content, env);
  }

  const page = opts.sourceUrl ? await fetchPageOrNull(opts.sourceUrl) : null;

  // The page's structured data wins only if it contains a recipe; a metadata-
  // only record (empty ingredient/instruction lists) still donates its image.
  const fromPage = page ? extractRecipeFromHtml(page, opts.sourceUrl) : null;
  if (fromPage && hasRecipeBody(fromPage)) {
    return withAuthor(fromPage, page ?? '', env);
  }

  const cook = await convertToCooklang(content, env, opts);
  const image =
    /^>>\s*images:\s*(\S+)/im.exec(fromPage ?? '')?.[1] ??
    (page ? extractOgImage(page, opts.sourceUrl) : undefined);
  const covered =
    image && !/^>>\s*images:/im.test(cook)
      ? upsertMetadata(cook, [['images', image]])
      : cook;
  // The assistant's text rarely says who wrote it; the page it came from does.
  return page ? withAuthor(covered, page, env) : covered;
}

/**
 * Backfill a missing cover image. If the recipe has no `>> images:` but does
 * record a `>> source:` page, make one best-effort fetch of it and attach the
 * page's own recipe image (from JSON-LD) or its `og:image`. Returns the source
 * unchanged when it already has images, has no source, or the page can't be
 * fetched (bot protection, timeout) — so it is always safe to call.
 */
export async function addMissingCover(source: string): Promise<string> {
  if (/^>>\s*images:/im.test(source)) {
    return source;
  }
  const url = sourceUrlOf(source);
  if (!url) {
    return source;
  }
  const page = await fetchPageOrNull(url);
  if (page === null) {
    return source;
  }
  const fromJsonLd = extractRecipeFromHtml(page, url);
  const image =
    (fromJsonLd && /^>>\s*images:\s*(\S+)/im.exec(fromJsonLd)?.[1]) ||
    extractOgImage(page, url);
  return image ? upsertMetadata(source, [['images', image]]) : source;
}

/**
 * Whether converted Cooklang actually contains a recipe: at least one marked
 * ingredient, or at least two method steps that say something. The converter
 * answers "not a recipe" or an unreadable page (a video, a paywall, or content
 * the assistant could not fetch) with just a title and source — or with a lone
 * placeholder line like "Recipe content is unavailable." — and saving that would
 * leave an empty recipe in the user's Drive, so import refuses it.
 */
export function hasRecipeBody(cook: string): boolean {
  try {
    const parsed = parseRecipe(cook, 'recipe.cook');
    if (parsed.ingredients.length > 0) {
      return true;
    }
    const realSteps = parsed.steps.filter((step) =>
      step.some((t) => t.kind !== 'text' || t.text.trim().length > 0),
    );
    return realSteps.length >= 2;
  } catch {
    return false;
  }
}
