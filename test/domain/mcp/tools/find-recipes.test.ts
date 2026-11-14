import { describe, expect, it, jest } from '@jest/globals';

import {
  PANCAKES,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

describe('find_recipes', () => {
  it('ranks the recipes against the query', async () => {
    const services = fakeServices();
    const result = await call(
      'find_recipes',
      { query: 'something quick' },
      folder({ 'Pancakes.cook': PANCAKES, 'Soup.cook': PANCAKES }),
      services,
    );
    expect(said(result)).toContain(
      'Here are recipes matching "something quick".',
    );
    expect(services.embedQuery).toHaveBeenCalledWith('something quick');
    expect(result.structuredContent).toMatchObject({
      query: 'something quick',
    });
  });

  it('says when some recipes are not indexed yet and the results may be incomplete', async () => {
    const services = fakeServices({
      searchIndex: jest.fn(async () => ({ rows: [], waiting: 3 })),
    });
    const result = await call(
      'find_recipes',
      { query: 'soup' },
      folder({ 'Pancakes.cook': PANCAKES }),
      services,
    );
    expect(said(result)).toContain('3 recipes not searchable yet');
    expect(said(result)).toContain('Search again');
  });
});
