import { describe, expect, it, jest } from '@jest/globals';

import {
  importRecipe,
  type ExistingRecipe,
  type ImportDeps,
} from '../../../src/lib/recipe/import-recipe';

const GOOD =
  '>> title: Pasta\n>> source: https://a.com/pasta\n\nBoil @pasta{200%g}.\n';
const HOLLOW = '>> title: Pasta\n>> source: https://a.com/pasta\n';

/** Fake dependencies; `overrides` swap individual behaviours. */
function deps(overrides: Partial<ImportDeps> = {}): ImportDeps & {
  calls: Record<string, jest.Mock>;
} {
  const calls = {
    findExisting: jest.fn(
      async (): Promise<ExistingRecipe | undefined> => undefined,
    ),
    convert: jest.fn(async () => GOOD),
    tag: jest.fn(async (s: string) => s),
    create: jest.fn(async (name: string) => ({ id: 'new-id', name })),
    update: jest.fn(async () => undefined),
    index: jest.fn(async () => undefined),
  };
  return { ...calls, ...(overrides as object), calls } as never;
}

describe('importRecipe', () => {
  it('creates, tags and indexes a new recipe', async () => {
    const d = deps();
    const out = await importRecipe(d, {
      content: 'text',
      url: 'https://a.com/pasta',
    });
    expect(out).toMatchObject({ kind: 'created', id: 'new-id', name: 'Pasta' });
    expect(d.calls['create']).toHaveBeenCalledWith('Pasta', GOOD);
    expect(d.calls['index']).toHaveBeenCalledWith('new-id', 'Pasta', GOOD);
  });

  it('uses the supplied name over the parsed title', async () => {
    const d = deps();
    await importRecipe(d, { content: 'text', name: 'My Pasta' });
    expect(d.calls['create']).toHaveBeenCalledWith('My Pasta', GOOD);
  });

  it('returns the existing recipe for an already-imported link without converting', async () => {
    const d = deps({
      findExisting: async () => ({ id: 'old', name: 'Pasta', source: GOOD }),
    });
    const out = await importRecipe(d, {
      content: 'text',
      url: 'https://a.com/pasta',
    });
    expect(out).toMatchObject({ kind: 'existing', id: 'old' });
    expect(d.calls['convert']).not.toHaveBeenCalled();
    expect(d.calls['create']).not.toHaveBeenCalled();
  });

  it('repairs a hollow earlier import in place instead of duplicating it', async () => {
    const d = deps({
      findExisting: async () => ({ id: 'old', name: 'Pasta', source: HOLLOW }),
    });
    const out = await importRecipe(d, {
      content: 'text',
      url: 'https://a.com/pasta',
    });
    expect(out).toMatchObject({ kind: 'repaired', id: 'old', name: 'Pasta' });
    expect(d.calls['update']).toHaveBeenCalledWith('old', GOOD);
    expect(d.calls['index']).toHaveBeenCalledWith('old', 'Pasta', GOOD);
    expect(d.calls['create']).not.toHaveBeenCalled();
  });

  it('refuses content that has no recipe and saves nothing', async () => {
    const d = deps({ convert: async () => '>> title: Unknown\n' });
    const out = await importRecipe(d, { content: 'watch on youtube' });
    expect(out).toEqual({ kind: 'refused' });
    expect(d.calls['create']).not.toHaveBeenCalled();
    expect(d.calls['update']).not.toHaveBeenCalled();
  });

  it('leaves a hollow existing recipe alone when the new content is also empty', async () => {
    const d = deps({
      findExisting: async () => ({ id: 'old', name: 'Pasta', source: HOLLOW }),
      convert: async () => '>> title: Unknown\n',
    });
    const out = await importRecipe(d, {
      content: 'nothing',
      url: 'https://a.com/pasta',
    });
    expect(out).toEqual({ kind: 'refused' });
    expect(d.calls['update']).not.toHaveBeenCalled();
  });

  it('does not look for an existing copy when no url is given', async () => {
    const d = deps();
    await importRecipe(d, { content: 'text' });
    expect(d.calls['findExisting']).not.toHaveBeenCalled();
  });
});
