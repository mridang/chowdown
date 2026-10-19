/**
 * Shared data/actions bridge for the chowdown Views. MCP Apps hosts differ in
 * how they talk to a View: ChatGPT uses its `window.openai` bridge (the
 * `toolOutput` global + an `openai:set_globals` event + `callTool` /
 * `requestDisplayMode` / `sendFollowUpMessage` methods), while standard hosts
 * use the ext-apps `App` (the `ui/notifications/tool-result` handler). This
 * hook reads from both so a View renders and acts correctly in either.
 */

import {
  useApp,
  useHostStyleVariables,
} from '@modelcontextprotocol/ext-apps/react';
import { useCallback, useEffect, useState } from 'react';

/** The values ChatGPT keeps on `window.openai` and announces with `openai:set_globals`. */
interface OpenAiGlobals {
  readonly toolOutput?: unknown;
  readonly displayMode?: string;
}

/** ChatGPT's bridge: its globals, plus the actions it lets a View take. */
interface OpenAiApi extends OpenAiGlobals {
  readonly requestDisplayMode?: (params: {
    readonly mode: string;
  }) => Promise<unknown>;
  readonly sendFollowUpMessage?: (params: { readonly prompt: string }) => void;
}

/** ChatGPT's bridge, when the View is running inside ChatGPT; otherwise nothing. */
function getOpenai(): OpenAiApi | undefined {
  const candidate: unknown = Reflect.get(globalThis, 'openai');
  return typeof candidate === 'object' && candidate !== null
    ? candidate
    : undefined;
}

/** What a View gets: the current data, display mode, and host actions. */
export interface WidgetBridge<T> {
  /** The tool's output, or `null` until the host has delivered it. */
  readonly data: T | null;
  readonly fullscreen: boolean;
  readonly requestFullscreen: () => Promise<void>;
  /** Trigger a follow-up turn (e.g. open a recipe from the list). */
  readonly sendFollowUp: (prompt: string) => void;
}

/**
 * Connect the View to its host and return the tool's `structuredContent`
 * (typed as `T`), kept live as the host pushes updates.
 */
export function useWidgetData<T>(appName: string): WidgetBridge<T> {
  const [data, setData] = useState<T | null>(null);
  const [displayMode, setDisplayMode] = useState('inline');
  const [localFullscreen, setLocalFullscreen] = useState(false);

  const { app } = useApp({
    appInfo: { name: appName, version: '0.1.0' },
    capabilities: {},
    onAppCreated: (created) => {
      // The payload is our own tool's `structuredContent`, typed `T` by contract.
      created.addEventListener('toolresult', (params) => {
        const sc = params.structuredContent as T | undefined;
        if (sc) setData(sc);
      });
    },
  });
  useHostStyleVariables(app, app?.getHostContext());

  useEffect(() => {
    const apply = (g?: OpenAiGlobals) => {
      if (g?.toolOutput) setData(g.toolOutput as T);
      if (typeof g?.displayMode === 'string') setDisplayMode(g.displayMode);
    };
    apply(getOpenai());
    const onGlobals = (event: Event) => {
      if (event instanceof CustomEvent) {
        apply(event.detail?.globals);
      }
    };
    window.addEventListener('openai:set_globals', onGlobals);
    return () => window.removeEventListener('openai:set_globals', onGlobals);
  }, []);

  const requestFullscreen = useCallback(async () => {
    const oa = getOpenai();
    try {
      if (oa?.requestDisplayMode) {
        await oa.requestDisplayMode({ mode: 'fullscreen' });
      } else if (app) {
        await app.requestDisplayMode({ mode: 'fullscreen' });
      }
    } catch {
      /* fall through to local fullscreen */
    }
    setLocalFullscreen(true);
  }, [app]);

  const sendFollowUp = useCallback((prompt: string) => {
    getOpenai()?.sendFollowUpMessage?.({ prompt });
  }, []);

  return {
    data,
    fullscreen: displayMode === 'fullscreen' || localFullscreen,
    requestFullscreen,
    sendFollowUp,
  };
}
