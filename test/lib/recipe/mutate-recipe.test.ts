import { describe, expect, it, jest } from '@jest/globals';

import { entityTag } from '@/lib/api/etag';
import { mutateRecipe, type MutateDeps } from '@/lib/recipe/mutate-recipe';

const CURRENT = '>> title: A\n\nCook.\n';

function deps(overrides: Partial<MutateDeps> = {}) {
  const calls = {
    owns: jest.fn<MutateDeps['owns']>(async () => true),
    read: jest.fn<MutateDeps['read']>(async () => CURRENT),
    write: jest.fn<MutateDeps['write']>(async () => undefined),
  };
  return { ...calls, ...overrides, calls } as MutateDeps & {
    calls: typeof calls;
  };
}

const append = (current: string) => ({
  ok: true as const,
  source: `${current}-- more\n`,
  value: 'v',
});

describe('mutateRecipe', () => {
  it('reads the current file, applies the edit, writes it and returns the new tag', async () => {
    const d = deps();
    const out = await mutateRecipe(d, 'id', null, append);
    expect(out).toMatchObject({ kind: 'done', value: 'v' });
    expect(d.calls.write).toHaveBeenCalledWith('id', `${CURRENT}-- more\n`);
    expect(out.kind === 'done' && out.etag).toBe(
      await entityTag(`${CURRENT}-- more\n`),
    );
  });

  it('reports a recipe the user does not have, without reading Drive', async () => {
    const d = deps({ owns: async () => false });
    expect(await mutateRecipe(d, 'id', null, append)).toEqual({
      kind: 'not-found',
    });
    expect(d.calls.read).not.toHaveBeenCalled();
  });

  it('reports a file that is gone from Drive', async () => {
    const d = deps({ read: async () => undefined });
    expect(await mutateRecipe(d, 'id', null, append)).toEqual({
      kind: 'not-found',
    });
  });

  it('refuses a stale If-Match and writes nothing', async () => {
    const d = deps();
    expect(await mutateRecipe(d, 'id', '"stale"', append)).toEqual({
      kind: 'precondition-failed',
    });
    expect(d.calls.write).not.toHaveBeenCalled();
  });

  it('accepts a current If-Match', async () => {
    const d = deps();
    const out = await mutateRecipe(d, 'id', await entityTag(CURRENT), append);
    expect(out.kind).toBe('done');
  });

  it('passes on an invalid edit without writing', async () => {
    const d = deps();
    const out = await mutateRecipe(d, 'id', null, () => ({
      ok: false,
      errors: ['bad'],
    }));
    expect(out).toEqual({ kind: 'invalid', errors: ['bad'] });
    expect(d.calls.write).not.toHaveBeenCalled();
  });

  it('treats a missing target as not found', async () => {
    const out = await mutateRecipe(deps(), 'id', null, () => ({
      ok: false,
      missing: true,
    }));
    expect(out).toEqual({ kind: 'not-found' });
  });

  it('writes nothing when the edit changes nothing', async () => {
    const d = deps();
    const out = await mutateRecipe(d, 'id', null, (current) => ({
      ok: true,
      source: current,
      value: 1,
    }));
    expect(out.kind).toBe('done');
    expect(d.calls.write).not.toHaveBeenCalled();
  });

  it('lets a Drive failure propagate so the caller can answer 502', async () => {
    const d = deps({
      write: async () => {
        throw new Error('Drive 500');
      },
    });
    await expect(mutateRecipe(d, 'id', null, append)).rejects.toThrow(
      'Drive 500',
    );
  });
});
