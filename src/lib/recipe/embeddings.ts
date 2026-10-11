/**
 * @packageDocumentation
 *
 * Recipe embeddings for semantic search ("find similar", `find_recipes`, the
 * app's "what to eat?" box). We embed a compact text summary of each recipe
 * with Workers AI (bge-base-en, 768-dim), cache the vector in D1, and compare
 * with cosine similarity in the Worker — plenty fast at per-user recipe counts,
 * and no extra vector-DB infrastructure.
 */

import type { ParsedRecipe } from './cooklang';

/** Workers AI embedding model (768-dimensional). */
const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Build the text we embed for a recipe: title, metadata (cuisine, diet, …),
 * ingredient names and the method text. This is what "similarity" compares, so
 * it deliberately leans on the searchable, meaningful parts.
 */
export function buildEmbeddingText(recipe: ParsedRecipe): string {
  const meta = recipe.metadata.map(([k, v]) => `${k}: ${v}`).join('; ');
  const ingredients = recipe.ingredients.map((i) => i.name).join(', ');
  const method = recipe.steps
    .map((step) =>
      step
        .map((t) => {
          if (t.kind === 'text') return t.text;
          if (t.kind === 'timer') return t.label;
          return t.name;
        })
        .join(''),
    )
    .join(' ');
  return [recipe.title, meta, `Ingredients: ${ingredients}`, method]
    .filter(Boolean)
    .join('\n');
}

/** Embed a string with Workers AI, returning the raw vector. */
export async function embedText(
  env: CloudflareEnv,
  text: string,
): Promise<number[]> {
  const result = (await env.AI.run(EMBED_MODEL, { text: [text] })) as {
    data?: number[][];
  };
  const vector = result.data?.[0];
  if (!vector || vector.length === 0) {
    throw new Error('Embedding produced no vector');
  }
  return vector;
}

/** Cosine similarity of two equal-dimension vectors (0 when either is zero). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
