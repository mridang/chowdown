import { describe, expect, it } from '@jest/globals';

import type { RecipeCardData } from '../../src/lib/mcp/ui-types';
import {
  INITIAL_LIST_STATE,
  INLINE_TILE_LIMIT,
  reduceListState,
  shortTitle,
  visibleRecipes,
  type ListAction,
  type ListState,
} from '../../src/views/list-state';

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

/** Apply actions in order from the initial state. */
function run(...actions: readonly ListAction[]): ListState {
  return actions.reduce(reduceListState, INITIAL_LIST_STATE);
}

describe('reduceListState', () => {
  it('marks the tapped tile as busy', () => {
    expect(run({ type: 'tapped', id: '1' }).pendingId).toBe('1');
  });

  it('tells the person when the assistant was asked', () => {
    const state = run(
      { type: 'tapped', id: '1' },
      { type: 'asked-assistant', title: 'Pasta' },
    );
    expect(state.pendingId).toBeUndefined();
    expect(state.notice).toBe('Asked the assistant to open “Pasta”.');
  });

  it('shows the recipe it fetched itself, then goes back to the list', () => {
    const shown = run(
      { type: 'tapped', id: '1' },
      { type: 'fetching', title: 'Pasta' },
      {
        type: 'fetched',
        title: 'Pasta',
        outcome: { kind: 'data', data: RECIPE },
      },
    );
    expect(shown.detail).toEqual({ status: 'ready', recipe: RECIPE });
    expect(shown.pendingId).toBeUndefined();
    expect(reduceListState(shown, { type: 'closed-detail' }).detail).toEqual({
      status: 'closed',
    });
  });

  it('keeps the server’s message when the fetch fails', () => {
    const failed = run(
      { type: 'fetching', title: 'Soup' },
      {
        type: 'fetched',
        title: 'Soup',
        outcome: { kind: 'message', text: 'No recipe found.', isError: true },
      },
    );
    expect(failed.detail).toEqual({
      status: 'failed',
      title: 'Soup',
      message: 'No recipe found.',
    });
  });

  it('admits when neither route is available', () => {
    const state = run(
      { type: 'tapped', id: '1' },
      { type: 'unavailable', title: 'Pasta' },
    );
    expect(state.notice).toContain('Ask the assistant to open “Pasta”');
    expect(state.pendingId).toBeUndefined();
  });

  it('clears the old notice on the next tap', () => {
    const state = run(
      { type: 'unavailable', title: 'Pasta' },
      { type: 'tapped', id: '2' },
    );
    expect(state.notice).toBeUndefined();
  });
});

describe('shortTitle', () => {
  it('flattens whitespace and drops control and direction-changing characters', () => {
    expect(shortTitle('  Pasta\n\talla   Norma ')).toBe('Pasta alla Norma');
    expect(shortTitle('abc\u202Edef\u0007g')).toBe('abc def g');
  });

  it('cuts a long title with an ellipsis', () => {
    const cut = shortTitle('x'.repeat(300));
    expect(cut).toHaveLength(80);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('reaches every sentence the View writes with a title in it', () => {
    const long = 'y'.repeat(300);
    const asked = run({ type: 'asked-assistant', title: long });
    expect(asked.notice).toContain(shortTitle(long));
    expect(asked.notice).not.toContain(long);
    expect(run({ type: 'unavailable', title: long }).notice).not.toContain(
      long,
    );
    expect(run({ type: 'fetching', title: long }).detail).toEqual({
      status: 'loading',
      title: shortTitle(long),
    });
  });
});

describe('visibleRecipes', () => {
  const recipes = Array.from({ length: 12 }, (_, i) => ({
    id: `id${i}`,
    title: i === 3 ? 'Crème brûlée' : `Recipe ${i}`,
    uncurated: false,
  }));

  it('shows only the first few inline, and says how many are hidden', () => {
    const view = visibleRecipes(recipes, { expanded: false, filter: '' });
    expect(view.shown).toHaveLength(INLINE_TILE_LIMIT);
    expect(view.matching).toBe(12);
    expect(view.hidden).toBe(12 - INLINE_TILE_LIMIT);
  });

  it('shows a short list in full with nothing hidden', () => {
    const view = visibleRecipes(recipes.slice(0, 5), {
      expanded: false,
      filter: '',
    });
    expect(view.shown).toHaveLength(5);
    expect(view.hidden).toBe(0);
  });

  it('shows everything when expanded, and filters ignoring case and accents', () => {
    expect(
      visibleRecipes(recipes, { expanded: true, filter: '' }).shown,
    ).toHaveLength(12);
    const view = visibleRecipes(recipes, { expanded: true, filter: ' CREME ' });
    expect(view.shown.map((recipe) => recipe.id)).toEqual(['id3']);
    expect(view.matching).toBe(1);
    expect(view.hidden).toBe(0);
  });

  it('ignores the filter inline, where there is no box to clear it', () => {
    expect(
      visibleRecipes(recipes, { expanded: false, filter: 'creme' }).shown,
    ).toHaveLength(INLINE_TILE_LIMIT);
  });
});

describe('filter and focus', () => {
  it('remembers what was typed', () => {
    expect(run({ type: 'filter-changed', value: 'soup' }).filter).toBe('soup');
  });

  it('asks for focus after coming back from a recipe, until the next tap', () => {
    const back = run({ type: 'closed-detail' });
    expect(back.refocus).toBe(true);
    expect(reduceListState(back, { type: 'tapped', id: '1' }).refocus).toBe(
      false,
    );
  });
});
