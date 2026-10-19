import { describe, expect, it } from '@jest/globals';

import type {
  RecipeCardData,
  RecipeListData,
} from '../../src/lib/mcp/ui-types';
import { INITIAL_LIST_STATE, type ListState } from '../../src/views/list-state';
import {
  RecipeListApp,
  RecipeListScreen,
} from '../../src/views/recipe-list-view';
import type { ViewState } from '../../src/views/view-state';
import { html } from '../components/render';

const LIST: RecipeListData = {
  recipes: [
    { id: '1', title: 'Pasta', uncurated: false },
    { id: '2', title: 'Something spicy', uncurated: true },
  ],
};

const RECIPE: RecipeCardData = {
  id: '1',
  title: 'Pasta',
  uncurated: false,
  metadata: [],
  ingredients: [],
  cookware: [],
  steps: [],
  logs: [],
};

const noop = () => undefined;

/** Render the screen for a state and list state. */
function screen(
  state: ViewState<RecipeListData>,
  list: ListState = INITIAL_LIST_STATE,
  layout: Readonly<{ expanded?: boolean; closeHint?: boolean }> = {},
): string {
  return html(
    <RecipeListScreen
      state={state}
      list={list}
      onOpen={noop}
      onCloseDetail={noop}
      expanded={layout.expanded ?? false}
      onExpand={noop}
      onCollapse={noop}
      onFilter={noop}
      closeHint={layout.closeHint ?? false}
      onOpenLink={undefined}
    />,
  );
}

/** A list of `n` recipes with distinct names. */
function recipes(n: number): RecipeListData {
  return {
    recipes: Array.from({ length: n }, (_, i) => ({
      id: `id${i + 1}`,
      title: `Recipe ${i + 1}`,
      uncurated: false,
    })),
  };
}

describe('RecipeListScreen', () => {
  it('shows a skeleton while waiting', () => {
    expect(screen({ phase: 'waiting' })).toContain('Loading recipes…');
  });

  it('shows the message of a failed call', () => {
    expect(
      screen({ phase: 'failed', reason: 'timeout', message: 'Taking long.' }),
    ).toContain('Taking long.');
  });

  it('lists the recipes as buttons in a list, marking ideas', () => {
    const out = screen({ phase: 'ready', data: LIST });
    expect(out).toContain('Your recipes');
    expect(out).toContain('2 recipes');
    expect(out.match(/<button/g)).toHaveLength(2);
    expect(out).toContain('<ul class="grid"');
    expect(out).toContain('idea');
  });

  it('says what was searched for, and when nothing matched', () => {
    const out = screen({
      phase: 'ready',
      data: { recipes: [], query: 'soup' },
    });
    expect(out).toContain('Recipes matching “soup”');
    expect(out).toContain('No recipes matched.');
    expect(screen({ phase: 'ready', data: { recipes: [] } })).toContain(
      'No recipes yet.',
    );
  });

  it('marks the tile that is waiting for an answer', () => {
    const out = screen(
      { phase: 'ready', data: LIST },
      { ...INITIAL_LIST_STATE, pendingId: '1' },
    );
    expect(out.match(/<button[^>]*aria-busy="true"/g)).toHaveLength(1);
  });

  it('shows what happened to the last tap', () => {
    const out = screen(
      { phase: 'ready', data: LIST },
      { ...INITIAL_LIST_STATE, notice: 'Asked the assistant to open “Pasta”.' },
    );
    expect(out).toContain('Asked the assistant to open “Pasta”.');
  });

  it('shows a recipe fetched in place, with a way back to the list', () => {
    const out = screen(
      { phase: 'ready', data: LIST },
      { ...INITIAL_LIST_STATE, detail: { status: 'ready', recipe: RECIPE } },
    );
    expect(out).toContain('Back');
    expect(out).not.toContain('Your recipes');
  });

  it('shows the loading and failure of an in-place fetch', () => {
    const loading = screen(
      { phase: 'ready', data: LIST },
      { ...INITIAL_LIST_STATE, detail: { status: 'loading', title: 'Pasta' } },
    );
    expect(loading).toContain('Loading recipe: Pasta…');
    const failed = screen(
      { phase: 'ready', data: LIST },
      {
        ...INITIAL_LIST_STATE,
        detail: {
          status: 'failed',
          title: 'Pasta',
          message: 'No recipe found.',
        },
      },
    );
    expect(failed).toContain('No recipe found.');
    expect(failed).toContain('Back');
  });
});

describe('RecipeListScreen at scale', () => {
  it('draws eight tiles inline and offers every recipe behind a button', () => {
    const out = screen({ phase: 'ready', data: recipes(12) });
    expect(out.match(/class="tile"/g)).toHaveLength(8);
    expect(out).toContain('Show all 12 recipes');
    expect(out).not.toContain('Recipe 9<');
    expect(out).not.toContain('Back');
  });

  it('offers nothing to expand when the list fits', () => {
    const out = screen({ phase: 'ready', data: recipes(8) });
    expect(out.match(/class="tile"/g)).toHaveLength(8);
    expect(out).not.toContain('Show all');
  });

  it('draws every recipe when expanded, with a way back and a filter box', () => {
    const out = screen(
      { phase: 'ready', data: recipes(12) },
      INITIAL_LIST_STATE,
      { expanded: true },
    );
    expect(out.match(/class="tile"/g)).toHaveLength(12);
    expect(out).toContain('Back');
    expect(out).toContain('type="search"');
    expect(out).toContain('aria-label="Filter recipes by name"');
    expect(out).not.toContain('Show all');
  });

  it('filters the expanded list and counts what matched', () => {
    const out = screen(
      { phase: 'ready', data: recipes(12) },
      { ...INITIAL_LIST_STATE, filter: 'recipe 1' },
      { expanded: true },
    );
    expect(out.match(/class="tile"/g)).toHaveLength(4);
    expect(out).toContain('4 recipes of 12');
  });

  it('says when the filter matches nothing', () => {
    const out = screen(
      { phase: 'ready', data: recipes(3) },
      { ...INITIAL_LIST_STATE, filter: 'zzz' },
      { expanded: true },
    );
    expect(out).toContain('No recipes matched.');
  });

  it('shows the whole title on the tile, so a cut-off name can still be read', () => {
    const title = `${'Very long '.repeat(10)}name`;
    const out = screen({
      phase: 'ready',
      data: { recipes: [{ id: 'a', title, uncurated: false }] },
    });
    expect(out).toContain(`title="${title}"`);
  });

  it('escapes a hostile title instead of interpreting it', () => {
    const out = screen({
      phase: 'ready',
      data: {
        recipes: [
          { id: 'a', title: '<img src=x onerror=alert(1)>', uncurated: false },
        ],
      },
    });
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('points at the host’s close control when it would not leave fullscreen', () => {
    const out = screen(
      { phase: 'ready', data: recipes(12) },
      INITIAL_LIST_STATE,
      { expanded: true, closeHint: true },
    );
    expect(out).toContain('Use the close button in the header');
  });

  it('announces how many recipes arrived', () => {
    expect(screen({ phase: 'ready', data: recipes(12) })).toContain(
      '12 recipes loaded',
    );
  });

  it('takes keyboard focus back to the heading after a recipe was closed', () => {
    const out = screen(
      { phase: 'ready', data: recipes(3) },
      { ...INITIAL_LIST_STATE, refocus: true },
    );
    expect(out).toContain('<h1 tabindex="-1">');
  });
});

describe('RecipeListApp', () => {
  it('starts on the loading skeleton before any host has answered', () => {
    expect(html(<RecipeListApp />)).toContain('Loading recipes…');
  });
});
