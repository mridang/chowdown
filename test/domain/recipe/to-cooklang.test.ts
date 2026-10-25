import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  addMissingCover,
  ConversionError,
  convertImport,
  convertToCooklang,
  hasRecipeBody,
} from '@/domain/recipe/to-cooklang';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
});

/** A fake Workers AI binding that returns the given Cooklang. */
function envWith(response: string): CloudflareEnv {
  return {
    AI: { run: jest.fn(async () => ({ response })) },
  } as unknown as CloudflareEnv;
}

const jsonLdPage = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    '@type': 'Recipe',
    name: 'Page Recipe',
    image: 'https://a.com/hero.jpg',
    recipeIngredient: ['1 egg'],
    recipeInstructions: ['Boil the egg.'],
  },
)}</script></head></html>`;

describe('convertImport', () => {
  it('prefers structured data fetched from the source page', async () => {
    global.fetch = (async () =>
      new Response(jsonLdPage)) as unknown as typeof fetch;
    const cook = await convertImport(
      'plain article text',
      envWith('>> title: LLM\n'),
      {
        sourceUrl: 'https://a.com/x',
      },
    );
    expect(cook).toContain('>> title: Page Recipe');
    expect(cook).toContain('https://a.com/hero.jpg');
  });

  it('falls back to the model and adds the og:image as the cover', async () => {
    global.fetch = (async () =>
      new Response(
        '<meta property="og:image" content="https://a.com/og.jpg">',
      )) as unknown as typeof fetch;
    const cook = await convertImport(
      'article text',
      envWith('>> title: From Model\n\nMix @egg{1}.\n'),
      { sourceUrl: 'https://a.com/x' },
    );
    expect(cook).toContain('>> title: From Model');
    expect(cook).toContain('>> images: https://a.com/og.jpg');
  });

  it('still converts when the source page cannot be fetched', async () => {
    global.fetch = (async () =>
      new Response('blocked', { status: 403 })) as unknown as typeof fetch;
    const cook = await convertImport(
      'article text',
      envWith('>> title: From Model\n\nMix @egg{1}.\n'),
      { sourceUrl: 'https://a.com/x' },
    );
    expect(cook).toContain('>> title: From Model');
    expect(cook).not.toContain('images:');
  });

  it('does not fetch when no source url is given', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    await convertImport('article', envWith('>> title: T\n\nMix.\n'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('uses structured data already present in the content without fetching', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const cook = await convertImport(jsonLdPage, envWith('x'), {
      sourceUrl: 'https://a.com/x',
    });
    expect(cook).toContain('>> title: Page Recipe');
    expect(spy).not.toHaveBeenCalled();
  });
});

const metadataOnlyPage = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    '@type': 'Recipe',
    name: 'Hollow Recipe',
    image: 'https://a.com/hollow.jpg',
    recipeIngredient: [],
    recipeInstructions: [],
  },
)}</script></head></html>`;

describe('structured data with no recipe in it', () => {
  it('converts the passed content instead and keeps the page image', async () => {
    global.fetch = (async () =>
      new Response(metadataOnlyPage)) as unknown as typeof fetch;
    const cook = await convertImport(
      'Ingredients: 1 egg. Method: boil it.',
      envWith('>> title: Real\n\nBoil @egg{1}.\n'),
      { sourceUrl: 'https://a.com/x' },
    );
    expect(cook).toContain('>> title: Real');
    expect(cook).not.toContain('Hollow Recipe');
    expect(cook).toContain('>> images: https://a.com/hollow.jpg');
  });

  it('convertToCooklang also falls through to the model', async () => {
    const cook = await convertToCooklang(
      metadataOnlyPage,
      envWith('>> title: From Model\n\nBoil @egg{1}.\n'),
    );
    expect(cook).toContain('>> title: From Model');
  });
});

describe('convertToCooklang', () => {
  it('strips blank and unknown metadata the model emits', async () => {
    const cook = await convertToCooklang(
      'article',
      envWith('>> title: T\n>> servings: \n>> time: unknown\n\nMix @egg{1}.'),
    );
    expect(cook).toContain('>> title: T');
    expect(cook).not.toContain('servings');
    expect(cook).not.toContain('unknown');
  });
});

describe('what the model is shown', () => {
  /** The user message the model was sent. */
  function sentTo(env: CloudflareEnv): string {
    const run = env.AI.run as unknown as jest.Mock<
      (model: string, input: { messages: { content: string }[] }) => unknown
    >;
    return run.mock.calls[0]?.[1].messages.at(-1)?.content ?? '';
  }

  it('is the page without its scripts and style sheets, so a long script cannot push the recipe out', async () => {
    const env = envWith('Mix @egg{1}.');
    await convertToCooklang(
      `<script>${'x'.repeat(30_000)}</script><style>p{}</style><p>Boil the pasta for ten minutes.</p>`,
      env,
    );
    expect(sentTo(env)).toContain('Boil the pasta for ten minutes.');
    expect(sentTo(env)).not.toContain('xxxx');
    expect(sentTo(env)).not.toContain('p{}');
  });

  it('drops everything after a script that is never closed', async () => {
    const env = envWith('Mix @egg{1}.');
    await convertToCooklang('<p>Boil.</p><script>var a = 1;', env);
    expect(sentTo(env)).toContain('Boil.');
    expect(sentTo(env)).not.toContain('var a');
  });

  it('leaves plain text alone', async () => {
    const env = envWith('Mix @egg{1}.');
    await convertToCooklang('2 eggs, 100 g flour. Mix.', env);
    expect(sentTo(env)).toContain('2 eggs, 100 g flour. Mix.');
  });
});

describe('when the model cannot convert', () => {
  /** Why converting `content` with `env` failed, in the words import shows. */
  async function failure(env: CloudflareEnv): Promise<string> {
    const error = await convertToCooklang('Boil an egg.', env).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ConversionError);
    return (error as ConversionError).failure;
  }

  it('says not a recipe when it answers with nothing', async () => {
    expect(await failure(envWith('   '))).toBe('not a recipe');
    expect(await failure(envWith('```\n```'))).toBe('not a recipe');
  });

  it('says converter unavailable, in fixed words, when the call fails', async () => {
    const env = {
      AI: {
        run: jest.fn(async () => {
          throw new Error('AiError: 3040: capacity exceeded for account 1234');
        }),
      },
    } as unknown as CloudflareEnv;
    expect(await failure(env)).toBe('converter unavailable');
  });

  it('says converter unavailable when the call throws before it returns anything', async () => {
    const env = {
      AI: {
        run: () => {
          throw new Error('binding gone');
        },
      },
    } as unknown as CloudflareEnv;
    expect(await failure(env)).toBe('converter unavailable');
  });

  it('carries the failure as its message', () => {
    const error = new ConversionError('not a recipe');
    expect(error.message).toBe('not a recipe');
    expect(error.name).toBe('ConversionError');
  });
});

describe('hostile pages', () => {
  const hostile = '<meta content="a" '.repeat(2000) + '<script '.repeat(25_000);

  it('are read in well under a second by every path that reads a page', async () => {
    global.fetch = (async () =>
      new Response(hostile)) as unknown as typeof fetch;
    const started = performance.now();
    await convertImport(
      'article text',
      envWith('>> title: M\n\nMix @egg{1}.\n'),
      {
        sourceUrl: 'https://a.com/x',
      },
    );
    await addMissingCover('>> title: X\n>> source: https://a.com/x\n\nBoil.');
    await convertToCooklang(hostile, envWith('>> title: M\n\nMix @egg{1}.\n'));
    expect(performance.now() - started).toBeLessThan(300);
  });
});

describe('addMissingCover', () => {
  it('leaves a recipe that already has images alone', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const src =
      '>> title: T\n>> source: https://a.com/x\n>> images: https://a.com/i.jpg\n';
    expect(await addMissingCover(src)).toBe(src);
    expect(spy).not.toHaveBeenCalled();
  });

  it('leaves a recipe with no source alone', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const src = '>> title: T\n\nCook.\n';
    expect(await addMissingCover(src)).toBe(src);
    expect(spy).not.toHaveBeenCalled();
  });

  it('adds the page og:image as the cover', async () => {
    global.fetch = (async () =>
      new Response(
        '<meta property="og:image" content="https://a.com/og.jpg">',
      )) as unknown as typeof fetch;
    const out = await addMissingCover(
      '>> title: T\n>> source: https://a.com/x\n\nCook.\n',
    );
    expect(out).toContain('>> images: https://a.com/og.jpg');
  });

  it('prefers the Recipe JSON-LD image over og:image', async () => {
    global.fetch = (async () =>
      new Response(
        `${jsonLdPage}<meta property="og:image" content="https://a.com/og.jpg">`,
      )) as unknown as typeof fetch;
    const out = await addMissingCover(
      '>> title: T\n>> source: https://a.com/x\n\nCook.\n',
    );
    expect(out).toContain('>> images: https://a.com/hero.jpg');
  });

  it('returns the source unchanged when the page cannot be fetched', async () => {
    global.fetch = (async () =>
      new Response('blocked', { status: 403 })) as unknown as typeof fetch;
    const src = '>> title: T\n>> source: https://a.com/x\n\nCook.\n';
    expect(await addMissingCover(src)).toBe(src);
  });
});

describe('hasRecipeBody', () => {
  it('is true for a recipe with ingredients and steps', () => {
    expect(hasRecipeBody('>> title: T\n\nMix @egg{1} in a #bowl{}.\n')).toBe(
      true,
    );
  });

  it('is true for plain method text with no marked ingredients', () => {
    expect(
      hasRecipeBody('>> title: T\n\nBoil the water.\n\nThen serve it hot.\n'),
    ).toBe(true);
  });

  it('is false for a lone placeholder line', () => {
    expect(
      hasRecipeBody('>> title: T\n\nRecipe content is unavailable.\n'),
    ).toBe(false);
  });

  it('is false for just a title and source', () => {
    expect(
      hasRecipeBody('>> title: Unknown\n>> source: https://a.com/v\n'),
    ).toBe(false);
  });

  it('is false for empty content', () => {
    expect(hasRecipeBody('')).toBe(false);
  });
});
