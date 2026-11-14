import { describe, expect, it, jest } from '@jest/globals';

import { callTool } from '@/domain/mcp/tool-calls';
import { noteTarget } from '@/domain/mcp/tools/recipe-support';

import {
  PANCAKES,
  USER,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

describe('the daily allowance for tools that call a model', () => {
  const used = (wait: number | undefined) =>
    fakeServices({
      spendModelBudget: jest.fn(async () => wait),
    });

  it.each([
    ['import_recipe', { content: 'A page' }],
    ['add_recipe', { name: 'Toast', content: 'Toast @bread{2}.' }],
    ['tag_recipe', { recipe: 'Pancakes' }],
  ])(
    'refuses %s once the allowance is used up, saying when it renews, before Drive is opened',
    async (name, args) => {
      const fake = folder();
      const opened = jest.fn(async () => fake.ctx);
      const result = await callTool(
        USER,
        { name, arguments: args },
        {
          ...used(7200),
          openDrive: opened,
        },
      );
      expect(result.isError).toBe(true);
      expect(said(result)).toMatch(/allowance.*used up.*2 hour/);
      expect(opened).not.toHaveBeenCalled();
      expect(fake.created).toEqual([]);
    },
  );

  it('lets them through while there is allowance left', async () => {
    const result = await call(
      'import_recipe',
      { content: 'A page about bread' },
      folder(),
      used(undefined),
    );
    expect(result.isError).not.toBe(true);
  });

  it('does not spend it on tools that only read', async () => {
    const services = used(7200);
    const result = await call('list_recipes', {}, folder(), services);
    expect(result.isError).not.toBe(true);
    expect(services.spendModelBudget).not.toHaveBeenCalled();
  });
});

describe('two edits of one recipe at the same time', () => {
  const logged = (text: string): number =>
    text.split('\n').filter((line) => line.startsWith('-- [cook ')).length;
  const notes = (text: string): number =>
    text.split('\n').filter((line) => line.startsWith('-- [note')).length;

  it('both land, whatever order they finish in', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const [one, two] = await Promise.all([
      call('log_cooking', { recipe: 'pancakes', note: 'Added vanilla' }, fake),
      call('annotate_recipe', { recipe: 'pancakes', note: 'rest it' }, fake),
    ]);
    expect(one.isError).toBeUndefined();
    expect(two.isError).toBeUndefined();
    const final = fake.contents.get('Pancakes.cook') ?? '';
    expect(logged(final)).toBe(1);
    expect(notes(final)).toBe(1);
    expect(final).toContain('Added vanilla');
    expect(final).toContain('rest it');
  });

  it('all of four land', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        call('log_cooking', { recipe: 'pancakes', note: `cook ${i}` }, fake),
      ),
    );
    expect(results.map((r) => r.isError)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    const final = fake.contents.get('Pancakes.cook') ?? '';
    expect(logged(final)).toBe(4);
    for (const i of [0, 1, 2, 3]) {
      expect(final).toContain(`cook ${i}`);
    }
  });

  it('shows each caller the recipe as it was stored, with the other edit in it', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const [, second] = await Promise.all([
      call('log_cooking', { recipe: 'pancakes', note: 'first' }, fake),
      call('log_cooking', { recipe: 'pancakes', note: 'second' }, fake),
    ]);
    const stored = fake.contents.get('Pancakes.cook') ?? '';
    expect(second.structuredContent).toMatchObject({
      logs: expect.arrayContaining([
        expect.objectContaining({ note: 'second' }),
      ]),
    });
    expect(fake.indexed.at(-1)?.[2]).toBe(stored);
  });

  it('notices when another save replaced ours right after, and makes the edit again on top of it', async () => {
    const fake = folder(
      { 'Pancakes.cook': PANCAKES },
      {
        afterUpdate: (_name, writes, change) => {
          // Someone saved from the text we started with, replacing our write.
          if (writes === 1) {
            change(`${PANCAKES}-- [note] saved by someone else\n`);
          }
        },
      },
    );
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'Added vanilla' },
      fake,
    );
    expect(result.isError).toBeUndefined();
    expect(fake.updates).toHaveLength(2);
    const final = fake.contents.get('Pancakes.cook') ?? '';
    expect(final).toContain('saved by someone else');
    expect(final).toContain('Added vanilla');
  });

  it('edits of different recipes do not interfere', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES, 'Soup.cook': PANCAKES });
    await Promise.all([
      call('log_cooking', { recipe: 'pancakes', note: 'a' }, fake),
      call('log_cooking', { recipe: 'soup', note: 'b' }, fake),
    ]);
    expect(fake.updates).toHaveLength(2);
  });

  it('a change made elsewhere while the edit is being worked out is kept, and the edit is made on top of it', async () => {
    const fake = folder(
      { 'Pancakes.cook': PANCAKES },
      {
        afterRead: (_name, reads, change) => {
          // Someone edits the file in Drive right after the first read.
          if (reads === 1) {
            change(`${PANCAKES}-- [note] written in Drive\n`);
          }
        },
      },
    );
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'Added vanilla' },
      fake,
    );
    expect(result.isError).toBeUndefined();
    const final = fake.contents.get('Pancakes.cook') ?? '';
    expect(final).toContain('written in Drive');
    expect(final).toContain('Added vanilla');
    expect(fake.updates).toHaveLength(1);
  });

  it('gives up with an error that says the outcome is uncertain, when the file keeps changing', async () => {
    const fake = folder(
      { 'Pancakes.cook': PANCAKES },
      {
        afterRead: (_name, reads, change) =>
          change(`${PANCAKES}-- [note] edit number ${reads}\n`),
      },
    );
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'Added vanilla' },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('not certain it was saved');
    expect(fake.updates).toEqual([]);
  });

  it('gives up the same way when every save of ours is replaced', async () => {
    const fake = folder(
      { 'Pancakes.cook': PANCAKES },
      {
        afterUpdate: (_name, writes, change) =>
          change(`${PANCAKES}-- [note] rival ${writes}\n`),
      },
    );
    const result = await call(
      'log_cooking',
      { recipe: 'pancakes', note: 'Added vanilla' },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('not certain it was saved');
    expect(fake.indexed).toEqual([]);
  });

  it('works the edit out again after a change, so a tag is not applied to stale text', async () => {
    const services = fakeServices();
    const fake = folder(
      { 'Pancakes.cook': PANCAKES },
      {
        afterRead: (_name, reads, change) => {
          if (reads === 1) {
            change(`${PANCAKES}-- [note] changed meanwhile\n`);
          }
        },
      },
    );
    await call('tag_recipe', { recipe: 'pancakes' }, fake, services);
    expect(services.tag).toHaveBeenCalledTimes(2);
    expect(fake.updates[0]?.[1]).toContain('changed meanwhile');
  });

  it('does not report an edit that changes nothing as lost', async () => {
    const fake = folder({
      'Pancakes.cook': '>> images: https://example.com/a.jpg\n\nMix.\n',
    });
    const result = await call(
      'set_recipe_images',
      { recipe: 'pancakes', images: ['https://example.com/a.jpg'] },
      fake,
    );
    expect(result.isError).toBeUndefined();
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

describe('the question-shaped tools', () => {
  it('browse_recipes answers from the cache without opening Drive', async () => {
    const open = jest.fn(async () => folder().ctx);
    const result = await callTool(
      USER,
      { name: 'browse_recipes', arguments: { cuisine: 'French' } },
      {
        ...fakeServices(),
        openDrive: open,
      },
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
      {
        ...fakeServices(),
        openDrive: async () => folder().ctx,
      },
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });

  it('list_filters answers in plain text', async () => {
    const result = await callTool(
      USER,
      { name: 'list_filters' },
      {
        ...fakeServices(),
        openDrive: async () => folder().ctx,
      },
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
      {
        ...fakeServices(),
        openDrive: async () => folder().ctx,
      },
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
        { recipe: ' '.repeat(3) },
        { name: 'pancakes' },
      ]) {
        const fake = folder({ 'Pancakes.cook': PANCAKES });
        const result = await call(name, { ...rest, ...named }, fake);
        expect(result.isError).toBe(true);
        expect(said(result)).toContain(`Invalid arguments for ${name}: `);
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

describe('when very many recipes match one reference', () => {
  it('names the first few and counts the rest, so the message stays readable', async () => {
    const many = Object.fromEntries(
      ['Apple', 'Berry', 'Cherry', 'Damson', 'Elder', 'Fig', 'Grape'].map(
        (fruit) => [`${fruit} pie.cook`, PANCAKES],
      ),
    );
    const fake = folder(many);
    const result = await callTool(
      USER,
      {
        name: 'favourite_recipe',
        arguments: { recipe: 'pie' },
      },
      {
        ...fakeServices(),
        openDrive: async () => fake.ctx,
      },
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('Several recipes match "pie"');
    expect(said(result)).toMatch(/; and 2 more\./);
  });
});
