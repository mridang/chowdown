import { describe, expect, it } from '@jest/globals';

import { formatQuantity, parseRecipe } from '../../../src/lib/recipe/cooklang';

describe('formatQuantity', () => {
  it('combines quantity and units', () => {
    expect(formatQuantity({ quantity: 200, units: 'g' })).toBe('200 g');
  });

  it('returns the quantity alone when there are no units', () => {
    expect(formatQuantity({ quantity: 2 })).toBe('2');
  });

  it('treats "some" and empty as no quantity', () => {
    expect(formatQuantity({ quantity: 'some' })).toBe('');
    expect(formatQuantity({ quantity: '', units: 'tsp' })).toBe('tsp');
  });
});

describe('parseRecipe', () => {
  const source = [
    '>> title: Test Bake',
    '>> servings: 2',
    '',
    'Mix @flour{200%g} and @eggs{2} in a #bowl{}.',
    'Bake for ~{20%minutes}.',
  ].join('\n');

  const recipe = parseRecipe(source, 'fallback.cook');

  it('uses the metadata title over the filename', () => {
    expect(recipe.title).toBe('Test Bake');
  });

  it('falls back to the filename (minus .cook) without a title', () => {
    expect(parseRecipe('Just add @water{}.', 'water.cook').title).toBe('water');
  });

  it('collects ingredients with formatted quantities', () => {
    expect(recipe.ingredients).toEqual([
      { name: 'flour', quantity: '200 g' },
      { name: 'eggs', quantity: '2' },
    ]);
  });

  it('collects cookware', () => {
    expect(recipe.cookware).toEqual(['bowl']);
  });

  it('exposes metadata without the title', () => {
    expect(recipe.metadata).toEqual([['servings', '2']]);
  });

  it('tokenises steps with ingredient, cookware and timer chips', () => {
    const kinds = recipe.steps.flat().map((token) => token.kind);
    expect(kinds).toContain('ingredient');
    expect(kinds).toContain('cookware');
    expect(kinds).toContain('timer');
  });
});

/** The ingredients and method of a recipe, as the page would show them. */
function shown(source: string) {
  const recipe = parseRecipe(source, 'x.cook');
  return {
    ingredients: recipe.ingredients.map(
      (i) => `${i.name}${i.quantity ? ` — ${i.quantity}` : ''}`,
    ),
    steps: recipe.steps.map((step) =>
      step.map((t) => (t.kind === 'text' ? t.text : `[${t.kind}]`)).join(''),
    ),
  };
}

describe('an ingredient block before the method', () => {
  const source = [
    '>> title: Rogan Josh',
    '>> servings: 5 servings',
    '',
    '@Lamb stew meat, 1000 g{}',
    '@Mustard oil, 75 g{}',
    '@Salt, to taste{}',
    '@Whole Milk Yogurt, ~200 g{}',
    '@Basmati Rice{}',
    '',
    'Add enough oil to generously coat the bottom of a heavy pot.',
    'Braise for 1-2 hours until the lamb pieces are completely tender.',
  ].join('\n');

  it('fills the ingredients panel and is not repeated as steps of the method', () => {
    expect(shown(source)).toEqual({
      ingredients: [
        'Lamb stew meat — 1000 g',
        'Mustard oil — 75 g',
        'Salt — to taste',
        'Whole Milk Yogurt — 200 g',
        'Basmati Rice',
      ],
      steps: [
        'Add enough oil to generously coat the bottom of a heavy pot.',
        'Braise for 1-2 hours until the lamb pieces are completely tender.',
      ],
    });
  });

  it('reads lines the Cooklang parser itself would split apart, such as a ~ or a # in a name', () => {
    const { ingredients, steps } = shown(
      '@Chicken, ~450 g{}\n@Curry #3 paste{}\n\nCook it.',
    );
    expect(ingredients).toEqual(['Chicken — 450 g', 'Curry #3 paste']);
    expect(steps).toEqual(['Cook it.']);
  });

  it('works with Windows line endings and blank lines inside the block', () => {
    const { ingredients, steps } = shown(
      '>> title: T\r\n\r\n@Flour{200%g}\r\n\r\n@Eggs{2}\r\n\r\nMix.\r\n',
    );
    expect(ingredients).toEqual(['Flour — 200 g', 'Eggs — 2']);
    expect(steps).toEqual(['Mix.']);
  });

  it('does not list an ingredient twice when a step mentions it again', () => {
    const { ingredients } = shown(
      '@flour{200%g}\n@eggs{2}\n\nMix the @flour{200%g} with the @eggs{2} and @milk{1%cup}.',
    );
    expect(ingredients).toEqual(['flour — 200 g', 'eggs — 2', 'milk — 1 cup']);
  });

  it('keeps the declaration in place when there is no method after it', () => {
    expect(shown('@flour{200%g}\n@eggs{2}\n').steps).toHaveLength(2);
  });

  it('leaves a single leading token alone, since one line is not a block', () => {
    const { steps } = shown('@flour{200%g}\n\nMix it.');
    expect(steps).toHaveLength(2);
  });

  it('leaves a recipe whose first step has words in it alone', () => {
    const { steps, ingredients } = shown(
      '@flour{200%g} and @eggs{2}, mixed.\n@milk{1%cup} added.\n\nBake.',
    );
    expect(steps).toHaveLength(3);
    expect(ingredients).toEqual(['flour — 200 g', 'eggs — 2', 'milk — 1 cup']);
  });
});

describe('ingredients that were stored badly', () => {
  it.each([
    ['@Lamb stew meat, 1000 g{}', 'Lamb stew meat — 1000 g'],
    ['@Garlic, 2 cloves{}', 'Garlic — 2 cloves'],
    ['@/ 65 ml lime juice{1/4%cup}', 'lime juice — 1/4 cup'],
    ['@garlic cloves (, minced){2}', 'garlic cloves — 2'],
    ['@1/2 teaspoon red chilli powder{1}', 'red chilli powder — 1/2 teaspoon'],
    [
      '@ounces portobello mushroom caps (sliced){10-12}',
      'portobello mushroom caps — 10-12 ounces',
    ],
    [
      '@- 3/4 lb lean ground pork (, sub chicken){1/2}',
      'lean ground pork — 3/4 lb',
    ],
    ['@(about 4 cups) broccoli florets{}', 'broccoli florets — 4 cups'],
    [
      '@low-moisture mozzarella , chilled and cut{1%pound}',
      'low-moisture mozzarella — 1 pound',
    ],
  ])('puts %s right', (line, expected) => {
    expect(shown(`${line}\n@salt{}\n\nCook.`).ingredients[0]).toBe(expected);
  });

  it('repairs an ingredient written inline in a step as well', () => {
    const recipe = parseRecipe('Add @Garlic, 2 cloves{} to the pan.', 'x.cook');
    expect(recipe.ingredients[0]).toEqual({
      name: 'Garlic',
      quantity: '2 cloves',
    });
    expect(recipe.steps[0]).toContainEqual({
      kind: 'ingredient',
      name: 'Garlic',
      quantity: '2 cloves',
    });
  });

  it('leaves a tidy ingredient exactly as it was', () => {
    const { ingredients } = shown(
      'Mix @all-purpose flour{250%g} and @00 flour{1%cup} and @7up{1%can}.',
    );
    expect(ingredients).toEqual([
      'all-purpose flour — 250 g',
      '00 flour — 1 cup',
      '7up — 1 can',
    ]);
  });
});
