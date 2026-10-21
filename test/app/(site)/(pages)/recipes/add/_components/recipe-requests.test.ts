import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  createdRecipeId,
  discardImport,
  postImport,
  postRecipe,
  readImport,
} from '../../../../../../../src/app/(site)/(pages)/recipes/add/_components/recipe-requests';

afterEach(() => {
  jest.restoreAllMocks();
});

/** Replaces `fetch` with one that records its calls and answers `{}`. */
function stubFetch() {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() => Promise.resolve(Response.json({})));
}

describe('postRecipe', () => {
  it('posts the trimmed name and the Cooklang as JSON to the recipes route', async () => {
    const fetchSpy = stubFetch();
    await postRecipe('  Pancakes ', '>> servings: 2');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('/api/recipes');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Pancakes',
      cooklang: '>> servings: 2',
    });
  });
});

describe('postImport', () => {
  it('posts the pasted text as JSON to the imports route', async () => {
    const fetchSpy = stubFetch();
    await postImport('https://example.com/pasta');
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('/api/recipes/imports');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      input: 'https://example.com/pasta',
    });
  });
});

describe('postImport and cancelling', () => {
  it('hands the abort signal to the request, so a slow import can be given up on', async () => {
    const fetchSpy = stubFetch();
    const controller = new AbortController();
    await postImport('text', controller.signal);
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

describe('discardImport', () => {
  it('asks the server to delete the import', () => {
    const fetchSpy = stubFetch();
    discardImport('abc');
    expect(fetchSpy).toHaveBeenCalledWith('/api/recipes/imports/abc', {
      method: 'DELETE',
    });
  });

  it('shrugs off a failure, since nothing waits on it', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.reject(new Error('offline')));
    expect(() => discardImport('abc')).not.toThrow();
    await Promise.resolve();
  });
});

describe('createdRecipeId', () => {
  it('is the id the server answered with', () => {
    expect(createdRecipeId({ id: 'r1', name: 'x' })).toBe('r1');
  });

  it('is nothing for an answer without one', () => {
    expect(createdRecipeId({})).toBeUndefined();
    expect(createdRecipeId({ id: 5 })).toBeUndefined();
    expect(createdRecipeId(null)).toBeUndefined();
    expect(createdRecipeId('r1')).toBeUndefined();
  });
});

describe('readImport', () => {
  it('turns each item into a draft to review', () => {
    expect(
      readImport({
        id: 'imp1',
        items: [
          {
            title: 'Pasta',
            cooklang: '@pasta{}',
            source_url: 'https://example.com/pasta',
          },
          { title: 'Mystery', problem: 'Could not read that page.' },
        ],
      }),
    ).toEqual({
      id: 'imp1',
      drafts: [
        {
          title: 'Pasta',
          cook: '@pasta{}',
          source: 'https://example.com/pasta',
          error: undefined,
        },
        {
          title: 'Mystery',
          cook: '',
          source: undefined,
          error: 'Could not read that page.',
        },
      ],
    });
  });

  it('leaves out items that are not objects', () => {
    expect(
      readImport({ id: 'i', items: [null, 'x', { title: 'Ok' }] }),
    ).toEqual({
      id: 'i',
      drafts: [{ title: 'Ok', cook: '', source: undefined, error: undefined }],
    });
  });

  it('is nothing for an answer that is not an import', () => {
    expect(readImport(undefined)).toBeUndefined();
    expect(readImport({ items: [] })).toBeUndefined();
    expect(readImport({ id: 'i' })).toBeUndefined();
    expect(readImport({ id: 'i', items: 'nope' })).toBeUndefined();
  });
});
