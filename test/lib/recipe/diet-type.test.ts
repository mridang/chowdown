import { describe, expect, it } from '@jest/globals';

import { classifyDietType } from '../../../src/lib/recipe/diet-type';

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
    expect(classifyDietType([])).toBe('Vegan');
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
