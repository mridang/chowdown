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

interface OpenAiGlobals {
  toolOutput?: unknown;
  displayMode?: string;
}
interface OpenAiApi extends OpenAiGlobals {
  requestDisplayMode?: (params: { mode: string }) => Promise<unknown>;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  sendFollowUpMessage?: (params: { prompt: string }) => void;
}
function getOpenai(): OpenAiApi | undefined {
  return (globalThis as unknown as { openai?: OpenAiApi }).openai;
}

/** What a View gets: the current data, display mode, and host actions. */
export interface WidgetBridge<T> {
  data: T | null;
  fullscreen: boolean;
  requestFullscreen: () => Promise<void>;
  /** Trigger a follow-up turn (e.g. open a recipe from the list). */
  sendFollowUp: (prompt: string) => void;
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
    onAppCreated: (a) => {
      a.ontoolresult = (params) => {
        const sc = params.structuredContent as T | undefined;
        if (sc) setData(sc);
      };
    },
  });
  useHostStyleVariables(app, app?.getHostContext());

  useEffect(() => {
    const apply = (g?: OpenAiGlobals) => {
      if (g?.toolOutput) setData(g.toolOutput as T);
      if (typeof g?.displayMode === 'string') setDisplayMode(g.displayMode);
    };
    apply(getOpenai());
    const onGlobals = (e: Event) =>
      apply((e as CustomEvent).detail?.globals as OpenAiGlobals | undefined);
    window.addEventListener('openai:set_globals', onGlobals as EventListener);
    return () =>
      window.removeEventListener(
        'openai:set_globals',
        onGlobals as EventListener,
      );
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
