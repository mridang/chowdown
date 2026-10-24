/**
 * @packageDocumentation
 *
 * A minimal Model Context Protocol server over JSON-RPC 2.0, served at
 * `/mcp` (OAuth 2.1 bearer tokens). It lets an assistant (Claude, ChatGPT, …)
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

import { errorMessage, logError } from '@/utils/logging';
import type { User } from '@/domain/db/users';
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
} from '@/lib/mcp/protocol';
import {
  CAPABILITIES,
  INSTRUCTIONS,
  SERVER_INFO,
  SERVER_INFO_META_KEY,
} from '@/domain/mcp/server-info';
import { PROMPT_DEFINITIONS, getPrompt } from '@/domain/mcp/prompts';
import {
  RECIPE_TEMPLATE,
  isRecipeUri,
  listCachedRecipes,
  readRecipeResource,
  recipeResource,
  type RecipeLister,
} from '@/domain/mcp/recipe-resources';
import { callToolOrExplain } from '@/domain/mcp/tool-calls';
import { TOOLS } from '@/domain/mcp/tool-definitions';
import { InvalidToolArguments, UnknownTool } from '@/lib/mcp/tool-errors';
import {
  APP_RESOURCES,
  RESOURCE_MIME_TYPE,
  findAppResource,
} from '@/domain/mcp/ui-resources';

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
 * view's HTML is large (hundreds of kilobytes) and worth keeping longer, and a
 * view at its content-hashed address can never change (a new build is a new
 * address), so a day is safe; the discovery document describes nothing that changes between deploys. The
 * answers that differ per person are a recipe read from Drive and the list of
 * resources (which includes the person's recipes): only that person may reuse
 * them, and only briefly (recipes are added and edited).
 */
export const CACHE_HINTS = {
  discover: { ttlMs: 3_600_000, cacheScope: 'public' },
  list: { ttlMs: 300_000, cacheScope: 'public' },
  read: { ttlMs: 900_000, cacheScope: 'public' },
  immutable: { ttlMs: 86_400_000, cacheScope: 'public' },
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
  readonly listRecipes: RecipeLister;
}

/**
 * Refuse a pagination cursor on a list that has only one page. Cursors are
 * opaque tokens the server hands out, and this server hands out none for these
 * lists, so any that arrives is one it did not issue (pagination says an invalid
 * cursor should be answered `-32602`). Absent, `null` and the empty string all
 * mean "from the start": some clients send one of them with a first request,
 * and refusing it would help nobody.
 */
function refuseCursor(params: Call['params']): void {
  const cursor = params?.['cursor'];
  if (cursor !== undefined && cursor !== null && cursor !== '') {
    throw new RpcError(ERROR_INVALID_PARAMS, 'Invalid cursor');
  }
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
  /**
   * Whether the newest revision removed the method: a request of that era gets
   * "method not found", while the older revisions still use it.
   */
  readonly legacyOnly?: true;
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

/** How many recipes one page of `resources/list` holds. */
export const RESOURCE_PAGE_SIZE = 100;

/** What a cursor of `resources/list` says before its position. */
const CURSOR_PREFIX = 'recipes:';

/** The cursor that continues `resources/list` after `offset` recipes. */
function cursorAt(offset: number): string {
  return btoa(`${CURSOR_PREFIX}${offset}`);
}

/**
 * How many recipes a `resources/list` cursor has already passed. No cursor is
 * the start.
 *
 * @throws {RpcError} `-32602` for a cursor this server did not issue.
 */
function offsetOfCursor(cursor: unknown): number {
  if (cursor === undefined || cursor === null || cursor === '') {
    return 0;
  }
  const text = typeof cursor === 'string' ? decodedCursor(cursor) : undefined;
  const match = text?.match(/^recipes:(\d{1,9})$/);
  if (!match) {
    throw new RpcError(ERROR_INVALID_PARAMS, 'Invalid cursor');
  }
  return Number(match[1]);
}

/** The text inside a cursor, or nothing if it is not one of ours (not base64, not text). */
function decodedCursor(cursor: string): string | undefined {
  try {
    return atob(cursor);
  } catch {
    return undefined;
  }
}

/**
 * The answer to `resources/list`: on the first page the app's current views (the
 * older, hash-free addresses are not listed, since a host that prefetches every
 * listed view would fetch each twice, but they are still served by
 * `resources/read`), then the user's recipes, a page at a time, from the cache.
 * If the cache cannot be read the views are still listed.
 */
async function resourceListResult({
  user,
  params,
  listRecipes,
}: Call): Promise<object> {
  const offset = offsetOfCursor(params?.['cursor']);
  const views =
    offset === 0
      ? APP_RESOURCES.filter((r) => !r.legacy).map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: RESOURCE_MIME_TYPE,
          _meta: r.meta,
        }))
      : [];
  // One more than a page, to know whether there is a next one.
  const found = await listRecipes(user, offset, RESOURCE_PAGE_SIZE + 1).catch(
    (error: unknown) => {
      logError({
        event: 'mcp.list_resources_failed',
        error: errorMessage(error),
      });
      return [];
    },
  );
  const page = found.slice(0, RESOURCE_PAGE_SIZE);
  return {
    resources: [...views, ...page.map(recipeResource)],
    ...(found.length > page.length
      ? { nextCursor: cursorAt(offset + page.length) }
      : {}),
  };
}

/** The answer to `resources/templates/list`: where a single recipe can be read. */
function resourceTemplateListResult({ params }: Call): object {
  refuseCursor(params);
  return { resourceTemplates: [RECIPE_TEMPLATE] };
}

/**
 * The cache hints for a `resources/read` result: private (and short) when it
 * holds a person's recipe; shared for a view, for a day when it is read at the
 * content-hashed address it will always have, and for the shorter time when it
 * is read at an address whose content is whatever the current build ships (the
 * older hash-free addresses, and the stale hashed ones that get the current view).
 */
export function readCache(result: object): CacheHint {
  const contents = 'contents' in result ? result.contents : undefined;
  const first: unknown = Array.isArray(contents) ? contents[0] : undefined;
  const uri =
    isPlainObject(first) && typeof first['uri'] === 'string'
      ? first['uri']
      : '';
  if (isRecipeUri(uri)) {
    return CACHE_HINTS.recipe;
  }
  return findAppResource(uri)?.immutable
    ? CACHE_HINTS.immutable
    : CACHE_HINTS.read;
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
    throw new RpcError(ERROR_INVALID_PARAMS, 'Resource not found', {
      uri: uri.slice(0, ECHO_LIMIT),
    });
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

/** How much of a name or address a refusal repeats back; a client may send a megabyte of it. */
const ECHO_LIMIT = 120;

/** The refusal for a tool name the server does not have, listing the ones it does. */
function unknownToolError(name: unknown): RpcError {
  return new RpcError(
    ERROR_INVALID_PARAMS,
    `Unknown tool: ${typeof name === 'string' ? name.slice(0, ECHO_LIMIT) : 'no name given'}. The tools are ${[...TOOL_NAMES].join(', ')}.`,
  );
}

/**
 * Run a `tools/call`. The tool's name and the envelope of its arguments are
 * checked first, before anything is opened (so a typo costs nothing and a
 * person with no Drive still hears about it): an unknown tool, a missing name or
 * `arguments` that is not an object are malformed requests and answered `-32602`.
 * Arguments that are an object but do not fit the tool's schema are not: the
 * tool answers them itself, as an `isError` result that says what to change, so
 * the host shows the model the problem and the model can fix its call (the MCP
 * spec counts input validation among tool execution errors). A tool that still
 * reports its arguments as invalid by throwing is a malformed request too.
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
  ['initialize', { handle: initializeResult, legacyOnly: true }],
  [
    'server/discover',
    { handle: discoverResult, cache: CACHE_HINTS.discover, modernOnly: true },
  ],
  ['ping', { handle: () => ({}), legacyOnly: true }],
  [
    'tools/list',
    {
      handle: ({ params }) => {
        refuseCursor(params);
        return { tools: TOOLS };
      },
      cache: CACHE_HINTS.list,
    },
  ],
  ['tools/call', { handle: callTool }],
  ['resources/list', { handle: resourceListResult, cache: CACHE_HINTS.recipe }],
  [
    'resources/templates/list',
    { handle: resourceTemplateListResult, cache: CACHE_HINTS.list },
  ],
  ['resources/read', { handle: readResource, cache: readCache }],
  [
    'prompts/list',
    {
      handle: ({ params }) => {
        refuseCursor(params);
        return { prompts: PROMPT_DEFINITIONS };
      },
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
  logError({ event: 'mcp.request_failed', error: errorMessage(error) });
  return failed(id, ERROR_INTERNAL, 'Something went wrong on the server.');
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (which get an empty 202 from the route). A refusal is returned
 * as a JSON-RPC error carrying the request's id, so the client surfaces it
 * cleanly. `runTool` is what runs a tool call and `listRecipes` what finds the
 * recipes for `resources/list` (the real ones unless a test supplies its own).
 */
export async function handleMcpMessage(
  user: Readonly<User>,
  message: JsonRpcMessage,
  runTool: ToolRunner = callToolOrExplain,
  listRecipes: RecipeLister = listCachedRecipes,
): Promise<JsonRpcResponse | null> {
  // A notification expects no reply, whatever it announces.
  if (isNotification(message)) {
    return null;
  }
  const id = replyIdOf(message.id);
  const route = ROUTES.get(message.method ?? '');
  if (!route || (route.legacyOnly && isModernRequest(message))) {
    return failed(id, ERROR_METHOD_NOT_FOUND, 'Method not found');
  }
  try {
    const result = await route.handle({
      user,
      params: message.params,
      runTool,
      listRecipes,
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
