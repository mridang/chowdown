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
): string {
  return html(
    <RecipeListScreen
      state={state}
      list={list}
      onOpen={noop}
      onCloseDetail={noop}
      onOpenLink={undefined}
    />,
  );
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

describe('RecipeListApp', () => {
  it('starts on the loading skeleton before any host has answered', () => {
    expect(html(<RecipeListApp />)).toContain('Loading recipes…');
  });
});
