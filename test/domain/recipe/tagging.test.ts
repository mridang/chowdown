import { describe, expect, it, jest } from '@jest/globals';

import {
  suggestTags,
  tagCookSource,
  tagCookSourceBestEffort,
} from '@/domain/recipe/tagging';
import { parseRecipe } from '@/lib/cooklang';
import { fakeEnv } from '../../fixtures/env';

const DIET_VEGETARIAN = /- diet [^\n]*Vegetarian/u;

const SOURCE = '>> title: Curry\n\nCook @chicken{500%g} in a #pan{}.\n';

function envReturning(response: unknown): CloudflareEnv {
  return fakeEnv({
    AI: { run: jest.fn(async () => ({ response })) },
  });
}

describe('suggestTags', () => {
  it('keeps vocabulary values from a JSON string response', async () => {
    const tags = await suggestTags(
      parseRecipe(SOURCE, 'curry.cook'),
      envReturning('{"protein":["chicken","unicorn"],"cuisine":"Indian"}'),
    );
    expect(Object.fromEntries(tags)).toEqual({
      protein: 'chicken',
      cuisine: 'Indian',
    });
  });

  it('accepts an already-parsed object response', async () => {
    const tags = await suggestTags(
      parseRecipe(SOURCE, 'curry.cook'),
      envReturning({ difficulty: 'Easy' }),
    );
    expect(tags).toEqual([['difficulty', 'Easy']]);
  });

  it('returns nothing for an unusable response', async () => {
    expect(
      await suggestTags(parseRecipe(SOURCE, 'c.cook'), envReturning('no json')),
    ).toEqual([]);
  });
});

describe('tagCookSource', () => {
  it('writes tags into the metadata', async () => {
    const out = await tagCookSource(
      SOURCE,
      'curry.cook',
      envReturning('{"cuisine":"Indian"}'),
    );
    expect(out.source).toContain('>> cuisine: Indian');
    expect(out.tags).toEqual([['cuisine', 'Indian']]);
  });

  it('leaves the source untouched when nothing is tagged', async () => {
    const out = await tagCookSource(SOURCE, 'c.cook', envReturning('{}'));
    expect(out.source).toBe(SOURCE);
  });
});

describe('tagCookSourceBestEffort', () => {
  it('returns tagged source on success', async () => {
    const out = await tagCookSourceBestEffort(
      SOURCE,
      'c.cook',
      envReturning('{"cuisine":"Thai"}'),
    );
    expect(out).toContain('>> cuisine: Thai');
  });

  it('returns the source unchanged when the model call throws', async () => {
    const env = fakeEnv({
      AI: {
        run: jest.fn(async () => {
          throw new Error('model down');
        }),
      },
    });
    expect(await tagCookSourceBestEffort(SOURCE, 'c.cook', env)).toBe(SOURCE);
  });
});

describe('the tagging prompt', () => {
  it('does not ask the model for the eating style, which is worked out', async () => {
    const run = jest.fn<
      (
        model: string,
        input: { messages: { role: string; content: string }[] },
      ) => Promise<{ response: string }>
    >(async () => ({ response: '{}' }));
    await suggestTags(
      parseRecipe(SOURCE, 'curry.cook'),
      fakeEnv({
        AI: { run },
      }),
    );
    const system = run.mock.calls[0]![1].messages.find(
      (m) => m.role === 'system',
    )!.content;
    expect(system).not.toContain('diet_type');
    expect(system).not.toContain('Pescatarian');
    expect(system).toContain('- diet (choose all that apply): Gluten-free');
    expect(system).not.toMatch(DIET_VEGETARIAN);
  });
});
