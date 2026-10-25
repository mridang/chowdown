import { describe, expect, it } from '@jest/globals';

import { classifyDietType } from '@/domain/recipe/diet-type';

describe('classifyDietType', () => {
  it('calls anything with meat or poultry non-vegetarian', () => {
    expect(classifyDietType(['chicken thighs', 'rice'])).toBe('Non-vegetarian');
    expect(classifyDietType(['spaghetti', 'bacon', 'egg'])).toBe(
      'Non-vegetarian',
    );
    expect(classifyDietType(['beef stock', 'onion'])).toBe('Non-vegetarian');
    expect(classifyDietType(['chorizo'])).toBe('Non-vegetarian');
  });

  it('calls fish and shellfish without meat pescatarian', () => {
    expect(classifyDietType(['salmon fillet', 'lemon'])).toBe('Pescatarian');
    expect(classifyDietType(['prawns', 'garlic', 'butter'])).toBe(
      'Pescatarian',
    );
    expect(classifyDietType(['rice', 'fish sauce'])).toBe('Pescatarian');
  });

  it('calls dairy, egg and honey without meat or fish vegetarian', () => {
    expect(classifyDietType(['pasta', 'parmesan'])).toBe('Vegetarian');
    expect(classifyDietType(['eggs', 'spinach'])).toBe('Vegetarian');
    expect(classifyDietType(['paneer', 'tomato', 'ghee'])).toBe('Vegetarian');
    expect(classifyDietType(['oats', 'honey'])).toBe('Vegetarian');
  });

  it('calls a recipe with no animal products vegan', () => {
    expect(classifyDietType(['chickpeas', 'tomato', 'olive oil'])).toBe(
      'Vegan',
    );
  });

  it('is not fooled by plant-based look-alikes', () => {
    expect(classifyDietType(['coconut milk', 'curry paste', 'tofu'])).toBe(
      'Vegan',
    );
    expect(classifyDietType(['almond milk', 'peanut butter'])).toBe('Vegan');
    expect(
      classifyDietType(['eggplant', 'butternut squash', 'butter beans']),
    ).toBe('Vegan');
    expect(classifyDietType(['vegan cheese', 'plant-based chicken'])).toBe(
      'Vegan',
    );
  });

  it('leaves a recipe with no ingredients unclassified rather than vegan', () => {
    expect(classifyDietType([])).toBeUndefined();
    expect(classifyDietType([], ['vegetable'])).toBeUndefined();
  });

  it('knows cured and regional meats, and fish hiding in sauces', () => {
    expect(classifyDietType(["'nduja", 'pasta'])).toBe('Non-vegetarian');
    expect(classifyDietType(['jamón', 'melon'])).toBe('Non-vegetarian');
    expect(classifyDietType(['pâté', 'toast'])).toBe('Non-vegetarian');
    expect(classifyDietType(['lamb shanks', 'garlic'])).toBe('Non-vegetarian');
    expect(classifyDietType(['rice', 'oyster sauce'])).toBe('Pescatarian');
    expect(classifyDietType(['potatoes', 'worcestershire sauce'])).toBe(
      'Pescatarian',
    );
    expect(classifyDietType(['swordfish steak'])).toBe('Pescatarian');
    expect(classifyDietType(['catfish', 'cornmeal'])).toBe('Pescatarian');
  });

  it('is not fooled by words that merely contain an animal word', () => {
    expect(classifyDietType(['celery ribs', 'carrot'])).toBe('Vegan');
    expect(classifyDietType(['firm bean curd', 'soy sauce'])).toBe('Vegan');
    expect(classifyDietType(['flax egg', 'oat flour'])).toBe('Vegan');
    expect(classifyDietType(['garlic, mince', 'romano beans'])).toBe('Vegan');
    expect(classifyDietType(['crab apples', 'sugar'])).toBe('Vegan');
  });

  it("treats 'chicken or vegetable stock' as a choice, not a meat ingredient", () => {
    expect(classifyDietType(['chicken or vegetable stock', 'cheddar'])).toBe(
      'Vegetarian',
    );
    expect(classifyDietType(['vegetable or beef broth', 'onion'])).toBe(
      'Vegan',
    );
    expect(classifyDietType(['chicken stock', 'onion'])).toBe('Non-vegetarian');
  });

  it('lets the most restrictive ingredient win', () => {
    expect(classifyDietType(['salmon', 'chicken stock'])).toBe(
      'Non-vegetarian',
    );
    expect(classifyDietType(['tuna', 'cheddar'])).toBe('Pescatarian');
  });

  it('uses the protein tags when the ingredients are thin', () => {
    expect(classifyDietType([], ['chicken'])).toBe('Non-vegetarian');
    expect(classifyDietType([], ['seafood'])).toBe('Pescatarian');
    expect(classifyDietType([], ['egg'])).toBe('Vegetarian');
    expect(classifyDietType(['rice'], ['vegetable'])).toBe('Vegan');
  });
});

describe('classifyDietType — look-alikes and hidden animal products', () => {
  const V = 'Vegan';
  const VEG = 'Vegetarian';
  const P = 'Pescatarian';
  const N = 'Non-vegetarian';

  it.each([
    // plant-based substitutes named after the thing they replace
    ['vegan sausages', V],
    ['veggie meatballs', V],
    ['vegan ham', V],
    ['tofu chorizo', V],
    ['mushroom bacon', V],
    ['tempeh bacon', V],
    ['walnut meat', V],
    ['meat-free mince', V],
    ['chicken-free broth', V],
    ['no-chicken broth', V],
    ['vegan worcestershire sauce', V],
    ['vegan oyster sauce', V],
    ['vegan cream cheese', V],
    ['cashew cream cheese', V],
    ['vegan sour cream', V],
    ['vegan whipped cream', V],
    ['vegan honey', V],
    ['dairy free butter', V],
    ['macadamia milk', V],
    ['sunflower seed butter', V],
    ['cacao butter', V],
    ['cream of coconut', V],
    ['cream of wheat', V],
    ['vegan kimchi', V],
    // plants and fungi with animal names
    ['oyster mushrooms', V],
    ['pigeon peas', V],
    ['moringa drumsticks', V],
    ['lamb’s lettuce', V],
    ['beef tomatoes', V],
    ['cauliflower steak', V],
    ['cauliflower wings', V],
    ['hot dog buns', V],
    ['chicken of the woods', V],
    ['mock duck', V],
    ['pâte brisée', V],
    ['duck sauce', V],
    // animal products that are not the animal they sound like
    ['goat cheese', VEG],
    ["goat's milk", VEG],
    ['quail eggs', VEG],
    ['duck egg', VEG],
    ['crab meat', P],
    ['crabmeat', P],
    ['tuna steak', P],
    // hidden animal products
    ['kimchi', P],
    ['caesar dressing', P],
    ['shellfish stock', P],
    ['hamburger', N],
    ['mince', N],
    ['gammon', N],
    ['poultry seasoning, chicken', N],
    ['half and half', VEG],
    ['alfredo sauce', VEG],
    ['pepper jack cheese', VEG],
    ['tzatziki', VEG],
    ['hollandaise', VEG],
    ['eggnog', VEG],
  ])('%s → %s', (ingredient, expected) => {
    expect(classifyDietType([ingredient])).toBe(expected);
  });

  it('treats stock alternatives however they are written', () => {
    expect(
      classifyDietType(['chicken stock cubes or vegetable stock cubes']),
    ).toBe(V);
    expect(classifyDietType(['chicken stock (or vegetable)'])).toBe(V);
    expect(classifyDietType(['vegetable stock or chicken stock'])).toBe(V);
    expect(classifyDietType(['chicken stock'])).toBe(N);
    expect(classifyDietType(['chicken or vegetable stock, with chicken'])).toBe(
      N,
    );
  });

  it('does not take a gluten-free label as proof that the animal part is absent', () => {
    expect(classifyDietType(['gluten-free chicken stock'])).toBe(N);
  });

  it('does not treat blank names as ingredients', () => {
    expect(classifyDietType([''])).toBeUndefined();
    expect(classifyDietType(['  ', ''])).toBeUndefined();
  });

  it('is fast on very long input', () => {
    const started = Date.now();
    classifyDietType(['vegan ' + 'cream '.repeat(50_000)]);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
