/**
 * @packageDocumentation
 *
 * The one place a chowdown View talks to its host. It connects with the
 * ext-apps `App` (the standard MCP Apps channel every compliant host speaks),
 * turns the host's notifications into the pure state machines in
 * `view-state.ts` and `display-mode.ts`, and hands the View plain values and
 * a few actions. ChatGPT's `window.openai` bridge is used on top of that where
 * it is the better route (see `openai-bridge.ts`).
 *
 * The hook is deliberately thin: every decision (what state a result leads to,
 * whether to ask for fullscreen, which route sends a follow-up) is made by a
 * tested pure function; this file only wires them to the browser.
 */

import {
  useApp,
  useHostStyleVariables,
} from '@modelcontextprotocol/ext-apps/react';
import { useCallback, useEffect, useReducer } from 'react';

import {
  INITIAL_LAYOUT,
  SUPPORTED_DISPLAY_MODES,
  isDisplayMode,
  isExpanded,
  planExpand,
  reduceLayout,
} from '@/views/display-mode';
import {
  applyHostContext,
  attachHostListeners,
  requestMode,
  runServerTool,
  sendFollowUpMessage,
} from '@/views/host-wiring';
import {
  getOpenAi,
  globalsFromEvent,
  type OpenAiGlobals,
} from '@/views/openai-bridge';
import { readOutcome, type ToolOutcome } from '@/views/payload';
import {
  INITIAL_VIEW_STATE,
  LOADING_TIMEOUT_MS,
  isPending,
  reduceViewState,
  type ViewAction,
  type ViewState,
} from '@/views/view-state';

/** What a View gets: the current state of its data, its layout, and host actions. */
export interface WidgetBridge<T> {
  /** Where the View is in its life: connecting, waiting, ready or failed. */
  readonly state: ViewState<T>;
  /** Whether the expanded (fullscreen) layout should be showing. */
  readonly expanded: boolean;
  /** Ask the host for fullscreen; expands in place if the host will not. */
  readonly expand: () => Promise<void>;
  /** Leave the expanded layout, asking the host to leave fullscreen too. */
  readonly collapse: () => Promise<void>;
  /**
   * True when the host would not leave fullscreen on request, so the View
   * should point at the host's own close control.
   */
  readonly closeHint: boolean;
  /**
   * Ask the assistant to do something in the conversation, as if the person had
   * typed it. Resolves true when a route accepted it, false when none did.
   */
  readonly sendFollowUp: (prompt: string) => Promise<boolean>;
  /** Whether the host will run a tool for the View (so {@link WidgetBridge.callTool} works). */
  readonly canCallTools: boolean;
  /** Run one of the server's tools through the host and read its result. */
  readonly callTool: <U>(
    name: string,
    args: Readonly<Record<string, unknown>>,
    guard: (value: unknown) => value is U,
  ) => Promise<ToolOutcome<U>>;
  /** Open a web page through the host; absent when the host cannot. */
  readonly openLink: ((url: string) => void) | undefined;
}

/**
 * Connect the View to its host and return the tool's `structuredContent`
 * (checked by `guard` and typed as `T`) inside a state that always resolves:
 * data, a message from the server, a cancellation, or a timeout.
 *
 * @param appName - Name the View reports to the host in `ui/initialize`.
 * @param guard - Tells whether `structuredContent` has the shape the View draws.
 *   Must be a stable (module-level) function.
 */
export function useWidgetData<T>(
  appName: string,
  guard: (value: unknown) => value is T,
): WidgetBridge<T> {
  const [state, dispatch] = useReducer<ViewState<T>, [ViewAction<T>]>(
    reduceViewState,
    INITIAL_VIEW_STATE,
  );
  const [layout, dispatchLayout] = useReducer(reduceLayout, INITIAL_LAYOUT);

  const { app, error } = useApp({
    appInfo: { name: appName, version: '0.1.0' },
    // The spec requires a View to declare every display mode it can lay out.
    capabilities: { availableDisplayModes: [...SUPPORTED_DISPLAY_MODES] },
    // Handlers go in before the handshake so the first notification is not missed.
    onAppCreated: (created) =>
      attachHostListeners(created, {
        dispatch,
        dispatchLayout,
        root: document.documentElement,
        guard,
      }),
  });

  // Theme and CSS variables follow the host, including later theme changes.
  // The host's font CSS is deliberately not applied: loading fonts would need an
  // origin in the CSP, and the Views declare none.
  useHostStyleVariables(app, app?.getHostContext());

  useEffect(() => {
    if (app === null) {
      return;
    }
    dispatch({ type: 'connected' });
    applyHostContext(
      app.getHostContext(),
      dispatchLayout,
      document.documentElement,
    );
  }, [app]);

  useEffect(() => {
    if (error !== null) {
      dispatch({
        type: 'connection-error',
        message: `Could not connect to the assistant (${error.message}).`,
      });
    }
  }, [error]);

  // Never leave the View on a loading placeholder for good.
  const pending = isPending(state);
  useEffect(() => {
    if (!pending) {
      return;
    }
    const timer = setTimeout(
      () => dispatch({ type: 'timeout' }),
      LOADING_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [pending]);

  // ChatGPT keeps the tool output and display mode on `window.openai` too; read
  // them once and follow its change events, so a card still renders if the
  // standard notifications never arrive.
  useEffect(() => {
    const apply = (globals: OpenAiGlobals | undefined) => {
      if (globals?.toolOutput) {
        dispatch({
          type: 'result',
          outcome: readOutcome(
            { structuredContent: globals.toolOutput },
            guard,
          ),
        });
      }
      if (isDisplayMode(globals?.displayMode)) {
        dispatchLayout({ type: 'host-mode', mode: globals.displayMode });
      }
    };
    apply(getOpenAi());
    const onGlobals = (event: Event) => apply(globalsFromEvent(event));
    window.addEventListener('openai:set_globals', onGlobals);
    return () => window.removeEventListener('openai:set_globals', onGlobals);
  }, [guard]);

  const hostMode = layout.hostMode;

  const expand = useCallback(async () => {
    if (planExpand(app?.getHostContext()) === 'local') {
      dispatchLayout({ type: 'expand-locally' });
      return;
    }
    const mode = await requestMode(app, getOpenAi(), 'fullscreen');
    if (mode === 'fullscreen') {
      dispatchLayout({ type: 'host-mode', mode });
    } else {
      // The host declined (or did not answer): grow in place, with a way back.
      dispatchLayout({ type: 'expand-locally' });
    }
  }, [app]);

  const collapse = useCallback(async () => {
    dispatchLayout({ type: 'collapse-locally' });
    if (hostMode === 'fullscreen') {
      const mode = await requestMode(app, getOpenAi(), 'inline');
      if (mode === undefined) {
        // Still fullscreen and Back cannot change that: say where the way out is.
        dispatchLayout({ type: 'collapse-refused' });
      } else {
        dispatchLayout({ type: 'host-mode', mode });
      }
    }
  }, [app, hostMode]);

  const sendFollowUp = useCallback(
    (prompt: string): Promise<boolean> =>
      sendFollowUpMessage(app, getOpenAi(), prompt),
    [app],
  );

  const callTool = useCallback(
    <U>(
      name: string,
      args: Readonly<Record<string, unknown>>,
      toolGuard: (value: unknown) => value is U,
    ): Promise<ToolOutcome<U>> => runServerTool(app, name, args, toolGuard),
    [app],
  );

  const capabilities = app?.getHostCapabilities();
  const openLink =
    app !== null && capabilities?.openLinks !== undefined
      ? (url: string) => void app.openLink({ url }).catch(() => undefined)
      : undefined;

  return {
    state,
    expanded: isExpanded(layout),
    expand,
    collapse,
    closeHint: layout.collapseRefused,
    sendFollowUp,
    canCallTools: capabilities?.serverTools !== undefined,
    callTool,
    openLink,
  };
}
