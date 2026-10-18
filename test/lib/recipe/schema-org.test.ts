import { describe, expect, it } from '@jest/globals';

import type { ParsedRecipe } from '../../../src/lib/recipe/cooklang';
import {
  recipeToJsonLd,
  toIsoDuration,
} from '../../../src/lib/recipe/schema-org';

describe('toIsoDuration', () => {
  it('parses minutes', () => {
    expect(toIsoDuration('30 minutes')).toBe('PT30M');
    expect(toIsoDuration('5 min')).toBe('PT5M');
  });
  it('parses hours', () => {
    expect(toIsoDuration('2 hours')).toBe('PT2H');
    expect(toIsoDuration('1 hr')).toBe('PT1H');
  });
  it('parses hours and minutes together', () => {
    expect(toIsoDuration('1 hr 15 min')).toBe('PT1H15M');
  });
  it('folds fractional hours into minutes', () => {
    expect(toIsoDuration('1.5 hours')).toBe('PT1H30M');
  });
  it('reads a bare number as minutes', () => {
    expect(toIsoDuration('20')).toBe('PT20M');
  });
  it('returns undefined for junk', () => {
    expect(toIsoDuration('a while')).toBeUndefined();
    expect(toIsoDuration('')).toBeUndefined();
  });
});

describe('recipeToJsonLd', () => {
  const recipe: ParsedRecipe = {
    title: 'Chicken Chettinad',
    metadata: [
      ['cuisine', 'Indian'],
      ['course', 'Main'],
      ['servings', '4'],
      ['cook time', '45 minutes'],
      ['prep time', '20 min'],
      ['diet', 'gluten-free, dairy-free'],
      ['tags', 'spicy; chicken'],
      ['author', 'Meera'],
      ['source', 'https://example.com/chettinad'],
    ],
    ingredients: [{ name: 'chicken', quantity: '500 g' }],
    cookware: ['pan'],
    steps: [
      [
        { kind: 'text', text: 'Fry the ' },
        { kind: 'ingredient', name: 'chicken', quantity: '500 g' },
        { kind: 'text', text: '.' },
      ],
    ],
  };

  const ld = recipeToJsonLd(
    recipe,
    'https://chowdown.apps.mrida.ng/recipe/abc',
  );

  it('sets the schema.org context and type', () => {
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Recipe');
    expect(ld.name).toBe('Chicken Chettinad');
  });
  it('maps metadata onto schema.org fields', () => {
    expect(ld.recipeCuisine).toBe('Indian');
    expect(ld.recipeCategory).toBe('Main');
    expect(ld.recipeYield).toBe('4');
    expect(ld.cookTime).toBe('PT45M');
    expect(ld.prepTime).toBe('PT20M');
    expect(ld.suitableForDiet).toEqual(['gluten-free', 'dairy-free']);
    expect(ld.keywords).toBe('spicy, chicken');
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Meera' });
    expect(ld.isBasedOn).toBe('https://example.com/chettinad');
    expect(ld.url).toBe('https://chowdown.apps.mrida.ng/recipe/abc');
  });
  it('builds ingredient and instruction lists', () => {
    expect(ld.recipeIngredient).toEqual(['500 g chicken']);
    expect(ld.recipeInstructions).toEqual([
      { '@type': 'HowToStep', text: 'Fry the chicken.' },
    ]);
  });
  it('omits fields with no metadata', () => {
    const bare = recipeToJsonLd({
      title: 'Toast',
      metadata: [],
      ingredients: [],
      cookware: [],
      steps: [],
    });
    expect(bare.recipeCuisine).toBeUndefined();
    expect(bare.cookTime).toBeUndefined();
    expect(bare.recipeIngredient).toBeUndefined();
  });
});
