import { describe, expect, it } from '@jest/globals';

import type { RecipeCardData } from '../../src/lib/mcp/ui-types';
import {
  INITIAL_LIST_STATE,
  reduceListState,
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
