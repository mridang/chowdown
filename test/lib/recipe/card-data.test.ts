import { describe, expect, it } from '@jest/globals';

import { cleanTitle, toCardRecipe, toneFor } from '@/lib/recipe/card-data';

const FULL = [
  '>> title: Chicken Chettinad | Chettinad Chicken Recipe',
  '>> source: https://www.SeriousEats.com/recipes/chettinad?utm_source=x',
  '>> time: 1 hour 20 min',
  '>> servings: 4',
  '>> cuisine: Indian',
  '>> protein: chicken',
  '>> difficulty: Medium',
  '>> diet: Gluten-free',
  '>> method: Stovetop',
  '>> images: https://example.com/cover.jpg https://example.com/two.jpg',
  '',
  'Cook @chicken thigh{500%g} with @onion{1}.',
  '',
].join('\n');

const row = (source: string, name = 'Curry.cook', id = 'drive-1') => ({
  drive_file_id: id,
  name,
  source,
});

describe('cleanTitle', () => {
  it('keeps the part before the first separator', () => {
    expect(cleanTitle('Chicken Chettinad | Chettinad Chicken Recipe')).toBe(
      'Chicken Chettinad',
    );
    expect(cleanTitle('Dal – the easy way')).toBe('Dal');
  });

  it('leaves a plain title and hyphenated words alone', () => {
    expect(cleanTitle('Stir-fried greens')).toBe('Stir-fried greens');
  });
});

describe('toneFor', () => {
  it('is stable for the same text', () => {
    expect(toneFor('abc')).toBe(toneFor('abc'));
  });
});

describe('toCardRecipe', () => {
  it('reads every fact a fully described recipe has', () => {
    const card = toCardRecipe(row(FULL), true);
    expect(card).toMatchObject({
      id: 'drive-1',
      title: 'Chicken Chettinad',
      site: 'seriouseats.com',
      minutes: 80,
      servings: 4,
      difficulty: 'Medium',
      cuisine: 'Indian',
      protein: 'chicken',
      diet: ['Gluten-free'],
      dietType: 'Non-vegetarian',
      method: ['Stovetop'],
      favourite: true,
    });
    expect(card.cooklang).toBeUndefined();
  });

  it('leaves missing facts undefined or empty instead of inventing them', () => {
    const card = toCardRecipe(row('Stir @egg{2} in a pan.\n'), false);
    expect(card.title).toBe('Curry');
    expect(card.minutes).toBeUndefined();
    expect(card.servings).toBeUndefined();
    expect(card.difficulty).toBeUndefined();
    expect(card.site).toBe('');
    expect(card.cover).toBeUndefined();
    expect(card.cuisine).toBe('');
    expect(card.favourite).toBe(false);
  });

  it('ignores a servings value that is not a positive number', () => {
    expect(
      toCardRecipe(row('>> servings: lots\n\nMix @flour{1}.\n'), false)
        .servings,
    ).toBeUndefined();
    expect(
      toCardRecipe(row('>> servings: 0\n\nMix @flour{1}.\n'), false).servings,
    ).toBeUndefined();
  });

  it('has no site when the source is not a web address', () => {
    const card = toCardRecipe(
      row('>> source: my gran\n\nMix @flour{1}.\n'),
      false,
    );
    expect(card.site).toBe('');
  });

  it('reads the cover photo', () => {
    expect(toCardRecipe(row(FULL), false).cover).toBe(
      'https://example.com/cover.jpg',
    );
  });

  it('marks an uncurated idea and keeps the marker out of its title', () => {
    const idea = toCardRecipe(
      row('Make something.\n', 'paneer ki sabji [uncurated].cook'),
      false,
    );
    expect(idea.uncurated).toBe(true);
    expect(idea.title).toBe('paneer ki sabji');
    expect(toCardRecipe(row(FULL), false).uncurated).toBeUndefined();
  });

  it('includes the Cooklang source only when asked', () => {
    expect(toCardRecipe(row(FULL), false, { withSource: true }).cooklang).toBe(
      FULL,
    );
  });

  it('gives the same colour tile to the same recipe', () => {
    expect(toCardRecipe(row(FULL), false).tone).toBe(
      toCardRecipe(row(FULL), true).tone,
    );
  });
});
