/**
 * @packageDocumentation
 *
 * The parts of the host connection that need no React: attaching the listeners
 * that turn the host's notifications into View actions, applying the host
 * context to the page, and the three things a View asks of its host (a display
 * mode, a follow-up message, a tool call). They take the SDK's `App` (and the
 * page's root element) as arguments instead of reaching for globals, so a test
 * can join a real `App` to the SDK's own host side (`AppBridge`) and check what
 * goes over the wire; `use-widget-data.ts` is left as the thin hook that
 * connects them to React state.
 */

import {
  McpUiResourceTeardownRequestSchema,
  McpUiResourceTeardownResultSchema,
  type App,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps/react';

import {
  isDisplayMode,
  modeFromResult,
  type DisplayMode,
  type LayoutAction,
} from '@/views/display-mode';
import { firstThatWorks, followUpChannels } from '@/views/follow-up';
import {
  hasFixedHeight,
  localeToLang,
  safeAreaVariables,
} from '@/views/host-context';
import type { OpenAiApi } from '@/views/openai-bridge';
import { readOutcome, type ToolOutcome } from '@/views/payload';
import type { ViewAction } from '@/views/view-state';

/**
 * The part of the page's root element the host context changes. `document
 * .documentElement` fits; a test passes a small stand-in.
 */
export interface DocumentRoot {
  readonly style: { setProperty(name: string, value: string): void };
  setAttribute(name: string, value: string): void;
  toggleAttribute(name: string, force?: boolean): boolean;
}

/**
 * Apply the parts of the host context that change the page itself: the
 * safe-area insets (as CSS custom properties), whether the host fixes the frame
 * height (as a data attribute the stylesheet reads) and the person's language
 * (as the document's `lang`, which screen readers use to pick a voice).
 */
export function applyDocumentContext(
  context: McpUiHostContext,
  root: DocumentRoot,
): void {
  if (context.safeAreaInsets !== undefined) {
    safeAreaVariables(context.safeAreaInsets).forEach(([name, value]) =>
      root.style.setProperty(name, value),
    );
  }
  if (context.containerDimensions !== undefined) {
    root.toggleAttribute(
      'data-fixed-height',
      hasFixedHeight(context.containerDimensions),
    );
  }
  const lang = localeToLang(context.locale);
  if (lang !== undefined) {
    root.setAttribute('lang', lang);
  }
}

/** Take a (possibly partial) host context into account: its display mode and page-level settings. */
export function applyHostContext(
  context: McpUiHostContext | undefined,
  dispatchLayout: (action: LayoutAction) => void,
  root: DocumentRoot,
): void {
  if (context === undefined) {
    return;
  }
  if (isDisplayMode(context.displayMode)) {
    dispatchLayout({ type: 'host-mode', mode: context.displayMode });
  }
  applyDocumentContext(context, root);
}

/** Where the host's notifications end up. */
export interface HostSinks<T> {
  readonly dispatch: (action: ViewAction<T>) => void;
  readonly dispatchLayout: (action: LayoutAction) => void;
  /** The page's root element, for the host context. */
  readonly root: DocumentRoot;
  /** Tells whether a result's `structuredContent` is the data this View draws. */
  readonly guard: (value: unknown) => value is T;
}

/**
 * Listen for everything the host tells a View, before the handshake so that the
 * first notification (often the tool result itself) is not missed: the tool's
 * input and result, a cancellation, host-context changes, and the request to
 * tear the View down (which has nothing to save, so is just acknowledged).
 */
export function attachHostListeners<T>(app: App, sinks: HostSinks<T>): void {
  const { dispatch, dispatchLayout, root, guard } = sinks;
  const input = (params: { arguments?: Record<string, unknown> }) =>
    dispatch({ type: 'input', args: params.arguments });
  app.addEventListener('toolinput', input);
  app.addEventListener('toolinputpartial', input);
  app.addEventListener('toolresult', (result) =>
    dispatch({ type: 'result', outcome: readOutcome(result, guard) }),
  );
  app.addEventListener('toolcancelled', (params) =>
    dispatch({ type: 'cancelled', reason: params.reason }),
  );
  app.addEventListener('hostcontextchanged', (context) =>
    applyHostContext(context, dispatchLayout, root),
  );
  app.setRequestHandler(
    'ui/resource-teardown',
    {
      params: McpUiResourceTeardownRequestSchema.shape.params,
      result: McpUiResourceTeardownResultSchema,
    },
    () => ({}),
  );
}

/**
 * Ask for a display mode and report the one the host actually set. Tries the
 * standard request first and ChatGPT's bridge second; undefined when neither
 * gave a recognisable answer.
 */
export async function requestMode(
  app: App | null,
  openai: OpenAiApi | undefined,
  mode: DisplayMode,
): Promise<DisplayMode | undefined> {
  const viaApp =
    app === null
      ? undefined
      : await app
          .requestDisplayMode({ mode })
          .then(modeFromResult, () => undefined);
  if (viaApp !== undefined || openai?.requestDisplayMode === undefined) {
    return viaApp;
  }
  return openai
    .requestDisplayMode({ mode })
    .then(modeFromResult, () => undefined);
}

/**
 * Ask the assistant, in the conversation, to do something: ChatGPT's own
 * follow-up first when it is there, then the standard `ui/message`. Resolves
 * true when a route accepted the message, false when none did.
 */
export async function sendFollowUpMessage(
  app: App | null,
  openai: OpenAiApi | undefined,
  prompt: string,
): Promise<boolean> {
  const channels = followUpChannels({
    connected: app !== null,
    openAiFollowUp: typeof openai?.sendFollowUpMessage === 'function',
  });
  const used = await firstThatWorks(channels, async (channel) => {
    if (channel === 'openai') {
      await openai?.sendFollowUpMessage?.({ prompt });
      return true;
    }
    const result = await app?.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: prompt }],
    });
    return result !== undefined && result.isError !== true;
  });
  return used !== undefined;
}

/**
 * Run one of the server's tools through the host and read its result. A tool
 * that fails, or a host that cannot be reached, comes back as an error message
 * rather than a rejected promise, so a caller has one path to handle.
 */
export async function runServerTool<U>(
  app: App | null,
  name: string,
  args: Readonly<Record<string, unknown>>,
  guard: (value: unknown) => value is U,
): Promise<ToolOutcome<U>> {
  if (app === null) {
    return { kind: 'message', text: 'Not connected yet.', isError: true };
  }
  return app.callServerTool({ name, arguments: { ...args } }).then(
    (result) => readOutcome(result, guard),
    (failure: unknown): ToolOutcome<U> => ({
      kind: 'message',
      text:
        failure instanceof Error
          ? failure.message
          : 'The request did not go through.',
      isError: true,
    }),
  );
}
