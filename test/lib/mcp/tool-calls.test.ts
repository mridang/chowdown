import { describe, expect, it, jest } from '@jest/globals';

import { DriveNotConnectedError } from '../../../src/lib/auth/drive-access';
import type { User } from '../../../src/lib/db/users';
import {
  callTool,
  callToolOrExplain,
  noteTarget,
} from '../../../src/lib/mcp/tool-calls';
import {
  BackendFailure,
  InvalidToolArguments,
  UnknownTool,
} from '../../../src/lib/mcp/tool-errors';
import { guardFileOps } from '../../../src/lib/mcp/tool-services';
import { PANCAKES, USER, call, fakeServices, folder, said } from './tool-fakes';

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

  it('says how many are left out of a very long list', async () => {
    const many = Object.fromEntries(
      Array.from({ length: 250 }, (_, i) => [`Recipe ${i}.cook`, PANCAKES]),
    );
    const result = await call('list_recipes', {}, folder(many));
    expect(said(result)).toContain('…and 50 more not shown');
    expect(result.structuredContent).toMatchObject({
      recipes: expect.arrayContaining([]),
    });
  });
});

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
});

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

describe('find_similar', () => {
  it('asks the index to cover the named recipe first', async () => {
    const services = fakeServices();
    const fake = folder({ 'Pancakes.cook': PANCAKES, 'Soup.cook': PANCAKES });
    const result = await call('find_similar', { name: 'soup' }, fake, services);
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
      { name: 'pizza' },
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
      { name: 'pancakes' },
      folder({ 'Pancakes.cook': PANCAKES }),
      services,
    );
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: 'Could not compute similarity for that recipe.' }],
    });
  });
});

describe('get_recipe', () => {
  it('shows the recipe as a card and as readable text', async () => {
    const result = await call(
      'get_recipe',
      { name: 'pancakes' },
      folder({ 'Pancakes.cook': PANCAKES }),
    );
    expect(said(result)).toContain('Showing the "Pancakes" recipe.');
    expect(said(result)).toContain('- 200 g flour');
    expect(said(result)).toContain('1. Mix 200 g flour with 2 eggs in a bowl.');
    expect(said(result)).toContain('servings: 4');
    expect(result.structuredContent).toMatchObject({ id: 'id-Pancakes.cook' });
  });

  it('is an error that offers similar names when no recipe matches', async () => {
    const result = await call(
      'get_recipe',
      { name: 'pancake mix' },
      folder({ 'Pancakes.cook': PANCAKES }),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(said(result)).toContain('No recipe found matching "pancake mix".');
    expect(said(result)).toContain('Pancakes (id: id-Pancakes.cook)');
  });

  it('points at the listing tools when nothing is even close', async () => {
    const result = await call(
      'get_recipe',
      { name: 'pizza' },
      folder({ 'Pancakes.cook': PANCAKES }),
    );
    expect(said(result)).toContain('list_recipes');
  });

  it('shows the best match and names the others when several fit a read', async () => {
    const result = await call(
      'get_recipe',
      { name: 'pie' },
      folder({ 'Apple pie.cook': PANCAKES, 'Pie crust.cook': PANCAKES }),
    );
    expect(result.isError).toBeUndefined();
    expect(said(result)).toContain('Showing the "Apple pie" recipe.');
    expect(said(result)).toContain(
      'also matches Pie crust (id: id-Pie crust.cook)',
    );
  });
});

describe('capture_idea', () => {
  it('saves an uncurated stub with the request kept verbatim, and caches it', async () => {
    const fake = folder();
    const result = await call(
      'capture_idea',
      { name: 'paneer ki sabji', prompt: 'make paneer ki sabji' },
      fake,
    );
    expect(said(result)).toContain(
      'Saved "paneer ki sabji" as an idea to curate later.',
    );
    expect(fake.created).toHaveLength(1);
    const stored = fake.indexed[0];
    expect(stored?.[0]).toBe(fake.created[0]?.id);
    expect(stored?.[2]).toContain('make paneer ki sabji');
  });
});

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
});

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

describe('log_cooking', () => {
  it('appends a dated note, saves it and refreshes the cache', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'Added vanilla' },
      fake,
    );
    expect(said(result)).toContain('Logged your note on "Pancakes".');
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]?.[1]).toContain('Added vanilla');
    expect(fake.indexed).toEqual([
      ['id-Pancakes.cook', 'Pancakes.cook', fake.updates[0]?.[1]],
    ]);
  });

  it('writes nothing, and is an error, when the recipe is not found', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pizza', note: 'x' },
      fake,
    );
    expect(said(result)).toContain('No recipe found matching "pizza".');
    expect(result.isError).toBe(true);
    expect(fake.updates).toEqual([]);
  });
});

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

describe('annotate_recipe', () => {
  it('attaches a note to an ingredient', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: 'use 3', ingredient: 'flour' },
      fake,
    );
    expect(said(result)).toContain('Added your note on flour to "Pancakes".');
    expect(fake.updates[0]?.[1]).toContain('[note ingredient:flour]');
  });

  it('attaches a note to a step', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: 'rest it', step: 2 },
      fake,
    );
    expect(said(result)).toContain('Added your note on step 2 to "Pancakes".');
  });

  it('asks for the note text when it is only spaces, writing nothing', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: '  ' },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(fake.updates).toEqual([]);
  });
});

describe('noteTarget', () => {
  it('prefers an ingredient over a step, and falls back to a general note', () => {
    expect(noteTarget({ ingredient: ' lime ', step: 3 })).toMatchObject({
      scope: 'ingredient',
      key: 'lime',
    });
    expect(noteTarget({ step: 3 })).toMatchObject({ scope: 'step', key: '3' });
    expect(noteTarget({})).toEqual({ scope: 'general', key: '', where: '' });
  });
});

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

describe('set_measurement_system', () => {
  it('remembers the system without opening Drive', async () => {
    const services = fakeServices();
    const open = jest.fn(async () => folder().ctx);
    const result = await callTool(
      USER,
      { name: 'set_measurement_system', arguments: { system: 'metric' } },
      open,
      services,
    );
    expect(said(result)).toContain('metric');
    expect(services.setUnits).toHaveBeenCalledWith(7, 'metric');
    expect(open).not.toHaveBeenCalled();
  });
});

describe('the question-shaped tools', () => {
  it('browse_recipes answers from the cache without opening Drive', async () => {
    const open = jest.fn(async () => folder().ctx);
    const result = await callTool(
      USER,
      { name: 'browse_recipes', arguments: { cuisine: 'French' } },
      open,
      fakeServices(),
    );
    expect(said(result)).toContain('Soup');
    expect(result.structuredContent).toMatchObject({
      recipes: [{ title: 'Soup' }],
    });
    expect(open).not.toHaveBeenCalled();
  });

  it('passes a value the collection does not hold back as an error', async () => {
    const result = await callTool(
      USER,
      { name: 'browse_recipes', arguments: { cuisine: 'Martian' } },
      async () => folder().ctx,
      fakeServices(),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });

  it('list_filters answers in plain text', async () => {
    const result = await callTool(
      USER,
      { name: 'list_filters' },
      async () => folder().ctx,
      fakeServices(),
    );
    expect(said(result)).toContain('2 recipes saved.');
    expect(result.structuredContent).toBeUndefined();
  });

  it('recipes_from_ingredients matches the pantry', async () => {
    const result = await callTool(
      USER,
      {
        name: 'recipes_from_ingredients',
        arguments: { ingredients: ['200 g flour', '2 eggs'] },
      },
      async () => folder().ctx,
      fakeServices(),
    );
    expect(said(result)).toContain('Pancakes');
  });
});

describe('a call that names no recipe, or an ambiguous one, never touches the wrong file', () => {
  const WRITES = [
    ['log_cooking', { note: 'x' }],
    ['annotate_recipe', { note: 'x' }],
    ['tag_recipe', {}],
    ['set_recipe_images', { images: ['https://example.com/a.jpg'] }],
    ['favourite_recipe', {}],
  ] as const;

  it.each(WRITES)(
    '%s refuses a missing, blank or misnamed recipe',
    async (name, rest) => {
      for (const named of [
        {},
        { recipe: '' },
        { recipe: '   ' },
        { name: 'pancakes' },
      ]) {
        const fake = folder({ 'Pancakes.cook': PANCAKES });
        await expect(
          call(name, { ...rest, ...named }, fake),
        ).rejects.toBeInstanceOf(InvalidToolArguments);
        expect(fake.updates).toEqual([]);
      }
    },
  );

  it.each(WRITES)(
    '%s writes nothing when several recipes fit the name',
    async (name, rest) => {
      const services = fakeServices();
      const fake = folder({
        'Apple pie.cook': PANCAKES,
        'Pie crust.cook': PANCAKES,
      });
      const result = await call(
        name,
        { ...rest, recipe: 'pie' },
        fake,
        services,
      );
      expect(result.isError).toBe(true);
      expect(said(result)).toContain('Several recipes match "pie"');
      expect(said(result)).toContain('Apple pie (id: id-Apple pie.cook)');
      expect(said(result)).toContain('as `recipe`');
      expect(fake.updates).toEqual([]);
      expect(services.setFavourite).not.toHaveBeenCalled();
    },
  );

  it.each(WRITES)(
    '%s acts on the exact id of one of several matches',
    async (name, rest) => {
      const fake = folder({
        'Apple pie.cook': PANCAKES,
        'Pie crust.cook': PANCAKES,
      });
      const result = await call(
        name,
        { ...rest, recipe: 'id-Pie crust.cook' },
        fake,
      );
      expect(result.isError).toBeUndefined();
    },
  );
});

describe('the arguments are checked before anything runs', () => {
  it('refuses an unknown tool without opening Drive', async () => {
    const open = jest.fn(async () => {
      throw new DriveNotConnectedError();
    });
    const attempt = callTool(USER, { name: 'make_coffee' }, open);
    await expect(attempt).rejects.toBeInstanceOf(UnknownTool);
    await expect(attempt).rejects.toMatchObject({ tool: 'make_coffee' });
    expect(open).not.toHaveBeenCalled();
  });

  it.each([[undefined], [{}], [{ name: 5 }], [{ name: '' }]])(
    'refuses a call with no usable tool name (%j)',
    async (params) => {
      await expect(callTool(USER, params)).rejects.toBeInstanceOf(
        InvalidToolArguments,
      );
    },
  );

  it('refuses arguments that are not an object', async () => {
    for (const bad of ['text', 5, [], null, true]) {
      await expect(
        callTool(USER, { name: 'list_recipes', arguments: bad }),
      ).rejects.toMatchObject({
        problems: ['`arguments` must be an object.'],
      });
    }
  });

  it('treats omitted arguments as none', async () => {
    const result = await callTool(
      USER,
      { name: 'list_recipes' },
      async () => folder().ctx,
    );
    expect(said(result)).toBe('No recipes yet.');
  });

  it.each([
    ['get_recipe', {}, '`name` is required.'],
    ['get_recipe', { name: '  ' }, '`name` must not be blank.'],
    [
      'get_recipe',
      { recipe: 'pancakes' },
      '`recipe` is not an argument of this tool (it accepts: name).',
    ],
    ['get_recipe', { name: 5 }, '`name` must be text, not a number.'],
    ['browse_recipes', { limit: 0 }, '`limit` must be at least 1 (it is 0).'],
    ['browse_recipes', { limit: 51 }, '`limit` must be at most 50 (it is 51).'],
    [
      'browse_recipes',
      { limit: 2.5 },
      '`limit` must be a whole number, not a number.',
    ],
    [
      'browse_recipes',
      { limit: '5' },
      '`limit` must be a whole number, not text.',
    ],
    [
      'browse_recipes',
      { difficulty: 'easy' },
      '`difficulty` must be one of: Easy, Medium, Hard.',
    ],
    [
      'browse_recipes',
      { max_minutes: -1 },
      '`max_minutes` must be at least 0 (it is -1).',
    ],
    [
      'browse_recipes',
      { favourites_only: 'yes' },
      '`favourites_only` must be true or false, not text.',
    ],
    ['recipes_from_ingredients', {}, '`ingredients` is required.'],
    [
      'recipes_from_ingredients',
      { ingredients: 'tomatoes' },
      '`ingredients` must be a list, not text.',
    ],
    [
      'recipes_from_ingredients',
      { ingredients: [] },
      '`ingredients` must have at least 1 item.',
    ],
    [
      'recipes_from_ingredients',
      { ingredients: [5] },
      '`ingredients[0]` must be text, not a number.',
    ],
    [
      'search_recipes',
      { query: '' },
      '`query` must be at least 1 character long.',
    ],
    [
      'set_measurement_system',
      { system: 'Metric' },
      '`system` must be one of: metric, us, imperial.',
    ],
    [
      'import_recipe',
      { content: 'x', url: 'ftp://example.com' },
      '`url` must match the pattern ^https?://\\S+$.',
    ],
    [
      'import_recipe',
      { content: 'x', images: Array.from({ length: 21 }, () => 'u') },
      '`images` must have at most 20 items (it has 21).',
    ],
    ['add_recipe', { name: 'x' }, '`content` is required.'],
    ['capture_idea', { prompt: 'x' }, '`name` is required.'],
    [
      'annotate_recipe',
      { recipe: 'x', note: 'y', step: 0 },
      '`step` must be at least 1 (it is 0).',
    ],
    [
      'annotate_recipe',
      { recipe: 'x', note: 'y', step: 'two' },
      '`step` must be a whole number, not text.',
    ],
    [
      'list_recipes',
      { page: 2 },
      '`page` is not an argument of this tool (it accepts: none).',
    ],
  ])('refuses %s with %j', async (name, args, problem) => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const attempt = call(name, args, fake);
    await expect(attempt).rejects.toBeInstanceOf(InvalidToolArguments);
    await expect(attempt).rejects.toMatchObject({
      problems: expect.arrayContaining([problem]),
    });
    expect(fake.updates).toEqual([]);
    expect(fake.created).toEqual([]);
  });

  it('reports every problem at once', async () => {
    await expect(
      call('annotate_recipe', { note: '', step: 0, extra: 1 }, folder()),
    ).rejects.toMatchObject({
      problems: [
        '`recipe` is required.',
        '`extra` is not an argument of this tool (it accepts: recipe, note, ingredient, step).',
        '`note` must be at least 1 character long.',
        '`step` must be at least 1 (it is 0).',
      ],
    });
  });
});

describe('callToolOrExplain', () => {
  const open = async () => folder({ 'Pancakes.cook': PANCAKES }).ctx;

  it('explains how to connect Drive, as a tool error, when it is not connected', async () => {
    const noDrive = { id: 1, refresh_token_enc: null } as User;
    const result = await callToolOrExplain(noDrive, { name: 'list_recipes' });
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('Connect Google Drive');
  });

  it('turns a Drive failure into a tool error that leaks nothing', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const broken = folder();
    const ctx = {
      ...broken.ctx,
      files: guardFileOps({
        ...broken.ctx.files,
        list: async () => {
          throw new Error('Drive 503: quota exceeded for project 12345');
        },
      }),
    };
    const result = await callToolOrExplain(
      USER,
      { name: 'list_recipes' },
      async () => ctx,
      fakeServices(),
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('Google Drive');
    expect(said(result)).toContain('Try again in a minute');
    expect(said(result)).not.toContain('12345');
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('turns a failing model or database into a tool error', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const services = fakeServices({
      embedQuery: jest.fn(async () => {
        throw new BackendFailure('the AI model', new Error('internal'));
      }),
    });
    const result = await callToolOrExplain(
      USER,
      { name: 'find_recipes', arguments: { query: 'soup' } },
      open,
      services,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('the AI model');
    expect(said(result)).not.toContain('internal');
    quiet.mockRestore();
  });

  it('lets a fault in our own code escape, for the router to answer as an internal error', async () => {
    const services = fakeServices({
      embedQuery: jest.fn(async () => {
        throw new TypeError('x is not a function');
      }),
    });
    await expect(
      callToolOrExplain(
        USER,
        { name: 'find_recipes', arguments: { query: 'soup' } },
        open,
        services,
      ),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('lets protocol errors through for the router to answer', async () => {
    await expect(
      callToolOrExplain(USER, { name: 'make_coffee' }, open),
    ).rejects.toBeInstanceOf(UnknownTool);
    await expect(
      callToolOrExplain(USER, { name: 'get_recipe', arguments: {} }, open),
    ).rejects.toBeInstanceOf(InvalidToolArguments);
  });
});
