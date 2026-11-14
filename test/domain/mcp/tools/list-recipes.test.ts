import { describe, expect, it } from '@jest/globals';

import { PANCAKES, call, folder, said } from '../../../lib/mcp/tool-fakes';

describe('list_recipes', () => {
  it('says how many recipes there are and lists them with their ids', async () => {
    const result = await call(
      'list_recipes',
      {},
      folder({ 'Pancakes.cook': PANCAKES, 'Soup.cook': PANCAKES }),
    );
    expect(said(result)).toContain('Showing your 2 recipes.');
    expect(said(result)).toContain('- Pancakes (id: id-Pancakes.cook)');
    expect(said(result)).toContain('- Soup (id: id-Soup.cook)');
    expect(result.structuredContent).toMatchObject({
      recipes: [{ title: 'Pancakes' }, { title: 'Soup' }],
    });
  });

  it('says so when there are none', async () => {
    expect(said(await call('list_recipes', {}, folder()))).toBe(
      'No recipes yet.',
    );
  });

  describe('with more recipes than one page', () => {
    const many = () =>
      folder(
        Object.fromEntries(
          Array.from({ length: 250 }, (_, i) => [
            `Recipe ${String(i).padStart(3, '0')}.cook`,
            PANCAKES,
          ]),
        ),
      );
    const idsOf = (result: Awaited<ReturnType<typeof call>>): string[] =>
      (
        (result.structuredContent as unknown as { recipes: { id: string }[] })
          .recipes ?? []
      ).map((r) => r.id);

    it('gives the first 50 and says how to get the next page', async () => {
      const result = await call('list_recipes', {}, many());
      expect(said(result)).toContain(
        'Showing recipes 1-50 of 250. Call again with offset=50 for the next page.',
      );
      expect(idsOf(result)).toHaveLength(50);
      expect(
        said(result)
          .split('\n')
          .filter((l) => l.startsWith('- ')),
      ).toHaveLength(50);
    });

    it('gives pages that together name every recipe once', async () => {
      const fake = many();
      const pages = await Promise.all(
        [0, 50, 100, 150, 200].map((offset) =>
          call('list_recipes', { offset }, fake),
        ),
      );
      const all = pages.flatMap((page) => idsOf(page));
      expect(all).toHaveLength(250);
      expect(new Set(all).size).toBe(250);
      expect(said(pages[4]!)).not.toContain('Call again');
      expect(said(pages[4]!)).toContain('Showing recipes 201-250 of 250.');
    });

    it('takes the page size from limit, up to 200', async () => {
      const result = await call('list_recipes', { limit: 200 }, many());
      expect(idsOf(result)).toHaveLength(200);
      expect(said(result)).toContain('offset=200');
    });

    it('refuses a limit above 200', async () => {
      const result = await call('list_recipes', { limit: 201 }, many());
      expect(result.isError).toBe(true);
    });

    it('says so, with nothing listed, when the page starts past the end', async () => {
      const result = await call('list_recipes', { offset: 900 }, many());
      expect(said(result)).toBe(
        'Nothing starts at offset 900: there are only 250 recipes.',
      );
      expect(idsOf(result)).toEqual([]);
    });
  });
});
