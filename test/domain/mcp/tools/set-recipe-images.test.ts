import { describe, expect, it } from '@jest/globals';

import { PANCAKES, call, folder, said } from '../../../lib/mcp/tool-fakes';

describe('set_recipe_images', () => {
  it('sets the cover from image links', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'set_recipe_images',
      { recipe: 'pancakes', images: ['https://example.com/a.jpg'] },
      fake,
    );
    expect(said(result)).toContain('Set the cover for "Pancakes".');
    expect(fake.updates[0]?.[1]).toContain('https://example.com/a.jpg');
  });

  it('removes the images when asked to clear', async () => {
    const fake = folder({
      'Pancakes.cook': '>> images: https://example.com/a.jpg\n\nMix.\n',
    });
    const result = await call(
      'set_recipe_images',
      { recipe: 'pancakes', clear: true },
      fake,
    );
    expect(said(result)).toContain('Removed the images from "Pancakes".');
    expect(fake.updates[0]?.[1]).not.toContain('example.com');
  });

  it('refuses images together with clear, changing nothing', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'set_recipe_images',
      {
        recipe: 'pancakes',
        images: ['https://example.com/a.jpg'],
        clear: true,
      },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('not both');
    expect(fake.updates).toEqual([]);
  });

  it('refuses when there are no usable links, writing nothing', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'set_recipe_images',
      { recipe: 'pancakes', images: ['not a url'] },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(fake.updates).toEqual([]);
  });
});
