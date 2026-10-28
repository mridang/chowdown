import { describe, expect, it, jest } from '@jest/globals';

import { html } from '../../../components/render';

const collection = {
  recipes: [] as readonly unknown[],
  favouriteIds: [] as readonly string[],
  drive: { connected: false, reconnect: true, unreachable: false },
};

jest.unstable_mockModule('@/domain/recipe/load-collection', () => ({
  loadCollection: async () => collection,
}));

const { default: AppPage } = await import('@/app/(site)/app/page');

describe('AppPage', () => {
  it.each([
    ['without Drive', false],
    ['with Drive', true],
  ])('leaves adding a recipe to the header, %s', async (_name, connected) => {
    collection.drive = { connected, reconnect: false, unreachable: false };
    const out = html(await AppPage({ searchParams: Promise.resolve({}) }));
    const header = out.slice(0, out.indexOf('</form>'));
    expect(header).toContain('>Recipes</h1>');
    expect(header).not.toContain('Add recipe');
    expect(header).not.toContain('href="/recipes/add"');
  });
});
