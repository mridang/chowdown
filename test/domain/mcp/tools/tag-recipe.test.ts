import { describe, expect, it, jest } from '@jest/globals';

import {
  PANCAKES,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

describe('tag_recipe', () => {
  it('writes the tags onto the recipe', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call('tag_recipe', { recipe: 'pancakes' }, fake);
    expect(said(result)).toContain('Tagged "Pancakes".');
    expect(fake.updates[0]?.[1]).toContain('>> cuisine: Italian');
  });

  it('is an error, changing nothing, when nothing could be tagged', async () => {
    const services = fakeServices({
      tag: jest.fn(async (source: string) => ({ source, tags: [] })),
    });
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'tag_recipe',
      { recipe: 'pancakes' },
      fake,
      services,
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(fake.updates).toEqual([]);
  });
});
