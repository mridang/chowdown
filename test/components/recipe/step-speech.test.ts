import { describe, expect, it } from '@jest/globals';

import {
  spokenQuantity,
  spokenStep,
} from '../../../src/components/recipe/step-speech';

describe('spokenQuantity', () => {
  it.each([
    ['200 g', '200 grams'],
    ['1 g', '1 gram'],
    ['2 kg', '2 kilograms'],
    ['250 ml', '250 millilitres'],
    ['2 tbsp', '2 tablespoons'],
    ['1 tsp', '1 teaspoon'],
    ['3 cups', '3 cups'],
    ['2', '2'],
    ['0.5 l', 'half a litre'],
  ])('says %p as %p', (label, spoken) => {
    expect(spokenQuantity(label)).toBe(spoken);
  });

  it('says fractions as words, never as a date', () => {
    expect(spokenQuantity('1/2 tsp')).toBe('half a teaspoon');
    expect(spokenQuantity('½ tsp')).toBe('half a teaspoon');
    expect(spokenQuantity('1/4 tsp')).toBe('a quarter of a teaspoon');
    expect(spokenQuantity('3/4 cup')).toBe('three quarters of a cup');
    expect(spokenQuantity('1/3 cup')).toBe('a third of a cup');
    expect(spokenQuantity('2/3 cup')).toBe('two thirds of a cup');
    expect(spokenQuantity('1/2')).toBe('half');
  });

  it('says mixed numbers with "and"', () => {
    expect(spokenQuantity('1 1/2 cups')).toBe('1 and a half cups');
    expect(spokenQuantity('2 3/4 tsp')).toBe('2 and three quarters teaspoons');
  });

  it('leaves a fraction without words as written', () => {
    expect(spokenQuantity('5/8 cup')).toBe('5/8 cup');
  });

  it('says a range with "to"', () => {
    expect(spokenQuantity('1-2 hours')).toBe('1 to 2 hours');
    expect(spokenQuantity('5 to 10 min')).toBe('5 to 10 minutes');
  });

  it('spells out time units', () => {
    expect(spokenQuantity('5 min')).toBe('5 minutes');
    expect(spokenQuantity('1 hr')).toBe('1 hour');
    expect(spokenQuantity('90 sec')).toBe('90 seconds');
  });

  it('keeps words after the unit', () => {
    expect(spokenQuantity('2 tbsp chopped')).toBe('2 tablespoons chopped');
  });

  it('returns text that is not an amount as it is', () => {
    expect(spokenQuantity('to taste')).toBe('to taste');
    expect(spokenQuantity('a pinch')).toBe('a pinch');
  });

  it('passes an unknown unit through', () => {
    expect(spokenQuantity('2 cloves')).toBe('2 cloves');
  });
});

describe('spokenStep', () => {
  it('reads the text, with an ingredient followed by its amount', () => {
    expect(
      spokenStep([
        { kind: 'text', text: 'Fry the ' },
        { kind: 'ingredient', name: 'onion', quantity: '2' },
        { kind: 'text', text: ' in a ' },
        { kind: 'cookware', name: 'pan' },
        { kind: 'text', text: ' for ' },
        { kind: 'timer', label: '5 min' },
        { kind: 'text', text: '.' },
      ]),
    ).toBe('Fry the onion, 2, in a pan for 5 minutes.');
  });

  it('uses the amount the page is showing: scaled and converted', () => {
    expect(
      spokenStep([{ kind: 'ingredient', name: 'flour', quantity: '100 g' }], {
        quantity: (q) => (q === '100 g' ? '200 g' : q),
      }),
    ).toBe('flour, 200 grams,');
  });

  it('leaves out the amount of an ingredient that has none', () => {
    expect(
      spokenStep([{ kind: 'ingredient', name: 'salt', quantity: '' }]),
    ).toBe('salt');
  });

  it('does not stutter a comma before punctuation', () => {
    expect(
      spokenStep([
        { kind: 'ingredient', name: 'salt', quantity: '1 tsp' },
        { kind: 'text', text: ', then stir.' },
      ]),
    ).toBe('salt, 1 teaspoon, then stir.');
    expect(
      spokenStep([
        { kind: 'ingredient', name: 'salt', quantity: '1 tsp' },
        { kind: 'text', text: '.' },
      ]),
    ).toBe('salt, 1 teaspoon.');
  });

  it('says temperatures with their words', () => {
    expect(
      spokenStep([{ kind: 'text', text: 'Heat the oven to 180°C (350°F).' }]),
    ).toBe('Heat the oven to 180 degrees Celsius (350 degrees Fahrenheit).');
  });

  it('collapses stray spaces', () => {
    expect(spokenStep([{ kind: 'text', text: '  Stir   well \n now ' }])).toBe(
      'Stir well now',
    );
  });

  it('can start with the step number', () => {
    expect(spokenStep([{ kind: 'text', text: 'Chop.' }], { number: 3 })).toBe(
      'Step 3. Chop.',
    );
  });
});
