import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  addMissingCover,
  convertImport,
  convertToCooklang,
  hasRecipeBody,
} from '../../../src/lib/recipe/to-cooklang';

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
