import { describe, expect, it } from '@jest/globals';

import { PANCAKES, call, folder, said } from '../../../lib/mcp/tool-fakes';

describe('search_recipes', () => {
  const fake = () =>
    folder({ 'Crème brûlée.cook': PANCAKES, 'Soup.cook': PANCAKES });

  it('matches names ignoring accents and case', async () => {
    const result = await call('search_recipes', { query: 'CREME' }, fake());
    expect(said(result)).toContain('Found 1 recipe matching "CREME".');
    expect(said(result)).toContain('Crème brûlée');
    expect(result.structuredContent).toMatchObject({ query: 'CREME' });
  });

  it('says so when nothing matches, without calling it an error', async () => {
    const result = await call('search_recipes', { query: 'pizza' }, fake());
    expect(said(result)).toBe('No recipes match "pizza".');
    expect(result.isError).toBeUndefined();
  });

  it('pages through a long list of matches', async () => {
    const many = folder(
      Object.fromEntries(
        Array.from({ length: 120 }, (_, i) => [`Pie ${i}.cook`, PANCAKES]),
      ),
    );
    const first = await call('search_recipes', { query: 'pie' }, many);
    expect(said(first)).toContain(
      'Found 120 recipes matching "pie"; showing 1-50 of 120. Call again with offset=50 for the next page.',
    );
    const second = await call(
      'search_recipes',
      { query: 'pie', offset: 100 },
      many,
    );
    expect(second.structuredContent).toMatchObject({
      recipes: expect.any(Array),
    });
    expect(
      (second.structuredContent as { recipes: unknown[] }).recipes,
    ).toHaveLength(20);
    expect(said(second)).not.toContain('Call again');
  });
});
