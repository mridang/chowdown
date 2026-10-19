import {
  App,
  PostMessageTransport as ViewTransport,
} from '@modelcontextprotocol/ext-apps';
import {
  AppBridge,
  PostMessageTransport as HostTransport,
} from '@modelcontextprotocol/ext-apps/app-bridge';

import type { DocumentRoot } from '../../src/views/host-wiring';

/** Wait for queued messages to be delivered, in both directions. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

/** A page root that records what the View does to it. */
export function recordingRoot(): DocumentRoot & {
  readonly properties: Map<string, string>;
  readonly attributes: Map<string, string>;
} {
  const properties = new Map<string, string>();
  const attributes = new Map<string, string>();
  return {
    properties,
    attributes,
    style: {
      setProperty: (name, value) => void properties.set(name, value),
    },
    setAttribute: (name, value) => void attributes.set(name, value),
    toggleAttribute: (name, force) => {
      if (force === true) {
        attributes.set(name, '');
      } else {
        attributes.delete(name);
      }
      return force === true;
    },
  };
}

/** What {@link joinedHost} hands back. */
export interface JoinedHost {
  /** The View's side, with its listeners already attached by the caller. */
  readonly app: App;
  /** The real host side of the MCP Apps channel, from the SDK. */
  readonly bridge: AppBridge;
}

/**
 * Join an `App` (the View side) to an `AppBridge` (the host side) through two
 * stand-in windows, the way an iframe and its parent are joined. Both SDK
 * transports listen on the global `window` and tell the two senders apart by
 * `event.source`, so one fake `window` that delivers each posted message with
 * the other side as its source is enough. No DOM is needed.
 *
 * @param prepare - Called with the app before the handshake, to attach listeners.
 * @param configure - Called with the bridge before the handshake, to set host handlers.
 */
export async function joinedHost(
  prepare: (app: App) => void,
  configure: (bridge: AppBridge) => void,
  hostContext: Readonly<Record<string, unknown>> = {},
): Promise<JoinedHost> {
  const listeners = new Set<
    (event: { data: unknown; source: unknown }) => void
  >();
  const deliver = (data: unknown, source: unknown) =>
    void setTimeout(() => {
      [...listeners].forEach((listener) => listener({ data, source }));
    }, 0);
  const viewWindow: { postMessage: (data: unknown) => void } = {
    postMessage: (data) => deliver(data, hostWindow),
  };
  const hostWindow: { postMessage: (data: unknown) => void } = {
    postMessage: (data) => deliver(data, viewWindow),
  };
  Reflect.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      parent: hostWindow,
      addEventListener: (
        _type: string,
        listener: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.add(listener),
      removeEventListener: (
        _type: string,
        listener: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.delete(listener),
    },
  });

  const bridge = new AppBridge(
    null,
    { name: 'test-host', version: '1.0.0' },
    { serverTools: {}, openLinks: {}, message: {} },
    { hostContext },
  );
  configure(bridge);
  const app = new App(
    { name: 'view', version: '0.1.0' },
    { availableDisplayModes: ['inline', 'fullscreen'] },
    { autoResize: false },
  );
  prepare(app);
  await bridge.connect(
    new HostTransport(
      viewWindow as unknown as Window,
      viewWindow as unknown as MessageEventSource,
    ),
  );
  await app.connect(
    new ViewTransport(
      hostWindow as unknown as Window,
      hostWindow as unknown as MessageEventSource,
    ),
  );
  await settle();
  return { app, bridge };
}
