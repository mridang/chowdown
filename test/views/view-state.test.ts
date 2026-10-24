import { describe, expect, it } from '@jest/globals';

import type { ToolOutcome } from '@/views/payload';
import {
  INITIAL_VIEW_STATE,
  LOADING_TIMEOUT_MS,
  TIMEOUT_MESSAGE,
  describeRequest,
  isPending,
  reduceViewState,
  type ViewAction,
  type ViewState,
} from '@/views/view-state';

type Data = { readonly n: number };

/** Run a list of actions from the initial state. */
function run(...actions: readonly ViewAction<Data>[]): ViewState<Data> {
  return actions.reduce<ViewState<Data>>(
    (state, action) => reduceViewState(state, action),
    INITIAL_VIEW_STATE,
  );
}

const DATA: ToolOutcome<Data> = { kind: 'data', data: { n: 1 } };
const ERROR: ToolOutcome<Data> = {
  kind: 'message',
  text: 'No recipe found.',
  isError: true,
};

describe('describeRequest', () => {
  it('names the recipe or the search the tool was asked for', () => {
    expect(describeRequest({ name: ' Pasta ' })).toBe('Pasta');
    expect(describeRequest({ query: 'soup' })).toBe('soup');
  });

  it('says nothing when the arguments do not', () => {
    expect(describeRequest(undefined)).toBeUndefined();
    expect(describeRequest({ name: '  ', other: 3 })).toBeUndefined();
  });
});

describe('reduceViewState', () => {
  it('waits for a timeout that is long enough for a slow tool', () => {
    expect(LOADING_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });

  it('moves from connecting to waiting, then to the data', () => {
    expect(run({ type: 'connected' })).toEqual({ phase: 'waiting' });
    expect(
      run({ type: 'connected' }, { type: 'result', outcome: DATA }),
    ).toEqual({ phase: 'ready', data: { n: 1 } });
  });

  it('shows data that arrives before the handshake finishes', () => {
    expect(run({ type: 'result', outcome: DATA })).toMatchObject({
      phase: 'ready',
    });
  });

  it('remembers what was asked for while waiting', () => {
    expect(
      run({ type: 'connected' }, { type: 'input', args: { name: 'Pasta' } }),
    ).toEqual({ phase: 'waiting', request: 'Pasta' });
  });

  it('never lets late input overwrite data', () => {
    const ready = run(
      { type: 'result', outcome: DATA },
      { type: 'input', args: { name: 'x' } },
    );
    expect(ready.phase).toBe('ready');
  });

  it('turns an error result into a failed state with the server’s words', () => {
    expect(run({ type: 'result', outcome: ERROR })).toEqual({
      phase: 'failed',
      reason: 'error',
      message: 'No recipe found.',
    });
  });

  it('treats a plain text result as a notice, not an error', () => {
    expect(
      run({
        type: 'result',
        outcome: { kind: 'message', text: 'Nothing here.', isError: false },
      }),
    ).toMatchObject({ phase: 'failed', reason: 'notice' });
  });

  it('says so when the host cancels the call', () => {
    const state = run({ type: 'cancelled', reason: 'user stopped it' });
    expect(state).toMatchObject({ phase: 'failed', reason: 'cancelled' });
    expect(state.phase === 'failed' && state.message).toContain(
      'user stopped it',
    );
    expect(run({ type: 'cancelled' })).toMatchObject({ reason: 'cancelled' });
  });

  it('times out instead of loading forever', () => {
    expect(run({ type: 'connected' }, { type: 'timeout' })).toEqual({
      phase: 'failed',
      reason: 'timeout',
      message: TIMEOUT_MESSAGE,
    });
  });

  it('keeps the data on screen when a later result is only a note', () => {
    const state = run(
      { type: 'result', outcome: DATA },
      {
        type: 'result',
        outcome: { kind: 'message', text: 'A card.', isError: false },
      },
    );
    expect(state).toEqual({ phase: 'ready', data: { n: 1 } });
  });

  it('replaces the data with fresh data, and with an error', () => {
    const newer: ToolOutcome<Data> = { kind: 'data', data: { n: 2 } };
    expect(
      run(
        { type: 'result', outcome: DATA },
        { type: 'result', outcome: newer },
      ),
    ).toEqual({ phase: 'ready', data: { n: 2 } });
    expect(
      run(
        { type: 'result', outcome: DATA },
        { type: 'result', outcome: ERROR },
      ),
    ).toMatchObject({ phase: 'failed', reason: 'error' });
  });

  it('lets late data replace a timeout or a failure', () => {
    expect(
      run({ type: 'timeout' }, { type: 'result', outcome: DATA }).phase,
    ).toBe('ready');
    expect(
      run({ type: 'result', outcome: ERROR }, { type: 'result', outcome: DATA })
        .phase,
    ).toBe('ready');
  });

  it('ignores a timeout or a cancellation once the data is on screen', () => {
    const ready = run({ type: 'result', outcome: DATA });
    expect(reduceViewState(ready, { type: 'timeout' })).toBe(ready);
    expect(reduceViewState(ready, { type: 'cancelled' })).toBe(ready);
  });

  it('reports a connection error unless there is already data', () => {
    expect(run({ type: 'connection-error', message: 'no host' })).toMatchObject(
      { phase: 'failed', reason: 'connection', message: 'no host' },
    );
    const ready = run({ type: 'result', outcome: DATA });
    expect(
      reduceViewState(ready, { type: 'connection-error', message: 'x' }),
    ).toBe(ready);
  });

  it('only counts connecting and waiting as pending', () => {
    expect(isPending(INITIAL_VIEW_STATE)).toBe(true);
    expect(isPending({ phase: 'waiting' })).toBe(true);
    expect(isPending(run({ type: 'result', outcome: DATA }))).toBe(false);
    expect(isPending(run({ type: 'timeout' }))).toBe(false);
  });
});
