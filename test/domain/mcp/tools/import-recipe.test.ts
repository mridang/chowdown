import { describe, expect, it, jest } from '@jest/globals';

import {
  PANCAKES,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

describe('import_recipe', () => {
  it('converts the content, saves it and shows the card', async () => {
    const fake = folder();
    const result = await call(
      'import_recipe',
      {
        content: 'A page about bread',
        url: 'https://example.com/bread',
        images: ['https://example.com/a.jpg'],
      },
      fake,
    );
    expect(said(result)).toContain('Imported "Imported".');
    expect(fake.created).toHaveLength(1);
    expect(fake.created[0]?.name).toBe('Imported.cook');
    expect(fake.indexed).toHaveLength(1);
  });

  it('says a link that was already imported is there already', async () => {
    const services = fakeServices({
      findImported: jest.fn(async () => ({
        id: 'id-Bread.cook',
        name: 'Bread.cook',
        source: PANCAKES,
      })),
    });
    const fake = folder();
    const result = await call(
      'import_recipe',
      { content: 'x', url: 'https://example.com/bread' },
      fake,
      services,
    );
    expect(said(result)).toContain('"Bread" is already in your recipes.');
    expect(fake.created).toEqual([]);
  });

  it('refuses content that holds no recipe, saving nothing', async () => {
    const services = fakeServices({
      convertImport: jest.fn(async () => '>> title: Unknown\n'),
    });
    const fake = folder();
    const result = await call(
      'import_recipe',
      { content: 'a video page' },
      fake,
      services,
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(fake.created).toEqual([]);
  });
});
