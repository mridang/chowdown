import { describe, expect, it } from '@jest/globals';

import { AnnotateRecipeTool } from '@/domain/mcp/tools/annotate-recipe';
import {
  PANCAKES,
  USER,
  call,
  fakeServices,
  folder,
  said,
} from '../../../lib/mcp/tool-fakes';

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

  it('refuses an ingredient and a step together, writing nothing', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: 'x', ingredient: 'flour', step: 1 },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('either `ingredient` or `step`');
    expect(fake.updates).toEqual([]);
  });

  it('refuses a step the recipe does not have, saying how many it has', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: 'x', step: 999 },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain(
      'That recipe has 2 steps, so there is no step 999.',
    );
    expect(fake.updates).toEqual([]);
  });

  it('refuses a step of a recipe that has none', async () => {
    const fake = folder({ 'Idea.cook': '>> title: Idea\n' });
    const result = await call(
      'annotate_recipe',
      { recipe: 'idea', note: 'x', step: 1 },
      fake,
    );
    expect(said(result)).toContain('no numbered steps');
    expect(fake.updates).toEqual([]);
  });

  it('refuses an ingredient the recipe does not have, listing the ones it has', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: 'x', ingredient: 'saffron' },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('no ingredient called "saffron"');
    expect(said(result)).toContain('Its ingredients are: flour, eggs');
    expect(fake.updates).toEqual([]);
  });

  it('matches an ingredient loosely, as the page does', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await call(
      'annotate_recipe',
      { recipe: 'pancakes', note: 'sifted', ingredient: 'Plain FLOUR' },
      fake,
    );
    expect(result.isError).toBeUndefined();
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

describe('a recipe with a very long ingredient list', () => {
  it('lists the first twelve and says there are more, so the refusal stays short', async () => {
    const many = Array.from(
      { length: 15 },
      (_unused, n) => `@ingredient${n}{1}`,
    ).join(' ');
    const fake = folder({ 'Stew.cook': `${many}\n\nCook it.\n` });
    const result = await call(
      'annotate_recipe',
      { recipe: 'stew', note: 'x', ingredient: 'saffron' },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('ingredient11');
    expect(said(result)).toContain(', and more.');
    expect(said(result)).not.toContain('ingredient12');
    expect(fake.updates).toEqual([]);
  });
});

describe('AnnotateRecipeTool.handle', () => {
  it('asks for the note when one arrives blank, which the schema already forbids', async () => {
    const fake = folder({ 'Pancakes.cook': PANCAKES });
    const result = await new AnnotateRecipeTool().handle(
      { recipe: 'pancakes', note: ' '.repeat(3) },
      {
        user: USER,
        services: { ...fakeServices(), openDrive: async () => fake.ctx },
      },
    );
    expect(result.isError).toBe(true);
    expect(said(result)).toBe('What note should I add?');
    expect(fake.updates).toEqual([]);
  });
});
