/**
 * @packageDocumentation
 *
 * The scopes an assistant can hold on a user's recipes, and which MCP calls
 * need which. Two scopes keep consent simple and let a connector be read-only:
 * `recipes:read` (browse, search, view) and `recipes:write` (everything that
 * changes a recipe, the user's settings or their notes). Write implies read.
 */

export const SCOPE_READ = 'recipes:read';
export const SCOPE_WRITE = 'recipes:write';

/** Every scope the server understands. */
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE];

/**
 * Tools that only read. Anything not listed here is treated as a write, so a
 * newly added tool is protected by default until someone classifies it.
 */
const READ_ONLY_TOOLS = new Set([
  'list_recipes',
  'search_recipes',
  'find_recipes',
  'find_similar',
  'get_recipe',
]);

/**
 * Turn a request's space-separated `scope` into the scopes to grant. No scope
 * asked for means everything we support; asking only for scopes we don't know
 * yields an empty list, which the caller reports as `invalid_scope`. Unknown
 * scopes mixed with known ones are dropped rather than failing the request.
 */
export function normaliseScope(requested: string | undefined | null): string[] {
  const asked = (requested ?? '').split(/\s+/).filter(Boolean);
  if (asked.length === 0) {
    return [...SUPPORTED_SCOPES];
  }
  return SUPPORTED_SCOPES.filter((s) => asked.includes(s));
}

/** Whether the granted scopes cover `needed` (write covers read). */
export function hasScope(granted: string[], needed: string): boolean {
  if (granted.includes(needed)) {
    return true;
  }
  return needed === SCOPE_READ && granted.includes(SCOPE_WRITE);
}

/** The scope one MCP tool needs. */
export function scopeForTool(name: string): string {
  return READ_ONLY_TOOLS.has(name) ? SCOPE_READ : SCOPE_WRITE;
}

/** A JSON-RPC message as far as scope checking cares. */
export interface ScopedMessage {
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * The scope a JSON-RPC message needs. Calling a tool needs that tool's scope;
 * every other method (handshake, listing tools, reading UI resources) only
 * needs a valid token, which means at least read.
 */
export function scopeForMessage(message: ScopedMessage): string {
  if (message.method === 'tools/call') {
    const name = message.params?.['name'];
    return typeof name === 'string' ? scopeForTool(name) : SCOPE_WRITE;
  }
  return SCOPE_READ;
}
