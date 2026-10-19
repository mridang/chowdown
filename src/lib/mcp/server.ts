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
 * resources) through a table of {@link Route}s, so a new method is one entry
 * (plus a capability); the tool catalogue is in `tool-definitions.ts`, what the
 * tools do is in `tool-calls.ts`, and what the server says about itself is in
 * `server-info.ts`.
 */

import type { User } from '../db/users';
import {
  ERROR_INTERNAL,
  ERROR_INVALID_PARAMS,
  ERROR_METHOD_NOT_FOUND,
  RpcError,
  SUPPORTED_VERSIONS,
  isModernRequest,
  isNotification,
  isPlainObject,
  negotiateLegacyVersion,
  replyIdOf,
  type ReplyId,
} from './protocol';
import {
  CAPABILITIES,
  INSTRUCTIONS,
  SERVER_INFO,
  SERVER_INFO_META_KEY,
} from './server-info';
import { PROMPT_DEFINITIONS, getPrompt } from './prompts';
import {
  RECIPE_TEMPLATE,
  isRecipeUri,
  readRecipeResource,
} from './recipe-resources';
import { callToolOrExplain } from './tool-calls';
import { TOOLS } from './tool-definitions';
import { InvalidToolArguments, UnknownTool } from './tool-errors';
import {
  APP_RESOURCES,
  RESOURCE_MIME_TYPE,
  findAppResource,
} from './ui-resources';

/** A JSON-RPC 2.0 request/notification, as received (clients may leave any member out). */
export interface JsonRpcMessage {
  readonly jsonrpc?: string;
  readonly id?: number | string | null;
  readonly method?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** A JSON-RPC error: what went wrong, and detail for the caller when there is any. */
export interface JsonRpcErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

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
      readonly error: JsonRpcErrorBody;
    };

/** A successful reply. */
function succeeded(id: ReplyId, result: object): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

/** An error reply. */
function failed(
  id: ReplyId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

/**
 * How long a client may reuse a list or a read, and who may share the copy
 * (the newest revision asks for these on every cacheable result). Everything
 * the server lists or serves is the same for every user and changes only when a
 * new version is deployed, so every answer is `public`. The tool and view lists
 * are small, so five minutes bounds how stale a client can be after a deploy
 * (there is no way to tell a client holding a fresh copy that it changed); a
 * view's HTML is large (hundreds of kilobytes) and worth keeping longer; the
 * discovery document describes nothing that changes between deploys. The one
 * answer that differs per person is a recipe read from Drive, which only the
 * person who asked may reuse, and only briefly (the recipe can be edited).
 */
export const CACHE_HINTS = {
  discover: { ttlMs: 3_600_000, cacheScope: 'public' },
  list: { ttlMs: 300_000, cacheScope: 'public' },
  read: { ttlMs: 900_000, cacheScope: 'public' },
  recipe: { ttlMs: 60_000, cacheScope: 'private' },
} as const;

/** The hints a cacheable result carries. */
export type CacheHint = (typeof CACHE_HINTS)[keyof typeof CACHE_HINTS];

/** Runs a tool by name; the real one opens Drive and the database, so tests pass their own. */
export type ToolRunner = typeof callToolOrExplain;

/** What a route's handler is given. */
interface Call {
  readonly user: Readonly<User>;
  readonly params: Readonly<Record<string, unknown>> | undefined;
  readonly runTool: ToolRunner;
}

/** One method the server answers. */
interface Route {
  /** Produce the result, or throw an {@link RpcError} to refuse the request. */
  readonly handle: (call: Call) => object | Promise<object>;
  /**
   * Caching hints for the result, for the methods the newest revision makes
   * cacheable: fixed, or chosen from the result when they depend on it.
   */
  readonly cache?: CacheHint | ((result: object) => CacheHint);
  /** Whether the method belongs to the newest revision only (and so always gets its result fields). */
  readonly modernOnly?: true;
}

/** The answer to the older revisions' `initialize` handshake. */
function initializeResult({ params }: Call): object {
  return {
    protocolVersion: negotiateLegacyVersion(params?.['protocolVersion']),
    capabilities: CAPABILITIES,
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}

/** The newest revision's way to learn what a server is, with no handshake. */
function discoverResult(): object {
  return {
    supportedVersions: SUPPORTED_VERSIONS,
    capabilities: CAPABILITIES,
    instructions: INSTRUCTIONS,
  };
}

/**
 * The answer to `resources/list`: the app's current views. The older,
 * hash-free addresses are not listed (a host that prefetches every listed view
 * would fetch each twice) but are still served by `resources/read`.
 */
function resourceListResult(): object {
  return {
    resources: APP_RESOURCES.filter((r) => !r.legacy).map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: RESOURCE_MIME_TYPE,
      _meta: r.meta,
    })),
  };
}

/** The answer to `resources/templates/list`: where a single recipe can be read. */
function resourceTemplateListResult(): object {
  return { resourceTemplates: [RECIPE_TEMPLATE] };
}

/**
 * The cache hints for a `resources/read` result: private (and short) when it
 * holds a person's recipe, shared for a view.
 */
export function readCache(result: object): CacheHint {
  const contents = 'contents' in result ? result.contents : undefined;
  const first: unknown = Array.isArray(contents) ? contents[0] : undefined;
  const uri =
    isPlainObject(first) && typeof first['uri'] === 'string'
      ? first['uri']
      : '';
  return isRecipeUri(uri) ? CACHE_HINTS.recipe : CACHE_HINTS.read;
}

/**
 * The reply to `resources/read`: a view's HTML, or one of the user's recipes
 * from their Drive, or an error for an address the server does not have.
 */
async function readResource({ user, params }: Call): Promise<object> {
  const uri = params?.['uri'];
  if (typeof uri !== 'string') {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      'resources/read needs a `uri`, as a string.',
    );
  }
  if (isRecipeUri(uri)) {
    return readRecipeResource(user, uri);
  }
  const resource = findAppResource(uri);
  if (!resource) {
    throw new RpcError(ERROR_INVALID_PARAMS, 'Resource not found', { uri });
  }
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: resource.html,
        _meta: resource.meta,
      },
    ],
  };
}

/** The answer to `prompts/get`. */
function promptResult({ params }: Call): object {
  return getPrompt(params?.['name'], params?.['arguments']);
}

/** The names of the tools the server advertises. */
const TOOL_NAMES: ReadonlySet<string> = new Set(TOOLS.map((t) => t.name));

/** Whether `name` is a tool the server advertises in `tools/list`. */
export function isAdvertisedTool(name: unknown): name is string {
  return typeof name === 'string' && TOOL_NAMES.has(name);
}

/** The refusal for a tool name the server does not have, listing the ones it does. */
function unknownToolError(name: unknown): RpcError {
  return new RpcError(
    ERROR_INVALID_PARAMS,
    `Unknown tool: ${typeof name === 'string' ? name : 'no name given'}. The tools are ${[...TOOL_NAMES].join(', ')}.`,
  );
}

/**
 * Run a `tools/call`. The tool's name and the shape of its arguments are
 * checked first, before anything is opened (so a typo costs nothing and a
 * person with no Drive still hears about it), and a tool that rejects its
 * arguments is reported as the caller's mistake (`-32602`) with what to fix.
 */
async function callTool(call: Call): Promise<object> {
  const name = call.params?.['name'];
  if (!isAdvertisedTool(name)) {
    throw unknownToolError(name);
  }
  const args = call.params?.['arguments'];
  if (args !== undefined && !isPlainObject(args)) {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      `Invalid arguments for tool ${name}: "arguments" must be an object.`,
    );
  }
  try {
    return await call.runTool(call.user, call.params);
  } catch (error) {
    if (error instanceof UnknownTool) {
      throw unknownToolError(error.tool);
    }
    if (error instanceof InvalidToolArguments) {
      throw new RpcError(
        ERROR_INVALID_PARAMS,
        `Invalid arguments for tool ${name}: ${error.problems.join(' ')}`,
        { tool: name, problems: error.problems },
      );
    }
    throw error;
  }
}

/** Every method the server answers, by name (a `Map`, so `constructor` and friends are not methods). */
const ROUTES: ReadonlyMap<string, Route> = new Map<string, Route>([
  ['initialize', { handle: initializeResult }],
  [
    'server/discover',
    { handle: discoverResult, cache: CACHE_HINTS.discover, modernOnly: true },
  ],
  ['ping', { handle: () => ({}) }],
  ['tools/list', { handle: () => ({ tools: TOOLS }), cache: CACHE_HINTS.list }],
  ['tools/call', { handle: callTool }],
  ['resources/list', { handle: resourceListResult, cache: CACHE_HINTS.list }],
  [
    'resources/templates/list',
    { handle: resourceTemplateListResult, cache: CACHE_HINTS.list },
  ],
  ['resources/read', { handle: readResource, cache: readCache }],
  [
    'prompts/list',
    {
      handle: () => ({ prompts: PROMPT_DEFINITIONS }),
      cache: CACHE_HINTS.list,
    },
  ],
  ['prompts/get', { handle: promptResult }],
]);

/** The `_meta` of a result, when it has one. */
function metaOf(result: object): Readonly<Record<string, unknown>> {
  return '_meta' in result && isPlainObject(result._meta) ? result._meta : {};
}

/**
 * Dress a successful result for the newest revision: it says it is complete,
 * carries the caching hints of its method, and names the server in `_meta`
 * (merged into any `_meta` the result already has, such as a tool's).
 * Older revisions get the result as it is.
 */
function forModernClient(result: object, route: Route): object {
  return {
    ...result,
    ...(typeof route.cache === 'function'
      ? route.cache(result)
      : (route.cache ?? {})),
    ...('resultType' in result ? {} : { resultType: 'complete' }),
    _meta: { ...metaOf(result), [SERVER_INFO_META_KEY]: SERVER_INFO },
  };
}

/** The error reply for something that went wrong while handling a request. */
function faultReply(id: ReplyId, error: unknown): JsonRpcResponse {
  if (error instanceof RpcError) {
    return failed(id, error.code, error.message, error.data);
  }
  // What went wrong stays in our logs: the text can carry Google's replies or
  // database details, which should not travel on to an assistant and the
  // service behind it.
  console.error('[mcp] request failed:', error);
  return failed(id, ERROR_INTERNAL, 'Something went wrong on the server.');
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (which get an empty 202 from the route). A refusal is returned
 * as a JSON-RPC error carrying the request's id, so the client surfaces it
 * cleanly. `runTool` is what runs a tool call (the real tools unless a test
 * supplies its own).
 */
export async function handleMcpMessage(
  user: Readonly<User>,
  message: JsonRpcMessage,
  runTool: ToolRunner = callToolOrExplain,
): Promise<JsonRpcResponse | null> {
  // A notification expects no reply, whatever it announces.
  if (isNotification(message)) {
    return null;
  }
  const id = replyIdOf(message.id);
  const route = ROUTES.get(message.method ?? '');
  if (!route) {
    return failed(id, ERROR_METHOD_NOT_FOUND, 'Method not found');
  }
  try {
    const result = await route.handle({
      user,
      params: message.params,
      runTool,
    });
    return succeeded(
      id,
      route.modernOnly || isModernRequest(message)
        ? forModernClient(result, route)
        : result,
    );
  } catch (error) {
    return faultReply(id, error);
  }
}
