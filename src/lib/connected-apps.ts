/**
 * @packageDocumentation
 *
 * What the "Cook with AI" page needs to know about assistants: the addresses
 * people paste into them, and how a connected app is described in the list of
 * apps that have been given access.
 */

/** An app the user has connected, as `GET /api/users/self/connected-apps` returns it. */
export interface ConnectedApp {
  id: string;
  name: string;
  scopes: string[];
  connected_at: string;
  last_used_at?: string;
}

/** The address an assistant connects to, for the site served at `origin`. */
export function mcpUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/api/mcp`;
}

/**
 * The older "secret link": the MCP address with the user's private token on the
 * end. Anyone holding it can use the recipes, which is why the page keeps it
 * out of sight.
 */
export function secretMcpUrl(origin: string, token: string): string {
  return `${mcpUrl(origin)}/${token}`;
}

/** What an app may do, in words: the write scope means it can change recipes. */
export function accessLabel(scopes: string[]): string {
  return scopes.includes('recipes:write') ? 'Can edit' : 'Read only';
}
