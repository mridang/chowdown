import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { planImport } from '../../../src/lib/recipe/import-blob';
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

/** Prepare what `text` plans to. */
const prepare = (text: string, env: CloudflareEnv) =>
  prepareImport(planImport(text), env);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('prepareImport', () => {
  it('returns nothing for no units, without calling the model', async () => {
    const { env, run } = envAnswering('');
    expect(await prepareImport([], env)).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('drafts a linked page from its structured data and remembers the link', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(PAGE, { status: 200 }));
    // The tagging pass calls the model; answer it with nothing usable.
    const { env } = envAnswering('{}');
    const items = await prepare('see https://a.com/pasta', env);
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
    const items = await prepare(
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
    const items = await prepare('https://blocked.example.com/r', env);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: 'FAILED',
      title: 'https://blocked.example.com/r',
      source_url: 'https://blocked.example.com/r',
    });
    expect(items[0]?.problem).toBe(
      "Couldn't import https://blocked.example.com/r: fetch failed (403). Paste the recipe text directly instead.",
    );
  });

  it('lets one bad unit fail without stopping the others, in order', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('no', { status: 500 }))
      .mockResolvedValueOnce(new Response(PAGE, { status: 200 }));
    const { env } = envAnswering('{}');
    const items = await prepare(
      'https://bad.example.com/a https://good.example.com/b',
      env,
    );
    expect(items.map((i) => i.status)).toEqual(['FAILED', 'DRAFT']);
  });

  it('prepares no more than ten units, whatever it is given', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(PAGE));
    const { env } = envAnswering('{}');
    const text = Array.from(
      { length: 25 },
      (_, i) => `https://a.example.com/${i}`,
    ).join(' ');
    const items = await prepare(text, env);
    expect(items).toHaveLength(10);
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  describe('why an item failed, in a fixed vocabulary', () => {
    /** The problem sentence of the only item an import of `text` made. */
    async function problemOf(text: string, env: CloudflareEnv) {
      const [item] = await prepare(text, env);
      expect(item?.status).toBe('FAILED');
      return item?.problem;
    }

    it('says not a recipe when the model gives nothing back', async () => {
      const { env } = envAnswering('');
      expect(
        await problemOf(
          'A long paragraph of cooking prose that the model cannot make sense of.',
          env,
        ),
      ).toBe(
        "Couldn't import pasted text: not a recipe. Paste the recipe text directly instead.",
      );
    });

    it('names a failed pasted recipe plainly', async () => {
      const { env } = envAnswering('');
      const items = await prepare(
        'A long paragraph of cooking prose that the model cannot make sense of.',
        env,
      );
      expect(items[0]).toMatchObject({
        status: 'FAILED',
        title: 'Pasted recipe',
      });
    });

    it('says converter unavailable, never what the model service said', async () => {
      const env = {
        AI: {
          run: jest.fn(async () => {
            throw new Error(
              'AiError: 3040: Capacity temporarily exceeded for acct 1234',
            );
          }),
        },
      } as unknown as CloudflareEnv;
      const problem = await problemOf(
        'Simmer two leeks for twenty minutes until soft and sweet.',
        env,
      );
      expect(problem).toContain('converter unavailable');
      expect(problem).not.toMatch(/AiError|1234/);
    });

    it('says unreachable when the request itself fails', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new TypeError('fetch failed'));
      const { env } = envAnswering(MODEL_COOKLANG);
      expect(await problemOf('https://down.example.com/r', env)).toContain(
        ': unreachable.',
      );
    });

    it('says blocked for an address it will not fetch, with no request', async () => {
      const fetch = jest.spyOn(globalThis, 'fetch');
      const { env } = envAnswering(MODEL_COOKLANG);
      expect(await problemOf('http://127.0.0.1:8080/admin', env)).toContain(
        ': blocked.',
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('says not a web page for a download', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('%PDF', {
          headers: { 'content-type': 'application/pdf' },
        }),
      );
      const { env } = envAnswering(MODEL_COOKLANG);
      expect(await problemOf('https://a.example.com/r.pdf', env)).toContain(
        ': not a web page.',
      );
    });

    it('says unexpected error for anything else, without its words', async () => {
      const env = {
        AI: {
          run: async () => ({
            get response(): string {
              throw new Error('secret internals');
            },
          }),
        },
      } as unknown as CloudflareEnv;
      const problem = await problemOf(
        'Simmer two leeks for twenty minutes until soft and sweet.',
        env,
      );
      expect(problem).toContain(': unexpected error.');
      expect(problem).not.toContain('secret');
    });
  });
});
