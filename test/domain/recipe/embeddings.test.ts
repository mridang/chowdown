import { describe, expect, it, jest } from '@jest/globals';

import type { ParsedRecipe } from '@/lib/cooklang';
import {
  buildEmbeddingText,
  cosineBetween,
  cosineSimilarity,
  embedText,
  measure,
} from '@/domain/recipe/embeddings';

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });
  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
  it('is 0 when a vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('buildEmbeddingText', () => {
  const recipe: ParsedRecipe = {
    title: 'Guacamole',
    metadata: [['cuisine', 'Mexican']],
    ingredients: [{ name: 'avocado', quantity: '2' }],
    cookware: ['bowl'],
    steps: [
      [
        { kind: 'text', text: 'Mash the ' },
        { kind: 'ingredient', name: 'avocado', quantity: '2' },
        { kind: 'text', text: ' in a ' },
        { kind: 'cookware', name: 'bowl' },
      ],
    ],
  };

  it('includes title, metadata, ingredients and method text', () => {
    const text = buildEmbeddingText(recipe);
    expect(text).toContain('Guacamole');
    expect(text).toContain('cuisine: Mexican');
    expect(text).toContain('Ingredients: avocado');
    expect(text).toContain('Mash the avocado in a bowl');
  });
});

describe('cosineSimilarity of unequal lengths', () => {
  it('compares only the components both vectors have', () => {
    expect(cosineSimilarity([1, 0, 99], [1, 0])).toBe(1);
  });

  it('is 0 against an empty vector', () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
  });
});

describe('embedText', () => {
  /** An env whose model answers with `answer`. */
  const envAnswering = (answer: unknown) =>
    ({ AI: { run: jest.fn(async () => answer) } }) as unknown as CloudflareEnv;

  it('returns the first vector the model produced', async () => {
    const env = envAnswering({ data: [[0.1, 0.2]] });
    expect(await embedText(env, 'hello')).toEqual([0.1, 0.2]);
  });

  it('throws when the answer holds no vector', async () => {
    for (const answer of [{}, { data: [] }, { data: [[]] }, null, 'x']) {
      await expect(embedText(envAnswering(answer), 'hello')).rejects.toThrow(
        'no vector',
      );
    }
  });
});

describe('cosineBetween', () => {
  /** A repeatable pseudo-random vector. */
  const vector = (seed: number, length = 16) =>
    Array.from({ length }, (_, i) => Math.sin(seed * 31 + i * 7.3));

  it('gives exactly the same answer as cosineSimilarity', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const a = vector(seed);
      const b = vector(seed + 10);
      expect(cosineBetween(measure(a), measure(b))).toBe(
        cosineSimilarity(a, b),
      );
    }
  });

  it('is 0 when either vector is all zeros', () => {
    expect(cosineBetween(measure([0, 0]), measure([1, 2]))).toBe(0);
  });

  it('falls back to the shared components when the dimensions differ', () => {
    const a = vector(1, 16);
    const b = vector(2, 8);
    expect(cosineBetween(measure(a), measure(b))).toBe(cosineSimilarity(a, b));
  });
});

describe('measure', () => {
  it('records the squared length', () => {
    expect(measure([3, 4]).squaredLength).toBe(25);
  });
});
