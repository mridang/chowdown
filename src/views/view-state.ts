/**
 * @packageDocumentation
 *
 * The life of a View as a small state machine. A View is created before its
 * data exists: first it is connecting to the host, then the host announces the
 * tool call that made it (tool input), and finally the result arrives, or the
 * call fails or is cancelled. Modelling those steps as one value, changed only
 * by the pure {@link reduceViewState}, is what guarantees a View never sits on
 * "Loading…" forever: every way out has a state with a message.
 */

import type { ToolOutcome } from './payload';

/** How long a View waits for data before it says so (milliseconds). */
export const LOADING_TIMEOUT_MS = 20_000;

/** Why a View has nothing to draw. */
export type FailureReason =
  /** The tool reported an error. */
  | 'error'
  /** The call finished without data the View can draw (a plain note). */
  | 'notice'
  /** The host cancelled the tool call. */
  | 'cancelled'
  /** The View could not reach the host. */
  | 'connection'
  /** Nothing arrived within {@link LOADING_TIMEOUT_MS}. */
  | 'timeout';

/** Where a View is in its life. */
export type ViewState<T> =
  | {
      /** The handshake with the host has not finished. */
      readonly phase: 'connecting';
    }
  | {
      /**
       * Connected, waiting for the result. `request` describes what was asked
       * for, when the host has said (for example the recipe name).
       */
      readonly phase: 'waiting';
      readonly request?: string;
    }
  | {
      /** The data arrived and can be drawn. */
      readonly phase: 'ready';
      readonly data: T;
    }
  | {
      /** There is nothing to draw; `message` says why. */
      readonly phase: 'failed';
      readonly reason: FailureReason;
      readonly message: string;
    };

/** Something that happened to a View. */
export type ViewAction<T> =
  | { readonly type: 'connected' }
  | {
      readonly type: 'input';
      /** The arguments the tool was called with (possibly partial). */
      readonly args: Readonly<Record<string, unknown>> | undefined;
    }
  | { readonly type: 'result'; readonly outcome: ToolOutcome<T> }
  | { readonly type: 'cancelled'; readonly reason?: string }
  | { readonly type: 'connection-error'; readonly message: string }
  | { readonly type: 'timeout' };

/** The state a View starts in. */
export const INITIAL_VIEW_STATE: ViewState<never> = { phase: 'connecting' };

/** Whether the View is still waiting for its data (so a timeout applies). */
export function isPending<T>(state: ViewState<T>): boolean {
  return state.phase === 'connecting' || state.phase === 'waiting';
}

/**
 * A short phrase for what the tool was asked to do, taken from its arguments:
 * the recipe `name`, or the search `query`. Undefined when the arguments say
 * nothing useful.
 */
export function describeRequest(
  args: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const label = [args?.['name'], args?.['query']].find(
    (value): value is string =>
      typeof value === 'string' && value.trim() !== '',
  );
  return label?.trim();
}

/** Message for a call the host cancelled. */
function cancelledMessage(reason: string | undefined): string {
  return reason
    ? `This was cancelled (${reason}).`
    : 'This was cancelled before it finished.';
}

/** Message when nothing arrives in time. */
export const TIMEOUT_MESSAGE =
  'This is taking longer than expected. If nothing appears, ask the assistant to try again.';

/**
 * The next state. Late data always wins: a result arriving after a timeout or a
 * failure replaces it, and fresh data replaces older data. Input and timeout events only matter while the View is
 * still waiting, so they never overwrite data that has already arrived.
 */
export function reduceViewState<T>(
  state: ViewState<T>,
  action: ViewAction<T>,
): ViewState<T> {
  switch (action.type) {
    case 'connected':
      return state.phase === 'connecting' ? { phase: 'waiting' } : state;
    case 'input':
      return isPending(state)
        ? { phase: 'waiting', request: describeRequest(action.args) }
        : state;
    case 'result':
      if (action.outcome.kind === 'data') {
        return { phase: 'ready', data: action.outcome.data };
      }
      // A View that already shows its data keeps it when a later result is only
      // a note, or has another shape (the answer to a tool call the View made
      // itself can reach it as a result too); only an error replaces the data.
      if (state.phase === 'ready' && !action.outcome.isError) {
        return state;
      }
      return {
        phase: 'failed',
        reason: action.outcome.isError ? 'error' : 'notice',
        message: action.outcome.text,
      };
    case 'cancelled':
      return isPending(state)
        ? {
            phase: 'failed',
            reason: 'cancelled',
            message: cancelledMessage(action.reason),
          }
        : state;
    case 'connection-error':
      return state.phase === 'ready'
        ? state
        : { phase: 'failed', reason: 'connection', message: action.message };
    case 'timeout':
      return isPending(state)
        ? { phase: 'failed', reason: 'timeout', message: TIMEOUT_MESSAGE }
        : state;
  }
}
