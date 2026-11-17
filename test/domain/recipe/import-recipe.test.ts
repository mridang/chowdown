import { describe, expect, it, jest } from '@jest/globals';

import { importRecipe } from '@/domain/recipe/import-recipe';
import type { ImportDeps } from '@/domain/recipe/import-recipe';

const GOOD =
  '>> title: Pasta\n>> source: https://a.com/pasta\n\nBoil @pasta{200%g}.\n';
const HOLLOW = '>> title: Pasta\n>> source: https://a.com/pasta\n';

/** Fake dependencies; `overrides` swap individual behaviours. */
function deps(overrides: Partial<ImportDeps> = {}) {
  const calls = {
    findExisting: jest.fn<ImportDeps['findExisting']>(async () => undefined),
    convert: jest.fn<ImportDeps['convert']>(async () => GOOD),
    tag: jest.fn<ImportDeps['tag']>(async (source) => source),
    create: jest.fn<ImportDeps['create']>(async (name) => ({
      id: 'new-id',
      name,
    })),
    update: jest.fn<ImportDeps['update']>(async () => undefined),
    index: jest.fn<ImportDeps['index']>(async () => undefined),
  };
  const fakes: ImportDeps = { ...calls, ...overrides };
  return { ...fakes, calls };
}

describe('importRecipe', () => {
  it('creates, tags and indexes a new recipe', async () => {
    const d = deps();
    const out = await importRecipe(d, {
      content: 'text',
      url: 'https://a.com/pasta',
    });
    expect(out).toMatchObject({ kind: 'created', id: 'new-id', name: 'Pasta' });
    expect(d.calls.create).toHaveBeenCalledWith('Pasta', GOOD);
    expect(d.calls.index).toHaveBeenCalledWith('new-id', 'Pasta', GOOD);
  });

  it('uses the supplied name over the parsed title', async () => {
    const d = deps();
    await importRecipe(d, { content: 'text', name: 'My Pasta' });
    expect(d.calls.create).toHaveBeenCalledWith('My Pasta', GOOD);
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
    expect(d.calls.convert).not.toHaveBeenCalled();
    expect(d.calls.create).not.toHaveBeenCalled();
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
    expect(d.calls.update).toHaveBeenCalledWith('old', GOOD);
    expect(d.calls.index).toHaveBeenCalledWith('old', 'Pasta', GOOD);
    expect(d.calls.create).not.toHaveBeenCalled();
  });

  it('refuses content that has no recipe and saves nothing', async () => {
    const d = deps({ convert: async () => '>> title: Unknown\n' });
    const out = await importRecipe(d, { content: 'watch on youtube' });
    expect(out).toEqual({ kind: 'refused' });
    expect(d.calls.create).not.toHaveBeenCalled();
    expect(d.calls.update).not.toHaveBeenCalled();
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
    expect(d.calls.update).not.toHaveBeenCalled();
  });

  it('does not look for an existing copy when no url is given', async () => {
    const d = deps();
    const out = await importRecipe(d, { content: 'text' });
    expect(out).toMatchObject({ kind: 'created', id: 'new-id' });
    expect(d.calls.findExisting.mock.calls).toEqual([]);
  });

  it('applies images the caller supplied and drops invalid ones', async () => {
    const d = deps();
    await importRecipe(d, {
      content: 'text',
      // eslint-disable-next-line no-script-url -- the value is a javascript: URL on purpose, to prove it is refused
      images: ['https://a.com/hero.jpg', 'javascript:x'],
    });
    const saved = d.calls.create.mock.calls[0]![1];
    expect(saved).toContain('>> images: https://a.com/hero.jpg');
    expect(saved).not.toContain('javascript');
  });

  it('adds supplied images when repairing a hollow copy', async () => {
    const d = deps({
      findExisting: async () => ({ id: 'old', name: 'Pasta', source: HOLLOW }),
    });
    await importRecipe(d, {
      content: 'text',
      url: 'https://a.com/pasta',
      images: ['https://a.com/hero.jpg'],
    });
    expect(d.calls.update.mock.calls[0]![1]).toContain(
      '>> images: https://a.com/hero.jpg',
    );
  });
});
