import { describe, expect, it, jest } from '@jest/globals';

import { DriveNotConnectedError } from '../../../src/lib/auth/drive-access';
import type { User } from '../../../src/lib/db/users';
import type { DriveFile } from '../../../src/lib/drive/drive-client';
import {
  callTool,
  callToolOrExplain,
  noteTarget,
  type ToolContext,
} from '../../../src/lib/mcp/tool-calls';

const user = { id: 7, units: null, recipes_folder_id: 'folder' } as User;

/** A fake Drive folder holding the given recipes, remembering every write. */
function folder(initial: Readonly<Record<string, string>> = {}) {
  const contents = new Map(Object.entries(initial));
  const created: DriveFile[] = [];
  const updates: [string, string][] = [];
  const indexed: [string, string, string][] = [];
  const ctx: ToolContext = {
    user,
    token: 'tok',
    system: undefined,
    files: {
      list: async () =>
        [...contents.keys()].map((name) => ({ id: `id-${name}`, name })),
      read: async (id) => contents.get(id.replace(/^id-/, '')) ?? '',
      create: async (name, content) => {
        const file = {
          id: `id-${name}`,
          name: name.endsWith('.cook') ? name : `${name}.cook`,
        };
        created.push(file);
        contents.set(file.name, content);
        return file;
      },
      update: async (id, content) => {
        updates.push([id, content]);
      },
      index: async (id, name, source) => {
        indexed.push([id, name, source]);
      },
    },
  };
  return { ctx, created, updates, indexed };
}

/** Call a tool against a fake folder. */
function call(
  name: string,
  args: Record<string, unknown>,
  fake: ReturnType<typeof folder>,
) {
  return callTool(user, { name, arguments: args }, async () => fake.ctx);
}

/** The first line of text in a result. */
const said = (result: Awaited<ReturnType<typeof call>>) =>
  result.content[0]?.text ?? '';

const PANCAKES = ['>> servings: 4', '', 'Mix @flour{200%g}.', ''].join('\n');

describe('list_recipes', () => {
  it('says how many recipes there are', async () => {
    const result = await call(
      'list_recipes',
      {},
      folder({ 'Pancakes.cook': PANCAKES, 'Soup.cook': PANCAKES }),
    );
    expect(said(result)).toBe('Showing your 2 recipes.');
    expect(result.structuredContent).toMatchObject({
      recipes: [{ title: 'Pancakes' }, { title: 'Soup' }],
    });
  });

  it('says so when there are none', async () => {
    expect(said(await call('list_recipes', {}, folder()))).toBe(
      'No recipes yet.',
    );
  });
});

describe('search_recipes', () => {
  const fake = () =>
    folder({ 'Crème brûlée.cook': PANCAKES, 'Soup.cook': PANCAKES });

  it('matches names ignoring accents and case', async () => {
    const result = await call('search_recipes', { query: 'CREME' }, fake());
    expect(said(result)).toBe('Found 1 recipe matching "CREME".');
    expect(result.structuredContent).toMatchObject({ query: 'CREME' });
  });

  it('says so when nothing matches', async () => {
    expect(said(await call('search_recipes', { query: 'pizza' }, fake()))).toBe(
      'No recipes match "pizza".',
    );
  });
});

describe('get_recipe', () => {
  it('shows the recipe as a card', async () => {
    const result = await call(
      'get_recipe',
      { name: 'pancakes' },
      folder({ 'Pancakes.cook': PANCAKES }),
    );
    expect(said(result)).toBe('Showing the "Pancakes" recipe.');
    expect(result.structuredContent).toMatchObject({ id: 'id-Pancakes.cook' });
  });

  it('says when no recipe matches the name', async () => {
    const result = await call(
      'get_recipe',
      { name: 'pizza' },
      folder({ 'Pancakes.cook': PANCAKES }),
    );
    expect(said(result)).toBe('No recipe found matching "pizza".');
    expect(result.isError).toBeUndefined();
  });

  it('says no recipe was named, and never says "undefined", when the name is missing or blank', async () => {
    for (const args of [{}, { name: '' }, { name: '   ' }]) {
      const result = await call(
        'get_recipe',
        args,
        folder({ 'Pancakes.cook': PANCAKES }),
      );
      expect(said(result)).toBe(
        'No recipe was named. Say which recipe you mean.',
      );
    }
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
    expect(said(result)).toBe(
      'Saved "paneer ki sabji" as an idea to curate later.',
    );
    expect(fake.created).toHaveLength(1);
    const stored = fake.indexed[0];
    expect(stored?.[0]).toBe(fake.created[0]?.id);
    expect(stored?.[2]).toContain('make paneer ki sabji');
  });

  it('names an unnamed idea Untitled', async () => {
    const fake = folder();
    await call('capture_idea', { prompt: 'something' }, fake);
    expect(fake.created[0]?.name).toContain('Untitled');
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
    expect(said(result)).toBe('Logged your note on "Pancakes".');
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0]?.[1]).toContain('Added vanilla');
    expect(fake.indexed).toEqual([
      ['id-Pancakes.cook', 'Pancakes.cook', fake.updates[0]?.[1]],
    ]);
  });

  it('writes nothing when the recipe is not found', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'log_cooking',
      { recipe: 'pizza', note: 'x' },
      fake,
    );
    expect(said(result)).toBe('No recipe found matching "pizza".');
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
    expect(said(result)).toBe('Added your note on flour to "Pancakes".');
    expect(fake.updates[0]?.[1]).toContain('[note ingredient:flour]');
  });

  it('attaches a note to a step', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: 'rest it', step: 2 },
      fake,
    );
    expect(said(result)).toBe('Added your note on step 2 to "Pancakes".');
  });

  it('asks for the note text when it is blank, writing nothing', async () => {
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
    expect(said(result)).toBe('Set the cover for "Pancakes".');
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
    expect(said(result)).toBe('Removed the images from "Pancakes".');
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

describe('an unknown tool', () => {
  it('is reported as an error', async () => {
    const result = await call('make_coffee', {}, folder());
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: 'Unknown tool: make_coffee' }],
    });
  });

  it('opens Drive first, so the Drive problem wins over the name', async () => {
    const open = jest.fn(async () => {
      throw new DriveNotConnectedError();
    });
    await expect(
      callTool(user, { name: 'make_coffee' }, open),
    ).rejects.toBeInstanceOf(DriveNotConnectedError);
  });
});

describe('callToolOrExplain', () => {
  it('explains how to connect Drive, as a tool error, when it is not connected', async () => {
    const noDrive = { id: 1, refresh_token_enc: null } as User;
    const result = await callToolOrExplain(noDrive, { name: 'list_recipes' });
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('Connect Google Drive');
  });
});
