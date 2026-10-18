import { describe, expect, it } from '@jest/globals';

import { applyRecipePatch } from '../../../src/lib/recipe/recipe-patch';

const SOURCE =
  '>> title: Pasta\n>> source: https://a.com/p\n>> protein: beef\n\nBoil @pasta{200%g}.\n-- [note] keep\n';

const ok = (patch: Record<string, unknown>) => {
  const result = applyRecipePatch(SOURCE, patch);
  if (!result.ok) {
    throw new Error(result.errors.join('; '));
  }
  return result.source;
};
const errors = (patch: Record<string, unknown>) => {
  const result = applyRecipePatch(SOURCE, patch);
  return result.ok ? [] : result.errors;
};

describe('applyRecipePatch', () => {
  it('changes the title and leaves the method and notes alone', () => {
    const out = ok({ title: '  New   name ' });
    expect(out).toContain('>> title: New name');
    expect(out).toContain('Boil @pasta{200%g}.');
    expect(out).toContain('-- [note] keep');
  });

  it('sets images, cover first, and removes them with null or []', () => {
    expect(
      ok({ images: ['https://a.com/1.jpg', 'https://a.com/2.jpg'] }),
    ).toContain('>> images: https://a.com/1.jpg https://a.com/2.jpg');
    const withImages = ok({ images: ['https://a.com/1.jpg'] });
    expect(applyRecipePatch(withImages, { images: null })).toMatchObject({
      ok: true,
    });
    expect(
      (applyRecipePatch(withImages, { images: [] }) as { source: string })
        .source,
    ).not.toContain('images');
  });

  it('refuses images that are not usable URLs', () => {
    expect(errors({ images: ['javascript:alert(1)'] })[0]).toContain('images');
    expect(errors({ images: 'x' })[0]).toContain('images');
  });

  it('sets tags in the taxonomy spelling, and removes a facet with null', () => {
    expect(ok({ tags: { cuisine: ['indian'] } })).toContain(
      '>> cuisine: Indian',
    );
    expect(ok({ tags: { protein: ['chicken', 'beef'] } })).toContain(
      '>> protein: chicken, beef',
    );
    expect(ok({ tags: { protein: null } })).not.toContain('protein');
  });

  it('refuses unknown facets, unknown values and several values for a single facet', () => {
    expect(errors({ tags: { colour: ['red'] } })[0]).toContain('unknown facet');
    expect(errors({ tags: { cuisine: ['Martian'] } })[0]).toContain(
      'not an allowed value',
    );
    expect(errors({ tags: { difficulty: ['Easy', 'Hard'] } })[0]).toContain(
      'one value',
    );
  });

  it('refuses read-only or unknown properties instead of half-applying the patch', () => {
    const list = errors({ title: 'X', favourite: true, ingredients: [] });
    expect(list.some((e) => e.startsWith('favourite'))).toBe(true);
    expect(list.some((e) => e.startsWith('ingredients'))).toBe(true);
    expect(applyRecipePatch(SOURCE, { title: 'X', favourite: true }).ok).toBe(
      false,
    );
  });

  it('refuses an empty title', () => {
    expect(errors({ title: ' ' })[0]).toContain('title');
  });
});
