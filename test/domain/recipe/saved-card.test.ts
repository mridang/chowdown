import { describe, expect, it } from '@jest/globals';

import { toneFor } from '@/domain/recipe/card-style';
import { savedCard } from '@/domain/recipe/saved-card';

const SAVED = {
  id: 'drive-1',
  title: 'Chicken Chettinad | Chettinad Chicken Recipe',
  source_url: 'https://www.SeriousEats.com/recipes/chettinad',
  cover_url: 'https://example.com/cover.jpg',
  tags: {
    cuisine: ['Indian'],
    protein: ['Chicken'],
    difficulty: ['Medium'],
    diet: ['Gluten-free'],
    diet_type: ['Non-vegetarian'],
  },
  favourite: false,
  uncurated: false,
  cooklang: '>> time: 1 hour 20 min\n>> servings: 4\n\nCook @chicken{500%g}.\n',
};

describe('savedCard', () => {
  it('reads the card a saved recipe is shown with', () => {
    expect(savedCard(SAVED)).toMatchObject({
      id: 'drive-1',
      title: 'Chicken Chettinad',
      site: 'seriouseats.com',
      minutes: 80,
      servings: 4,
      difficulty: 'Medium',
      cuisine: 'Indian',
      protein: 'Chicken',
      diet: ['Gluten-free'],
      dietType: 'Non-vegetarian',
      favourite: false,
      cover: 'https://example.com/cover.jpg',
      tone: toneFor('drive-1'),
    });
  });

  it('leaves missing facts empty instead of inventing them', () => {
    expect(savedCard({ id: 'a', title: 'Toast' })).toMatchObject({
      site: '',
      cuisine: '',
      protein: '',
      diet: [],
      minutes: undefined,
      difficulty: undefined,
      cover: undefined,
    });
  });

  it('marks an idea', () => {
    expect(
      savedCard({ id: 'a', title: 'Toast', uncurated: true }),
    ).toMatchObject({ uncurated: true });
  });

  it('ignores tag values that are not text', () => {
    expect(
      savedCard({ id: 'a', title: 'Toast', tags: { cuisine: [1, 'Thai'] } }),
    ).toMatchObject({ cuisine: 'Thai' });
  });

  it('is nothing for an answer that is not a recipe', () => {
    expect(savedCard(null)).toBeUndefined();
    expect(savedCard('recipe')).toBeUndefined();
    expect(savedCard({ title: 'No id' })).toBeUndefined();
    expect(savedCard({ id: 'no-title' })).toBeUndefined();
  });
});
