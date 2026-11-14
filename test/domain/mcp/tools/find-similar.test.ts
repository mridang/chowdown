import { describe, expect, it, jest } from '@jest/globals';

import {
  PANCAKES,
  USER,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

describe('find_similar', () => {
  it('asks the index to cover the named recipe first', async () => {
    const services = fakeServices();
    const fake = folder({ 'Pancakes.cook': PANCAKES, 'Soup.cook': PANCAKES });
    const result = await call(
      'find_similar',
      { recipe: 'soup' },
      fake,
      services,
    );
    expect(said(result)).toContain('Recipes similar to "Soup".');
    expect(services.searchIndex).toHaveBeenCalledWith(
      USER,
      expect.anything(),
      'tok',
      'id-Soup.cook',
    );
  });

  it('is an error, with nothing structured, when the recipe is not found', async () => {
    const result = await call(
      'find_similar',
      { recipe: 'pizza' },
      folder({ 'Pancakes.cook': PANCAKES }),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });

  it('is an error when the recipe could not be indexed', async () => {
    const services = fakeServices({
      searchIndex: jest.fn(async () => ({ rows: [], waiting: 1 })),
    });
    const result = await call(
      'find_similar',
      { recipe: 'pancakes' },
      folder({ 'Pancakes.cook': PANCAKES }),
      services,
    );
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: 'Could not compute similarity for that recipe.' }],
    });
  });

  it('still takes the recipe as `name`, which is what it was called before', async () => {
    const result = await call(
      'find_similar',
      { name: 'soup' },
      folder({ 'Pancakes.cook': PANCAKES, 'Soup.cook': PANCAKES }),
    );
    expect(said(result)).toContain('Recipes similar to "Soup".');
  });
});
