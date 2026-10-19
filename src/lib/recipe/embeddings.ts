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
export function buildEmbeddingText(recipe: Readonly<ParsedRecipe>): string {
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
): Promise<readonly number[]> {
  const result: unknown = await env.AI.run(EMBED_MODEL, { text: [text] });
  const vector = firstVector(result);
  if (!vector || vector.length === 0) {
    throw new Error('Embedding produced no vector');
  }
  return vector;
}

/** The first vector in a Workers AI embedding response (`{ data: [[…]] }`), if any. */
function firstVector(result: unknown): readonly number[] | undefined {
  if (typeof result !== 'object' || result === null || !('data' in result)) {
    return undefined;
  }
  const first: unknown = Array.isArray(result.data)
    ? result.data[0]
    : undefined;
  return Array.isArray(first) && first.every((x) => typeof x === 'number')
    ? first
    : undefined;
}

/**
 * The dot product of two vectors over their first `length` components. Written
 * as one `reduce` over `a` (no copies), since this runs hundreds of thousands
 * of times when every recipe is compared with every other.
 */
function dotProduct(
  a: readonly number[],
  b: readonly number[],
  length: number,
): number {
  return a.reduce((sum, x, i) => (i < length ? sum + x * (b[i] ?? 0) : sum), 0);
}

/** Cosine from a dot product and the two squared lengths (0 if either is zero). */
function cosineFrom(dot: number, squaredA: number, squaredB: number): number {
  if (squaredA === 0 || squaredB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(squaredA) * Math.sqrt(squaredB));
}

/** Cosine similarity of two equal-dimension vectors (0 when either is zero). */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  // Only the components both vectors have count, so a short vector never
  // compares against missing values.
  const n = Math.min(a.length, b.length);
  return cosineFrom(
    dotProduct(a, b, n),
    dotProduct(a, a, n),
    dotProduct(b, b, n),
  );
}

/** A vector with its squared length worked out once, for many comparisons. */
export interface MeasuredVector {
  readonly vector: readonly number[];
  /** The sum of the squares of the components. */
  readonly squaredLength: number;
}

/** Measure a vector once so it can be compared with many others cheaply. */
export function measure(vector: readonly number[]): MeasuredVector {
  return {
    vector,
    squaredLength: dotProduct(vector, vector, vector.length),
  };
}

/**
 * Same answer as {@link cosineSimilarity} for two measured vectors, without
 * working out their lengths again. Comparing every recipe with every other
 * measures each vector once instead of once per pair, which is most of the
 * work. Vectors of different dimensions fall back to the plain function, since
 * their lengths would be over different components.
 */
export function cosineBetween(a: MeasuredVector, b: MeasuredVector): number {
  if (a.vector.length !== b.vector.length) {
    return cosineSimilarity(a.vector, b.vector);
  }
  return cosineFrom(
    dotProduct(a.vector, b.vector, a.vector.length),
    a.squaredLength,
    b.squaredLength,
  );
}
