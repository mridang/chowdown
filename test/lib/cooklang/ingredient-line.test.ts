import { describe, expect, it } from '@jest/globals';

import { parseIngredientLine, toCookIngredient } from '@/lib/cooklang';

/** The Cooklang token a line becomes: what ends up in the file and so what the page shows. */
const token = (line: string) => toCookIngredient(parseIngredientLine(line));

describe('parseIngredientLine', () => {
  it('parses quantity, unit and name', () => {
    expect(parseIngredientLine('200 g flour')).toEqual({
      quantity: '200',
      unit: 'g',
      name: 'flour',
    });
  });

  it('parses a quantity with no unit', () => {
    expect(parseIngredientLine('2 eggs')).toEqual({
      quantity: '2',
      name: 'eggs',
    });
  });

  it('keeps a bare name when there is no quantity', () => {
    expect(parseIngredientLine('salt to taste')).toEqual({
      name: 'salt to taste',
    });
    expect(parseIngredientLine('Basmati Rice')).toEqual({
      name: 'Basmati Rice',
    });
  });

  it('keeps a lone apostrophe or digit in a name that is not an amount', () => {
    expect(parseIngredientLine("'nduja sausage").name).toBe("'nduja sausage");
    expect(parseIngredientLine('00 flour')).toEqual({ name: '00 flour' });
  });
});

describe('ingredients written quantity first', () => {
  it.each([
    ['100g pancetta', '@pancetta{100%g}'],
    ['50g pecorino cheese', '@pecorino cheese{50%g}'],
    ['1/2 teaspoon red chilli powder', '@red chilli powder{1/2%teaspoon}'],
    [
      '1 1/2 pounds boneless, skinless, chicken breasts',
      '@boneless, skinless, chicken breasts{1 1/2%pounds}',
    ],
    ['½ tbsp fresh ginger', '@fresh ginger{1/2%tbsp}'],
    ['1½ tsp salt', '@salt{1 1/2%tsp}'],
    ['3 large eggs', '@large eggs{3}'],
    ['8– 12 small tortillas', '@small tortillas{8-12}'],
    [
      '10-12 ounces portobello mushroom caps',
      '@portobello mushroom caps{10-12%ounces}',
    ],
    ['2 to 3 limes', '@limes{2-3}'],
    ['- 3/4 lb lean ground pork', '@lean ground pork{3/4%lb}'],
    ['1 heaping tsp of tomato paste', '@tomato paste{1%tsp}'],
    ['700g of chicken parts', '@chicken parts{700%g}'],
  ])('reads %s', (line, expected) => {
    expect(token(line)).toBe(expected);
  });

  it('spells a unit the usual way', () => {
    expect(token('1½ tspn paprika')).toBe('@paprika{1 1/2%tsp}');
    expect(token('2 tbs oil')).toBe('@oil{2%tbsp}');
  });

  it('reads past the same amount given in another measuring system', () => {
    expect(token('1/4 cup / 65 ml lime juice')).toBe('@lime juice{1/4%cup}');
    expect(token('700g / 1.2 lb skinless chicken thighs')).toBe(
      '@skinless chicken thighs{700%g}',
    );
  });

  it('puts an alternative measure in brackets in the note', () => {
    expect(parseIngredientLine('300g (10.5 oz) pork mince')).toEqual({
      quantity: '300',
      unit: 'g',
      name: 'pork mince',
      note: '10.5 oz',
    });
  });

  it('moves a trailing preparation to the note but leaves a comma that belongs to the name', () => {
    expect(parseIngredientLine('2 onions, finely chopped')).toEqual({
      quantity: '2',
      name: 'onions',
      note: 'finely chopped',
    });
    expect(
      parseIngredientLine('2 tablespoons olive oil, plus more for drizzling'),
    ).toMatchObject({
      name: 'olive oil',
      note: 'plus more for drizzling',
    });
    expect(parseIngredientLine('1 lb boneless, skinless chicken').name).toBe(
      'boneless, skinless chicken',
    );
  });

  it('turns the stray brackets some sites leave behind into a note', () => {
    expect(token('2 garlic cloves (, minced)')).toBe(
      '@garlic cloves{2}(minced)',
    );
    expect(
      token('1½ lbs tomatillos (about 12 of them, husked and rinsed)'),
    ).toBe('@tomatillos{1 1/2%lbs}(about 12 of them, husked and rinsed)');
  });

  it('takes the quantity from brackets at the front when there is none outside them', () => {
    expect(token('(2 tbsp) Ghee (substitute: peanut oil)')).toBe(
      '@Ghee{2%tbsp}(substitute: peanut oil)',
    );
    expect(token('(60 g) yogurt')).toBe('@yogurt{60%g}');
    expect(token('(14 oz.) can unsweetened coconut milk')).toBe(
      '@can unsweetened coconut milk{14%oz}',
    );
  });

  it('reads a hyphenated measure', () => {
    expect(token('1-inch piece of ginger, grated')).toBe(
      '@piece of ginger{1%inch}(grated)',
    );
  });

  it('reads a loose amount at the front', () => {
    expect(token('a pinch of saffron')).toBe('@saffron{a pinch}');
    expect(token('a handful of mint')).toBe('@mint{a handful}');
  });
});

describe('ingredients written name first, as Cookwell does', () => {
  it.each([
    ['Lamb stew meat, 1000 g', '@Lamb stew meat{1000%g}'],
    ['Mustard oil, 75 g', '@Mustard oil{75%g}'],
    ['Garlic, 2 cloves', '@Garlic{2%cloves}'],
    ['Tomatoes, 3', '@Tomatoes{3}'],
    ['Nutmeg, 1/4', '@Nutmeg{1/4}'],
    ['Whole cloves, 3-4', '@Whole cloves{3-4}'],
    ['Whole Milk Yogurt, ~200 g', '@Whole Milk Yogurt{200%g}'],
    ['Black Peppercorns, 1/2 spoonful', '@Black Peppercorns{1/2%spoonful}'],
    ['Cinnamon sticks, 1 small stick', '@Cinnamon sticks{1 small stick}'],
    ['Fresh ginger, a 1" piece', '@Fresh ginger{a 1" piece}'],
    ['Salt, to taste', '@Salt{to taste}'],
    ['Water, as needed', '@Water{as needed}'],
  ])('reads %s', (line, expected) => {
    expect(token(line)).toBe(expected);
  });

  it('splits at the last comma, so a comma in the name survives', () => {
    expect(token('Chicken thighs, bone-in, 700 g')).toBe(
      '@Chicken thighs, bone-in{700%g}',
    );
  });

  it('does not take a preparation after a comma for an amount', () => {
    expect(parseIngredientLine('Tomatoes, diced')).toEqual({
      name: 'Tomatoes',
      note: 'diced',
    });
  });
});

describe('parseIngredientLine on hostile or odd input', () => {
  it('stays fast on a long line of nothing', () => {
    const started = Date.now();
    parseIngredientLine(`${'1 '.repeat(2000)}x`);
    parseIngredientLine(`${'('.repeat(5000)}x`);
    parseIngredientLine(`${','.repeat(5000)}`);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('never returns an empty name for a line that has anything in it', () => {
    for (const line of ['(2 tbsp)', ',', '1/2', '100 g']) {
      expect(parseIngredientLine(line).name).not.toBe('');
    }
  });

  it('handles an unmatched bracket by keeping the rest as a note', () => {
    expect(parseIngredientLine('2 eggs (large')).toMatchObject({
      name: 'eggs',
      note: 'large',
    });
  });
});

describe('toCookIngredient', () => {
  it('renders quantity, unit, name and note', () => {
    expect(
      toCookIngredient({ quantity: '200', unit: 'g', name: 'flour' }),
    ).toBe('@flour{200%g}');
    expect(toCookIngredient({ quantity: '2', name: 'eggs' })).toBe('@eggs{2}');
    expect(toCookIngredient({ name: 'salt to taste' })).toBe(
      '@salt to taste{}',
    );
    expect(toCookIngredient({ name: 'garlic', note: 'minced' })).toBe(
      '@garlic{}(minced)',
    );
  });

  it('takes out the characters that would end or start a token early', () => {
    expect(
      toCookIngredient({
        quantity: '1',
        name: 'sugar} @evil{ #pan{} ~{5}',
        note: 'a) b ( c',
      }),
    ).toBe('@sugar evil pan 5{1}(a b c)');
  });
});
