import { describe, expect, it, jest } from '@jest/globals';

import { call, fakeServices, folder, said } from '../../../lib/mcp/tool-fakes';

describe('add_recipe', () => {
  it('tags the recipe, saves it and caches it', async () => {
    const services = fakeServices({
      tagBestEffort: jest.fn(
        async (source: string) => `>> cuisine: Thai\n${source}`,
      ),
    });
    const fake = folder();
    const result = await call(
      'add_recipe',
      { name: 'Green curry', content: 'Simmer @coconut milk{400%ml}.' },
      fake,
      services,
    );
    expect(said(result)).toContain('Saved "Green curry".');
    expect(fake.created[0]?.name).toBe('Green curry.cook');
    expect(fake.indexed[0]?.[2]).toContain('>> cuisine: Thai');
  });

  it('adds nothing when the same recipe is saved again, even though tagging changed the metadata of the first copy', async () => {
    const services = fakeServices({
      tagBestEffort: jest.fn(
        async (source: string) => `>> cuisine: Thai\n${source}`,
      ),
    });
    const fake = folder();
    const args = {
      name: 'Green curry',
      content: 'Simmer @coconut milk{400%ml}.',
    };
    await call('add_recipe', args, fake, services);
    const again = await call('add_recipe', args, fake, services);
    expect(fake.created).toHaveLength(1);
    expect(said(again)).toContain(
      '"Green curry" is already saved with this recipe, so nothing new was added.',
    );
    // The model is not asked to tag a recipe that will not be saved.
    expect(services.tagBestEffort).toHaveBeenCalledTimes(1);
  });

  it('matches the name ignoring case and accents', async () => {
    const fake = folder({ 'Crème brûlée.cook': 'Whisk @eggs{3}.' });
    const again = await call(
      'add_recipe',
      { name: 'CREME BRULEE', content: 'Whisk @eggs{3}.' },
      fake,
    );
    expect(fake.created).toEqual([]);
    expect(said(again)).toContain('already saved');
  });

  it('saves a different recipe under a name that is taken, and says another one exists', async () => {
    const fake = folder({ 'Soup.cook': 'Boil @water{1%l}.' });
    const result = await call(
      'add_recipe',
      { name: 'Soup', content: 'Simmer @stock{1%l}.' },
      fake,
    );
    expect(fake.created).toHaveLength(1);
    expect(said(result)).toContain(
      'A different recipe with the same name already exists (Soup (id: id-Soup.cook)), so there are now 2.',
    );
  });

  it('refuses content that is only spaces', async () => {
    const result = await call(
      'add_recipe',
      { name: 'Soup', content: '  \n ' },
      folder(),
    );
    expect(result.isError).toBe(true);
  });
});
