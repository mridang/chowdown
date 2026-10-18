import { describe, expect, it } from '@jest/globals';

import type { Note } from '../../../src/lib/recipe/cook-text';
import type { StepToken } from '../../../src/lib/recipe/cooklang';
import {
  declaredServings,
  DEFAULT_SERVINGS,
  displayQuantity,
  extraMetadata,
  groupNotes,
  initialUnits,
  MAX_SERVINGS,
  servingsOf,
  stepText,
} from '../../../src/lib/recipe/page-view';

describe('servingsOf', () => {
  it('reads the servings metadata', () => {
    expect(servingsOf([['servings', '6']])).toBe(6);
  });

  it('takes the first number of a range or a sentence', () => {
    expect(servingsOf([['servings', '4-6']])).toBe(4);
    expect(servingsOf([['Serves', 'Serves 3 people']])).toBe(3);
  });

  it('falls back to the default when absent or unusable', () => {
    expect(servingsOf([])).toBe(DEFAULT_SERVINGS);
    expect(servingsOf([['servings', 'a few']])).toBe(DEFAULT_SERVINGS);
    expect(servingsOf([['servings', '0']])).toBe(DEFAULT_SERVINGS);
  });

  it('caps an absurd number', () => {
    expect(servingsOf([['servings', '5000']])).toBe(MAX_SERVINGS);
  });
});

describe('declaredServings', () => {
  it('is undefined when the recipe does not say', () => {
    expect(declaredServings([['time', '10 min']])).toBeUndefined();
    expect(declaredServings([['servings', 'plenty']])).toBeUndefined();
  });

  it('reads what the recipe says', () => {
    expect(declaredServings([['Servings', '2']])).toBe(2);
  });
});

describe('initialUnits', () => {
  it('uses a saved measurement system', () => {
    expect(initialUnits('metric')).toBe('metric');
    expect(initialUnits('us')).toBe('us');
    expect(initialUnits('imperial')).toBe('imperial');
  });

  it('shows the recipe as written when nothing valid is saved', () => {
    expect(initialUnits(null)).toBe('original');
    expect(initialUnits(undefined)).toBe('original');
    expect(initialUnits('furlongs')).toBe('original');
  });
});

describe('groupNotes', () => {
  const ingredients = ['avocados', 'lime juice', 'red onion'];

  it('puts an ingredient note beside every loosely matching ingredient', () => {
    const notes: Note[] = [
      { scope: 'ingredient', key: 'lime', text: 'extra half' },
    ];
    const grouped = groupNotes(notes, ingredients, 2);
    expect(grouped.byIngredient).toEqual([[], ['extra half'], []]);
    expect(grouped.general).toEqual([]);
  });

  it('matches in either direction and ignores case', () => {
    const notes: Note[] = [
      { scope: 'ingredient', key: 'Red Onion, finely sliced', text: 'sweet' },
    ];
    expect(groupNotes(notes, ingredients, 1).byIngredient[2]).toEqual([
      'sweet',
    ]);
  });

  it('puts a step note beside its step', () => {
    const notes: Note[] = [{ scope: 'step', key: '2', text: 'less salt' }];
    expect(groupNotes(notes, ingredients, 3).byStep).toEqual([
      [],
      ['less salt'],
      [],
    ]);
  });

  it('keeps whole-recipe notes in the general list', () => {
    const notes: Note[] = [
      { scope: 'general', key: '', text: 'Kids loved it' },
    ];
    expect(groupNotes(notes, ingredients, 1).general).toEqual([
      { text: 'Kids loved it' },
    ]);
  });

  it('never drops a note whose target is gone', () => {
    const notes: Note[] = [
      { scope: 'ingredient', key: 'saffron', text: 'a pinch' },
      { scope: 'step', key: '9', text: 'wow' },
      { scope: 'ingredient', key: ' ', text: 'blank' },
    ];
    expect(groupNotes(notes, ingredients, 2).general).toEqual([
      { label: 'saffron', text: 'a pinch' },
      { label: 'Step 9', text: 'wow' },
      { label: ' ', text: 'blank' },
    ]);
  });
});

describe('stepText', () => {
  it('joins text, names and timers into one clean line', () => {
    const tokens: StepToken[] = [
      { kind: 'text', text: 'Fry the ' },
      { kind: 'ingredient', name: 'onion', quantity: '1' },
      { kind: 'text', text: ' in a ' },
      { kind: 'cookware', name: 'pan' },
      { kind: 'text', text: ' for  ' },
      { kind: 'timer', label: '5 minutes' },
      { kind: 'text', text: '. ' },
    ];
    expect(stepText(tokens)).toBe('Fry the onion in a pan for 5 minutes.');
  });
});

describe('extraMetadata', () => {
  it('keeps only lines nothing else on the page shows', () => {
    const metadata: [string, string][] = [
      ['servings', '4'],
      ['source', 'https://a.com'],
      ['time', '30 minutes'],
      ['images', 'https://a.com/1.jpg'],
      ['favourite', 'true'],
      ['cuisine', 'Indian'],
      ['diet', 'Vegan'],
      ['status', 'uncurated'],
      ['author', 'Gran'],
      ['empty', '  '],
    ];
    expect(extraMetadata(metadata)).toEqual([['author', 'Gran']]);
  });
});

describe('displayQuantity', () => {
  it('leaves an amount alone at the written servings in original units', () => {
    expect(displayQuantity('200 g', 1, 'original')).toBe('200 g');
  });

  it('scales for more or fewer people', () => {
    expect(displayQuantity('200 g', 2, 'original')).toBe('400 g');
    expect(displayQuantity('2 tbsp', 0.5, 'original')).toBe('1 tbsp');
  });

  it('converts to the chosen system after scaling', () => {
    expect(displayQuantity('1 cup', 2, 'metric')).toBe('473 ml');
    expect(displayQuantity('500 g', 1, 'us')).toBe('1.1 lb');
  });

  it('keeps amounts that have no number or no quantity', () => {
    expect(displayQuantity('a pinch', 3, 'metric')).toBe('a pinch');
    expect(displayQuantity('', 3, 'us')).toBe('');
  });
});
