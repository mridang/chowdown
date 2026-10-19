import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { LayoutAction } from '../../src/views/display-mode';
import {
  applyDocumentContext,
  applyHostContext,
  attachHostListeners,
  requestMode,
  runServerTool,
  sendFollowUpMessage,
} from '../../src/views/host-wiring';
import type { OpenAiApi } from '../../src/views/openai-bridge';
import type { ViewAction } from '../../src/views/view-state';
import {
  joinedHost,
  recordingRoot,
  settle,
  type JoinedHost,
} from './host-harness';

type Data = { readonly n: number };

/** The guard the stand-in View uses: `{ n: number }`. */
function isData(value: unknown): value is Data {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'n') === 'number'
  );
}

/** Joined View and host, plus everything the View's listeners did. */
async function session(
  configure: (host: JoinedHost['bridge']) => void = () => undefined,
  hostContext: Readonly<Record<string, unknown>> = {},
) {
  const actions: ViewAction<Data>[] = [];
  const layouts: LayoutAction[] = [];
  const root = recordingRoot();
  const joined = await joinedHost(
    (app) =>
      attachHostListeners(app, {
        dispatch: (action) => void actions.push(action),
        dispatchLayout: (action) => void layouts.push(action),
        root,
        guard: isData,
      }),
    configure,
    hostContext,
  );
  return { ...joined, actions, layouts, root };
}

beforeEach(() => {
  // The SDK logs every message it sends and receives at debug level.
  jest.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  jest.restoreAllMocks();
});

describe('the handshake', () => {
  it('declares every display mode the Views lay out', async () => {
    const { bridge } = await session();
    expect(bridge.getAppCapabilities()?.availableDisplayModes).toEqual([
      'inline',
      'fullscreen',
    ]);
    expect(bridge.getAppVersion()?.name).toBe('view');
  });

  it('hands the host context to the View', async () => {
    const { app } = await session(undefined, {
      theme: 'dark',
      displayMode: 'inline',
    });
    expect(app.getHostContext()?.theme).toBe('dark');
  });
});

describe('attachHostListeners', () => {
  it('turns the tool input, partial input and result into View actions', async () => {
    const { bridge, actions } = await session();
    await bridge.sendToolInputPartial({ arguments: { name: 'Pa' } });
    await bridge.sendToolInput({ arguments: { name: 'Pasta' } });
    await bridge.sendToolResult({
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: { n: 3 },
    });
    await settle();
    expect(actions).toEqual([
      { type: 'input', args: { name: 'Pa' } },
      { type: 'input', args: { name: 'Pasta' } },
      { type: 'result', outcome: { kind: 'data', data: { n: 3 } } },
    ]);
  });

  it('reads an error result as the server’s message, not as data', async () => {
    const { bridge, actions } = await session();
    await bridge.sendToolResult({
      isError: true,
      content: [{ type: 'text', text: 'No recipe found.' }],
      structuredContent: { n: 1 },
    });
    await settle();
    expect(actions).toEqual([
      {
        type: 'result',
        outcome: { kind: 'message', text: 'No recipe found.', isError: true },
      },
    ]);
  });

  it('reports a cancelled call with its reason', async () => {
    const { bridge, actions } = await session();
    await bridge.sendToolCancelled({ reason: 'user stopped it' });
    await settle();
    expect(actions).toEqual([{ type: 'cancelled', reason: 'user stopped it' }]);
  });

  it('follows the host into and out of fullscreen', async () => {
    const { bridge, layouts } = await session();
    bridge.setHostContext({ displayMode: 'fullscreen' });
    await settle();
    bridge.setHostContext({ displayMode: 'inline' });
    await settle();
    expect(layouts).toEqual([
      { type: 'host-mode', mode: 'fullscreen' },
      { type: 'host-mode', mode: 'inline' },
    ]);
  });

  it('applies safe-area insets, a fixed height and the language to the page', async () => {
    const { bridge, root } = await session();
    bridge.setHostContext({
      safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 },
      containerDimensions: { height: 400 },
      locale: 'fr-FR',
    });
    await settle();
    expect(root.properties.get('--safe-top')).toBe('47px');
    expect(root.properties.get('--safe-bottom')).toBe('34px');
    expect(root.attributes.get('data-fixed-height')).toBe('');
    expect(root.attributes.get('lang')).toBe('fr-FR');
  });

  it('acknowledges the host closing the View', async () => {
    const { bridge } = await session();
    await expect(bridge.teardownResource({})).resolves.toEqual({});
  });
});

describe('applyDocumentContext and applyHostContext', () => {
  it('leaves the page alone for a context that says nothing about it', () => {
    const root = recordingRoot();
    applyDocumentContext({ theme: 'light' }, root);
    expect(root.properties.size).toBe(0);
    expect(root.attributes.size).toBe(0);
  });

  it('ignores a locale that is not a language tag and clears a flexible height', () => {
    const root = recordingRoot();
    applyDocumentContext(
      { locale: '"><script>', containerDimensions: { maxHeight: 500 } },
      root,
    );
    expect(root.attributes.has('lang')).toBe(false);
    expect(root.attributes.has('data-fixed-height')).toBe(false);
  });

  it('does nothing without a context, and only reports modes it knows', () => {
    const layouts: LayoutAction[] = [];
    const root = recordingRoot();
    applyHostContext(undefined, (action) => void layouts.push(action), root);
    applyHostContext(
      Object.fromEntries([['displayMode', 'window']]),
      (action) => void layouts.push(action),
      root,
    );
    expect(layouts).toEqual([]);
  });
});

describe('requestMode', () => {
  it('reports the mode the host actually set, which can differ from the request', async () => {
    const { app } = await session((bridge) => {
      bridge.onrequestdisplaymode = () => Promise.resolve({ mode: 'inline' });
    });
    expect(await requestMode(app, undefined, 'fullscreen')).toBe('inline');
  });

  it('falls back to ChatGPT’s bridge when the standard request fails', async () => {
    const { app } = await session((bridge) => {
      bridge.onrequestdisplaymode = () =>
        Promise.reject(new Error('not supported'));
    });
    const openai: OpenAiApi = {
      requestDisplayMode: () => Promise.resolve({ mode: 'fullscreen' }),
    };
    expect(await requestMode(app, openai, 'fullscreen')).toBe('fullscreen');
  });

  it('is undefined when nothing gave a recognisable answer', async () => {
    const { app } = await session((bridge) => {
      bridge.onrequestdisplaymode = () =>
        Promise.reject(new Error('not supported'));
    });
    expect(await requestMode(app, undefined, 'fullscreen')).toBeUndefined();
    expect(await requestMode(null, undefined, 'fullscreen')).toBeUndefined();
    expect(
      await requestMode(
        null,
        {
          requestDisplayMode: () => Promise.reject(new Error('no')),
        },
        'fullscreen',
      ),
    ).toBeUndefined();
  });
});

describe('sendFollowUpMessage', () => {
  it('sends a ui/message as the person when the host takes it', async () => {
    const received: unknown[] = [];
    const { app } = await session((bridge) => {
      bridge.onmessage = (params) => {
        received.push(params);
        return Promise.resolve({});
      };
    });
    expect(
      await sendFollowUpMessage(
        app,
        undefined,
        'Open the saved recipe with id a1',
      ),
    ).toBe(true);
    expect(received).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Open the saved recipe with id a1' }],
      },
    ]);
  });

  it('prefers ChatGPT’s own follow-up inside ChatGPT, and sends nothing else', async () => {
    const prompts: string[] = [];
    const received: unknown[] = [];
    const { app } = await session((bridge) => {
      bridge.onmessage = (params) => {
        received.push(params);
        return Promise.resolve({});
      };
    });
    const openai: OpenAiApi = {
      sendFollowUpMessage: ({ prompt }) => void prompts.push(prompt),
    };
    expect(await sendFollowUpMessage(app, openai, 'hello')).toBe(true);
    expect(prompts).toEqual(['hello']);
    expect(received).toEqual([]);
  });

  it('falls through to ui/message when ChatGPT’s route throws', async () => {
    const received: unknown[] = [];
    const { app } = await session((bridge) => {
      bridge.onmessage = (params) => {
        received.push(params);
        return Promise.resolve({});
      };
    });
    const openai: OpenAiApi = {
      sendFollowUpMessage: () => Promise.reject(new Error('refused')),
    };
    expect(await sendFollowUpMessage(app, openai, 'hello')).toBe(true);
    expect(received).toHaveLength(1);
  });

  it('reports false when the host refuses the message or there is no route', async () => {
    const { app } = await session((bridge) => {
      bridge.onmessage = () => Promise.resolve({ isError: true });
    });
    expect(await sendFollowUpMessage(app, undefined, 'hello')).toBe(false);
    expect(await sendFollowUpMessage(null, undefined, 'hello')).toBe(false);
  });
});

describe('runServerTool', () => {
  it('runs the tool with the arguments and reads the structured result', async () => {
    const calls: unknown[] = [];
    const { app } = await session((bridge) => {
      bridge.oncalltool = (params) => {
        calls.push(params);
        return Promise.resolve({
          content: [{ type: 'text', text: 'ok' }],
          structuredContent: { n: 7 },
        });
      };
    });
    const outcome = await runServerTool(
      app,
      'get_recipe',
      { name: 'a1' },
      isData,
    );
    expect(outcome).toEqual({ kind: 'data', data: { n: 7 } });
    expect(calls).toMatchObject([
      { name: 'get_recipe', arguments: { name: 'a1' } },
    ]);
  });

  it('turns a failing call into an error message instead of rejecting', async () => {
    const { app } = await session((bridge) => {
      bridge.oncalltool = () => Promise.reject(new Error('Tool is down.'));
    });
    const outcome = await runServerTool(
      app,
      'get_recipe',
      { name: 'a1' },
      isData,
    );
    expect(outcome).toMatchObject({ kind: 'message', isError: true });
  });

  it('says it is not connected before the handshake', async () => {
    expect(await runServerTool(null, 'x', {}, isData)).toEqual({
      kind: 'message',
      text: 'Not connected yet.',
      isError: true,
    });
  });
});
