/**
 * @packageDocumentation
 *
 * Auto-tagging: ask Workers AI to classify a recipe against the curated
 * {@link ./taxonomy}, then validate its answer so only vocabulary values
 * survive. The model proposes; the taxonomy disposes — nothing the model
 * invents for a closed facet is kept, so the tag set can't drift.
 *
 * The result is a list of `[key, value]` pairs ready to write into the `.cook`
 * file as `>> key: value` metadata (via `upsertMetadata`), which is exactly the
 * shape the recipe page and facet filter read back.
 */

import type { ParsedRecipe } from './cooklang';
import { buildEmbeddingText } from './embeddings';
import { FACETS, validateTags } from './taxonomy';

/** The model used for tagging — same fast instruct model as conversion. */
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Build the system prompt describing the closed vocabulary, once per call. */
function systemPrompt(): string {
  const lines = FACETS.map((f) => {
    if (f.values === null) {
      return `- ${f.key}: up to 5 short free-form keywords (lowercase).`;
    }
    const card = f.multi ? 'choose all that apply' : 'choose exactly one';
    return `- ${f.key} (${card}): ${f.values.join(', ')}.`;
  });
  return [
    'You tag recipes for a recipe app. Classify the recipe into these facets,',
    'using ONLY the listed values (except keywords, which are free-form).',
    'Omit a facet entirely if you are unsure — do not guess.',
    '',
    ...lines,
    '',
    'Respond with ONLY a JSON object mapping facet name to value (string) or',
    'values (array of strings). No prose, no markdown, no code fences.',
  ].join('\n');
}

/** Pull the first JSON object out of a model response, tolerating stray text. */
function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Suggest taxonomy tags for a recipe. Returns validated `[key, value]` pairs
 * (closed-facet values guaranteed to be in the vocabulary); returns `[]` when
 * the model gives nothing usable, so a tagging pass can never corrupt a recipe.
 */
export async function suggestTags(
  recipe: ParsedRecipe,
  env: CloudflareEnv,
): Promise<[string, string][]> {
  const result = (await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: systemPrompt() },
      {
        role: 'user',
        content: `Tag this recipe:\n\n${buildEmbeddingText(recipe)}`,
      },
    ],
  })) as { response?: unknown };

  // Workers AI usually returns `response` as a JSON string, but some models
  // hand back an already-parsed object — accept either.
  const raw = result.response;
  const proposed =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : extractJson(typeof raw === 'string' ? raw : '');
  if (!proposed) {
    return [];
  }
  return validateTags(proposed);
}
