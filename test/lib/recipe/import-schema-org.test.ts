import { describe, expect, it } from '@jest/globals';

import {
  extractRecipeFromHtml,
  findRecipeNode,
  humaniseDuration,
  parseIngredientLine,
  schemaOrgToCook,
  toCookIngredient,
} from '../../../src/lib/recipe/import-schema-org';

describe('parseIngredientLine', () => {
  it('parses quantity + unit + name', () => {
    expect(parseIngredientLine('200 g flour')).toEqual({
      quantity: '200',
      unit: 'g',
      name: 'flour',
    });
  });

  it('parses quantity + name with no unit', () => {
    expect(parseIngredientLine('2 eggs')).toEqual({
      quantity: '2',
      name: 'eggs',
    });
  });

  it('keeps a bare name when there is no quantity', () => {
    expect(parseIngredientLine('salt to taste')).toEqual({
      name: 'salt to taste',
    });
  });

  it('renders Cooklang tokens', () => {
    expect(
      toCookIngredient({ quantity: '200', unit: 'g', name: 'flour' }),
    ).toBe('@flour{200%g}');
    expect(toCookIngredient({ quantity: '2', name: 'eggs' })).toBe('@eggs{2}');
    expect(toCookIngredient({ name: 'salt to taste' })).toBe(
      '@salt to taste{}',
    );
  });
});

describe('humaniseDuration', () => {
  it('formats hours and minutes', () => {
    expect(humaniseDuration('PT1H30M')).toBe('1 hr 30 min');
    expect(humaniseDuration('PT40M')).toBe('40 min');
    expect(humaniseDuration('PT2H')).toBe('2 hr');
  });

  it('returns undefined for junk', () => {
    expect(humaniseDuration('nonsense')).toBeUndefined();
  });
});

describe('findRecipeNode', () => {
  it('finds a Recipe inside a @graph', () => {
    const node = findRecipeNode({
      '@graph': [{ '@type': 'WebSite' }, { '@type': 'Recipe', name: 'X' }],
    });
    expect(node?.['name']).toBe('X');
  });

  it('handles @type as an array', () => {
    expect(findRecipeNode({ '@type': ['Thing', 'Recipe'], name: 'Y' })).toEqual(
      { '@type': ['Thing', 'Recipe'], name: 'Y' },
    );
  });

  it('returns null when absent', () => {
    expect(findRecipeNode({ '@type': 'Article' })).toBeNull();
  });
});

describe('schemaOrgToCook', () => {
  const recipe = {
    '@type': 'Recipe',
    name: 'Pancakes',
    recipeYield: '4',
    totalTime: 'PT20M',
    keywords: 'breakfast',
    recipeIngredient: ['200 g flour', '2 eggs', 'pinch salt'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Mix everything.' },
      { '@type': 'HowToStep', text: 'Fry in a pan.' },
    ],
  };

  const cook = schemaOrgToCook(recipe, 'https://example.com/pancakes');

  it('writes metadata', () => {
    expect(cook).toContain('>> title: Pancakes');
    expect(cook).toContain('>> servings: 4');
    expect(cook).toContain('>> time: 20 min');
    expect(cook).toContain('>> keywords: breakfast');
    expect(cook).toContain('>> source: https://example.com/pancakes');
  });

  it('captures taxonomy, provenance and media', () => {
    const out = schemaOrgToCook(
      {
        '@type': 'Recipe',
        name: 'Butter Chicken',
        recipeCuisine: 'Indian',
        recipeCategory: 'Main course',
        cookingMethod: 'Simmering',
        suitableForDiet: ['http://schema.org/GlutenFreeDiet', 'HalalDiet'],
        prepTime: 'PT15M',
        datePublished: '2024-06-01',
        author: { '@type': 'Person', name: 'Asma Khan' },
        image: ['https://ex.com/a.jpg', { url: 'https://ex.com/b.jpg' }],
        video: { '@type': 'VideoObject', contentUrl: 'https://ex.com/v.mp4' },
        recipeInstructions: 'Cook it.',
      },
      'https://ex.com/butter-chicken',
    );
    expect(out).toContain('>> cuisine: Indian');
    expect(out).toContain('>> category: Main course');
    expect(out).toContain('>> method: Simmering');
    expect(out).toContain('>> diet: GlutenFree, Halal');
    expect(out).toContain('>> prep: 15 min');
    expect(out).toContain('>> author: Asma Khan');
    expect(out).toContain('>> published: 2024-06-01');
    expect(out).toContain(
      '>> images: https://ex.com/a.jpg, https://ex.com/b.jpg',
    );
    expect(out).toContain('>> video: https://ex.com/v.mp4');
  });

  it('emits ingredient tokens and steps', () => {
    expect(cook).toContain('@flour{200%g}');
    expect(cook).toContain('@eggs{2}');
    expect(cook).toContain('Mix everything.');
    expect(cook).toContain('Fry in a pan.');
  });

  it('handles instructions given as a single string', () => {
    const out = schemaOrgToCook({
      '@type': 'Recipe',
      name: 'Toast',
      recipeInstructions: 'Toast bread.\nButter it.',
    });
    expect(out).toContain('Toast bread.');
    expect(out).toContain('Butter it.');
  });
});

describe('extractRecipeFromHtml', () => {
  it('pulls a Recipe out of a ld+json script tag', () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Soup","recipeInstructions":"Boil it."}
      </script>
      </head></html>`;
    const cook = extractRecipeFromHtml(html, 'https://x.test/soup');
    expect(cook).toContain('>> title: Soup');
    expect(cook).toContain('Boil it.');
  });

  it('skips malformed json and returns null when no recipe', () => {
    const html = `<script type="application/ld+json">{ not json }</script>`;
    expect(extractRecipeFromHtml(html)).toBeNull();
  });
});
