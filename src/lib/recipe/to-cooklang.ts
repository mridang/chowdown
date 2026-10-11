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

import { extractRecipeFromHtml } from './import-schema-org';

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
  opts: { sourceUrl?: string; name?: string } = {},
): Promise<string> {
  // 1. Deterministic: schema.org Recipe JSON-LD, if the HTML still carries it.
  const fromSchema = extractRecipeFromHtml(content, opts.sourceUrl);
  if (fromSchema) {
    return fromSchema;
  }

  // 2. Controlled LLM conversion of whatever was passed.
  const userMessage = [
    opts.name ? `Recipe name: ${opts.name}` : '',
    opts.sourceUrl ? `Source URL: ${opts.sourceUrl}` : '',
    'Convert the following recipe content into Cooklang:',
    '',
    content.slice(0, MAX_CONTENT),
  ]
    .filter(Boolean)
    .join('\n');

  const result = (await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  })) as { response?: string };

  const cooklang = stripFences(result.response ?? '');
  if (!cooklang) {
    throw new Error('Recipe conversion produced no output');
  }
  return `${cooklang}\n`;
}
