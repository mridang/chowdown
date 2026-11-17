import { describe, expect, it, jest } from '@jest/globals';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

import { VIEW_COOKIE } from '@/components/recipes/list-view';
import { htmlAt } from '../../../components/render';

const INPUT_VALUE_LIST = /<input[^>]*value="list"[^>]*>/u;

const collection = {
  recipes: [] as readonly unknown[],
  favouriteIds: [] as readonly string[],
  drive: { connected: false, reconnect: true, unreachable: false },
};

interface SavedCookies {
  view?: string;
}

const saved: SavedCookies = {};

// eslint-disable-next-line tslop/no-module-mocking -- @/domain/recipe/load-collection is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/domain/recipe/load-collection', () => ({
  loadCollection: async () => collection,
}));
// eslint-disable-next-line tslop/no-module-mocking -- next/headers is a framework module the code under test imports directly, and it only works inside a Next request
jest.unstable_mockModule('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === VIEW_COOKIE && saved.view !== undefined
        ? { name, value: saved.view }
        : undefined,
  }),
}));

const { default: AppPage } = await import('@/app/(site)/app/page');

/** The listing as it renders for the given query string. */
async function listing(): Promise<string> {
  return htmlAt(
    <NuqsTestingAdapter>
      {await AppPage({ searchParams: Promise.resolve({}) })}
    </NuqsTestingAdapter>,
    { pathname: '/app' },
  );
}

describe('AppPage', () => {
  it.each([
    ['without Drive', false],
    ['with Drive', true],
  ])('leaves adding a recipe to the header, %s', async (_name, connected) => {
    collection.drive = { connected, reconnect: false, unreachable: false };
    const out = await listing();
    const header = out.slice(0, out.indexOf('</form>'));
    expect(header).toContain('>Recipes</h1>');
    expect(header).not.toContain('Add recipe');
    expect(header).not.toContain('href="/recipes/add"');
  });

  describe('with recipes', () => {
    collection.recipes = [
      { drive_file_id: 'dal', name: 'Dal.cook', source: '>> title: Dal\n' },
    ];

    const GRID = 'sm:grid-cols-2';
    const ROWS = 'flex flex-col gap-3';

    it.each([
      ['no layout saved', undefined, GRID, ROWS],
      ['the grid saved', 'grid', GRID, ROWS],
      ['the list saved', 'list', ROWS, GRID],
      ['a value that is neither saved', 'carousel', GRID, ROWS],
    ])('draws %s in the right layout', async (_name, value, shown, hidden) => {
      collection.drive = {
        connected: true,
        reconnect: false,
        unreachable: false,
      };
      saved.view = value;
      const out = await listing();
      expect(out).toContain('href="/recipe/dal"');
      expect(out).toContain(shown);
      expect(out).not.toContain(hidden);
    });

    it('offers the toggle with the drawn layout chosen', async () => {
      saved.view = 'list';
      const out = await listing();
      const radio = INPUT_VALUE_LIST.exec(out)?.[0] ?? '';
      expect(radio).toContain('checked=""');
    });
  });
});
