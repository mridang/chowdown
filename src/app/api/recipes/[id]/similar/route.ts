/**
 * Recipes similar to this one, most similar first. Precomputed from the
 * recipes' embeddings and read straight from the D1 cache.
 *
 *   GET /api/recipes/:id/similar
 *
 * The behaviour lives in the `recipeSimilar` controller; this file only mounts it.
 */

import { recipeSimilar } from '@/domain/api/similar';

export const dynamic = 'force-dynamic';

export const { GET } = recipeSimilar.handlers();
