import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { prepareImport } from '../../../src/lib/recipe/prepare-import';

/** A page carrying a schema.org Recipe, so no model call is needed. */
const PAGE = `<html><script type="application/ld+json">${JSON.stringify({
  '@type': 'Recipe',
  name: 'Pasta',
  recipeIngredient: ['200 g pasta'],
  recipeInstructions: ['Boil the pasta.', 'Drain it.'],
})}</script></html>`;

/** An env whose model answers every request with `response`. */
function envAnswering(response: string) {
  const run = jest.fn(async () => ({ response }));
  return { env: { AI: { run } } as unknown as CloudflareEnv, run };
}

const MODEL_COOKLANG = '>> title: Soup\n\nSimmer @leek{2} for ~{20%minutes}.\n';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('prepareImport', () => {
  it('returns nothing for text with no links and no recipe', async () => {
    const { env, run } = envAnswering('');
    expect(await prepareImport('hi', env)).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('drafts a linked page from its structured data and remembers the link', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(PAGE, { status: 200 }));
    // The tagging pass calls the model; answer it with nothing usable.
    const { env } = envAnswering('{}');
    const items = await prepareImport('see https://a.com/pasta', env);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: 'DRAFT',
      title: 'Pasta',
      source_url: 'https://a.com/pasta',
    });
    expect(items[0]?.cooklang).toContain('@pasta{200%g}');
  });

  it('drafts pasted prose through the model, with no source link', async () => {
    const { env } = envAnswering(MODEL_COOKLANG);
    const items = await prepareImport(
      'Simmer two leeks for twenty minutes until soft and sweet.',
      env,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: 'DRAFT', title: 'Soup' });
    expect(items[0]).not.toHaveProperty('source_url');
  });

  it('turns a link that cannot be fetched into a failed item, not an error', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('no', { status: 403 }));
    const { env } = envAnswering(MODEL_COOKLANG);
    const items = await prepareImport('https://blocked.example/r', env);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: 'FAILED',
      title: 'https://blocked.example/r',
      source_url: 'https://blocked.example/r',
    });
    expect(items[0]?.problem).toContain(
      "Couldn't import https://blocked.example/r",
    );
    expect(items[0]?.problem).toContain('fetch failed (403)');
  });

  it('lets one bad unit fail without stopping the others, in order', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('no', { status: 500 }))
      .mockResolvedValueOnce(new Response(PAGE, { status: 200 }));
    const { env } = envAnswering('{}');
    const items = await prepareImport(
      'https://bad.example/a https://good.example/b',
      env,
    );
    expect(items.map((i) => i.status)).toEqual(['FAILED', 'DRAFT']);
  });

  it('names a failed pasted recipe plainly', async () => {
    const { env } = envAnswering('');
    const items = await prepareImport(
      'A long paragraph of cooking prose that the model cannot make sense of.',
      env,
    );
    expect(items[0]).toMatchObject({
      status: 'FAILED',
      title: 'Pasted recipe',
    });
    expect(items[0]?.problem).toContain("Couldn't import pasted text");
  });
});
