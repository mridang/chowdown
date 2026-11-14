import { describe, expect, it, jest } from '@jest/globals';

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import type { User } from '@/domain/db/users';
import { callTool, callToolOrExplain } from '@/domain/mcp/tool-calls';
import {
  BackendFailureError,
  InvalidToolArgumentsError,
  UnknownToolError,
} from '@/lib/mcp';
import { guardFileOps } from '@/domain/mcp/tool-services';
import {
  PANCAKES,
  USER,
  call,
  fakeServices,
  folder,
  said,
} from '../../lib/mcp/tool-fakes';

describe('the arguments are checked before anything runs', () => {
  it('refuses an unknown tool without opening Drive', async () => {
    const open = jest.fn(async () => {
      throw new DriveNotConnectedError();
    });
    const attempt = callTool(
      USER,
      { name: 'make_coffee' },
      {
        ...fakeServices(),
        openDrive: open,
      },
    );
    await expect(attempt).rejects.toBeInstanceOf(UnknownToolError);
    await expect(attempt).rejects.toMatchObject({ tool: 'make_coffee' });
    expect(open).not.toHaveBeenCalled();
  });

  it.each([[undefined], [{}], [{ name: 5 }], [{ name: '' }]])(
    'refuses a call with no usable tool name (%j)',
    async (params) => {
      await expect(callTool(USER, params)).rejects.toBeInstanceOf(
        InvalidToolArgumentsError,
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
      {
        ...fakeServices(),
        openDrive: async () => folder().ctx,
      },
    );
    expect(said(result)).toBe('No recipes yet.');
  });

  it.each([
    ['get_recipe', {}, '`recipe` is required.'],
    ['get_recipe', { recipe: '  ' }, '`recipe` must not be blank.'],
    [
      'get_recipe',
      { title: 'pancakes' },
      '`title` is not an argument of this tool (it accepts: recipe).',
    ],
    ['get_recipe', { recipe: 5 }, '`recipe` must be text, not a number.'],
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
      { offset: -1 },
      '`offset` must be at least 0 (it is -1).',
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
      { ingredients: 5 },
      '`ingredients` must be a list, not a number.',
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
      '`page` is not an argument of this tool (it accepts: limit, offset).',
    ],
  ])(
    'answers %s with %j as an error that says what to change',
    async (name, args, problem) => {
      const fake = folder({ 'Pancakes.cook': PANCAKES });
      const result = await call(name, args, fake);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(said(result)).toContain(`Invalid arguments for ${name}: `);
      expect(said(result)).toContain(problem);
      expect(fake.updates).toEqual([]);
      expect(fake.created).toEqual([]);
    },
  );
});

describe('refusals say what to change', () => {
  it('closes every refusal with the arguments the tool takes, marking the required ones', async () => {
    const result = await call(
      'annotate_recipe',
      { note: 'y', extra: 1 },
      folder(),
    );
    expect(said(result)).toMatch(
      /The arguments are: recipe \(required\), note \(required\), ingredient, step\.$/,
    );
    expect(said(await call('list_recipes', { x: 1 }, folder()))).toContain(
      'The arguments are: limit, offset.',
    );
    expect(said(await call('list_filters', { x: 1 }, folder()))).toContain(
      'This tool takes no arguments.',
    );
  });

  it('does not open Drive for a call that is refused', async () => {
    const open = jest.fn(async () => folder().ctx);
    const result = await callTool(
      USER,
      { name: 'get_recipe', arguments: {} },
      {
        ...fakeServices(),
        openDrive: open,
      },
    );
    expect(result.isError).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('is not caught out by the older spellings of an argument', async () => {
    const services = fakeServices();
    const result = await callTool(
      USER,
      { name: 'browse_recipes', arguments: { diet: 'Gluten-free' } },
      {
        ...services,
        openDrive: async () => folder().ctx,
      },
    );
    expect(result.isError).toBeUndefined();
  });

  it('reads a pantry given as one piece of text', async () => {
    const result = await callTool(
      USER,
      {
        name: 'recipes_from_ingredients',
        arguments: { ingredients: '200 g flour and 2 eggs' },
      },
      {
        ...fakeServices(),
        openDrive: async () => folder().ctx,
      },
    );
    expect(result.isError).toBeUndefined();
    expect(said(result)).toContain('Pancakes');
  });

  it('reports every problem at once', async () => {
    const result = await call(
      'annotate_recipe',
      { note: '', step: 0, extra: 1 },
      folder(),
    );
    expect(said(result)).toBe(
      'Invalid arguments for annotate_recipe: ' +
        '`recipe` is required. ' +
        '`extra` is not an argument of this tool (it accepts: recipe, note, ingredient, step). ' +
        '`note` must be at least 1 character long. ' +
        '`note` must not be blank. ' +
        '`step` must be at least 1 (it is 0). ' +
        'The arguments are: recipe (required), note (required), ingredient, step.',
    );
  });

  it('reports at most ten problems of a hostile call, and stays short', async () => {
    const hostile = Object.fromEntries(
      Array.from({ length: 5000 }, (_, i) => [`k${i}`, 'x'.repeat(50)]),
    );
    const result = await call('annotate_recipe', hostile, folder());
    expect(said(result).length).toBeLessThan(1500);
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
      {
        ...fakeServices(),
        openDrive: async () => ctx,
      },
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
        throw new BackendFailureError('the AI model', new Error('internal'));
      }),
    });
    const result = await callToolOrExplain(
      USER,
      { name: 'find_recipes', arguments: { query: 'soup' } },
      {
        ...services,
        openDrive: open,
      },
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
        {
          ...services,
          openDrive: open,
        },
      ),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('lets malformed requests through for the router to answer as protocol errors', async () => {
    await expect(
      callToolOrExplain(
        USER,
        { name: 'make_coffee' },
        {
          ...fakeServices(),
          openDrive: open,
        },
      ),
    ).rejects.toBeInstanceOf(UnknownToolError);
    await expect(
      callToolOrExplain(
        USER,
        { name: 'get_recipe', arguments: 5 },
        {
          ...fakeServices(),
          openDrive: open,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidToolArgumentsError);
    await expect(
      callToolOrExplain(
        USER,
        { arguments: {} },
        {
          ...fakeServices(),
          openDrive: open,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidToolArgumentsError);
  });

  it('answers arguments that do not fit as a tool error, not a protocol error', async () => {
    const result = await callToolOrExplain(
      USER,
      { name: 'get_recipe', arguments: {} },
      {
        ...fakeServices(),
        openDrive: open,
      },
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('`recipe` is required.');
  });
});
