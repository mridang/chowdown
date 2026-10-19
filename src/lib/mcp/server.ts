/**
 * @packageDocumentation
 *
 * A minimal Model Context Protocol server over JSON-RPC 2.0, served at
 * `/api/mcp` (OAuth 2.1 bearer tokens). It lets an assistant (Claude, ChatGPT, …)
 * work with the user's recipes headlessly: browse and search them, read one,
 * add, edit, tag, favourite and annotate recipes, and set the measurement system.
 *
 * Drive access is via the user's stored refresh token, so the tools work with
 * no browser open; a person who hasn't connected Google Drive gets an error
 * result that says how to (see `callToolOrExplain`). The server is
 * deliberately hand-rolled (no SDK) to keep the Worker bundle small and the
 * transport simple: each POST carries one JSON-RPC message (or a batch) and gets
 * one JSON response. Both the legacy handshake revisions and the stateless
 * 2026-07-28 one are spoken (see `protocol.ts`).
 *
 * This file routes messages (handshake, discovery, listing, calling, reading
 * resources); the tool catalogue is in `tool-definitions.ts` and what the tools
 * do is in `tool-calls.ts`.
 */

import type { User } from '../db/users';
import {
  SUPPORTED_VERSIONS,
  isModernRequest,
  negotiateLegacyVersion,
} from './protocol';
import { TOOLS } from './tool-definitions';
import { callToolOrExplain } from './tool-calls';
import {
  APP_RESOURCES,
  CARD_UI_META,
  RESOURCE_MIME_TYPE,
} from './ui-resources';

/** A JSON-RPC 2.0 request/notification, as received (clients may leave any member out). */
export interface JsonRpcMessage {
  readonly jsonrpc?: string;
  readonly id?: number | string | null;
  readonly method?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** The id a reply carries: the request's, or null when it had none. */
type ReplyId = number | string | null;

/** A JSON-RPC reply: a result, or an error. */
export type JsonRpcResponse =
  | {
      readonly jsonrpc: '2.0';
      readonly id: ReplyId;
      readonly result: object;
    }
  | {
      readonly jsonrpc: '2.0';
      readonly id: ReplyId;
      readonly error: { readonly code: number; readonly message: string };
    };

/** A successful reply. */
function succeeded(id: ReplyId, result: object): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

/** An error reply. */
function failed(id: ReplyId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** What an assistant should know before using the tools. */
const INSTRUCTIONS =
  "chowdown stores the user's cooking recipes as Cooklang files in their Google Drive. " +
  'IMPORTANT: this server never fetches URLs or browses the web. When the user gives a ' +
  'recipe link or web page, YOU open and read that page yourself, then call import_recipe ' +
  "and pass the page's RAW text or HTML as `content` — do NOT convert it to Cooklang " +
  'yourself; chowdown does the Cooklang conversion so the format stays consistent. Use ' +
  'add_recipe only for a recipe the user dictates directly as Cooklang, capture_idea for a ' +
  'vague wish with no full recipe yet, and log_cooking to record notes about a cook. ' +
  "When the user says what they feel like eating ('I feel like cooking Indian today', " +
  "'something vegetarian', 'a quick pescatarian dinner') use browse_recipes; when they say " +
  "what they have ('I have 3 tomatoes and 400 g of pasta') use recipes_from_ingredients and " +
  'tell them what is missing from the near misses; list_filters shows what the collection holds. ' +
  'Every recipe is classed vegan, vegetarian, pescatarian or non-vegetarian.';

/** The name and version this server reports about itself. */
const SERVER_INFO = { name: 'chowdown', version: '0.1.0' } as const;

/** What this server can do, as announced in the handshake and in discovery. */
const CAPABILITIES = { tools: {}, resources: {} } as const;

/** The answer to the older revisions' `initialize` handshake. */
function initializeResult(requestedVersion: unknown): object {
  return {
    protocolVersion: negotiateLegacyVersion(requestedVersion),
    capabilities: CAPABILITIES,
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}

/** The newest revision's way to learn what a server is, with no handshake. */
function discoverResult(): object {
  return {
    resultType: 'complete',
    supportedVersions: SUPPORTED_VERSIONS,
    capabilities: CAPABILITIES,
    _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO },
    instructions: INSTRUCTIONS,
    ttlMs: 3_600_000,
    cacheScope: 'public',
  };
}

/** The answer to `resources/list`: the app's views. */
function resourceListResult(): object {
  return {
    resources: APP_RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: RESOURCE_MIME_TYPE,
      _meta: CARD_UI_META,
    })),
  };
}

/** The reply to `resources/read`: the view's HTML, or an error for an unknown address. */
function readResource(id: ReplyId, uri: string): JsonRpcResponse {
  const resource = APP_RESOURCES.find((r) => r.uri === uri);
  return resource
    ? succeeded(id, {
        contents: [
          {
            uri: resource.uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: resource.html,
            _meta: CARD_UI_META,
          },
        ],
      })
    : failed(id, -32602, `Unknown resource: ${uri}`);
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (which get an empty 202 from the route). Errors in a tool are
 * returned as a JSON-RPC error so the client surfaces them cleanly.
 */
export async function handleMcpMessage(
  user: Readonly<User>,
  message: JsonRpcMessage,
): Promise<JsonRpcResponse | null> {
  const response = await dispatch(user, message);
  // In the newest revision every successful result says it is complete.
  if (
    response &&
    'result' in response &&
    isModernRequest(message) &&
    !('resultType' in response.result)
  ) {
    return succeeded(response.id, {
      ...response.result,
      resultType: 'complete',
    });
  }
  return response;
}

/** Route one message to what handles it. */
async function dispatch(
  user: Readonly<User>,
  message: JsonRpcMessage,
): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;
  // A notification expects no reply, whatever it announces.
  if (
    typeof message.method === 'string' &&
    message.method.startsWith('notifications/')
  ) {
    return null;
  }
  try {
    switch (message.method) {
      case 'initialize':
        return succeeded(
          id,
          initializeResult(message.params?.['protocolVersion']),
        );
      case 'server/discover':
        return succeeded(id, discoverResult());
      case 'ping':
        return succeeded(id, {});
      case 'tools/list':
        return succeeded(id, { tools: TOOLS });
      case 'tools/call':
        return succeeded(id, await callToolOrExplain(user, message.params));
      case 'resources/list':
        return succeeded(id, resourceListResult());
      case 'resources/read': {
        const uri = message.params?.['uri'];
        return readResource(id, typeof uri === 'string' ? uri : '');
      }
      default:
        return failed(id, -32601, 'Method not found');
    }
  } catch (err) {
    // What went wrong stays in our logs: the text can carry Google's replies or
    // database details, which should not travel on to an assistant and the
    // service behind it.
    console.error('[mcp] request failed:', err);
    return failed(id, -32000, 'Something went wrong on the server.');
  }
}
