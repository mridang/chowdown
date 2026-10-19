/**
 * @packageDocumentation
 *
 * ChatGPT's own bridge, `window.openai`. ChatGPT also speaks the standard MCP
 * Apps protocol, which the Views use first; this bridge is kept as the
 * ChatGPT-specific enhancement for the few things where it is the better
 * route: reading the tool output it has already received, following its
 * `openai:set_globals` events, and asking for a follow-up turn or a display
 * mode. Everything is feature-detected, because outside ChatGPT none of it
 * exists, and nothing is assumed about its shape.
 */

/** The values ChatGPT keeps on `window.openai` and announces with `openai:set_globals`. */
export interface OpenAiGlobals {
  readonly toolOutput?: unknown;
  readonly displayMode?: unknown;
}

/** ChatGPT's bridge: its globals, plus the actions it lets a View take. */
export interface OpenAiApi extends OpenAiGlobals {
  readonly requestDisplayMode?: (params: {
    readonly mode: string;
  }) => Promise<unknown>;
  readonly sendFollowUpMessage?: (params: {
    readonly prompt: string;
  }) => Promise<unknown> | void;
}

/** ChatGPT's bridge, when the View is running inside ChatGPT; otherwise nothing. */
export function getOpenAi(): OpenAiApi | undefined {
  const candidate: unknown = Reflect.get(globalThis, 'openai');
  return typeof candidate === 'object' && candidate !== null
    ? candidate
    : undefined;
}

/** The globals carried by an `openai:set_globals` event, or nothing for any other event. */
export function globalsFromEvent(event: Event): OpenAiGlobals | undefined {
  if (!(event instanceof CustomEvent)) {
    return undefined;
  }
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null) {
    return undefined;
  }
  const globals: unknown = Reflect.get(detail, 'globals');
  return typeof globals === 'object' && globals !== null ? globals : undefined;
}
