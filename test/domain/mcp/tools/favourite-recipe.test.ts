import { describe, expect, it } from '@jest/globals';

import {
  PANCAKES,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

describe('favourite_recipe', () => {
  it('hearts a recipe, and removes the heart when asked', async () => {
    const services = fakeServices();
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const added = await call(
      'favourite_recipe',
      { recipe: 'pancakes' },
      fake,
      services,
    );
    const removed = await call(
      'favourite_recipe',
      { recipe: 'pancakes', favourite: false },
      fake,
      services,
    );
    expect(said(added)).toBe('Added "Pancakes" to your favourites.');
    expect(said(removed)).toBe('Removed "Pancakes" from your favourites.');
    expect(services.setFavourite).toHaveBeenNthCalledWith(
      1,
      7,
      'id-Pancakes.cook',
      true,
    );
    expect(services.setFavourite).toHaveBeenNthCalledWith(
      2,
      7,
      'id-Pancakes.cook',
      false,
    );
  });
});
