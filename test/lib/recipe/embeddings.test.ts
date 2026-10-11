import { describe, expect, it } from '@jest/globals';

import type { ParsedRecipe } from '../../../src/lib/recipe/cooklang';
import {
  buildEmbeddingText,
  cosineSimilarity,
} from '../../../src/lib/recipe/embeddings';

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
