/**
 * @packageDocumentation
 *
 * What the "Cook with AI" page needs to know about assistants: the addresses
 * people paste into them, and how a connected app is described in the list of
 * apps that have been given access.
 */

import type { ConnectedApp as StoredConnectedApp } from './db/oauth';

/** An app the user has connected, as `GET /api/users/self/connected-apps` returns it. */
export interface ConnectedApp {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly string[];
  readonly connected_at: string;
  readonly last_used_at?: string;
}

/** The wire form of a stored grant: snake_case members, and no `last_used_at` for an app never used. */
export function connectedAppResource(
  app: Readonly<StoredConnectedApp>,
): ConnectedApp {
  return {
    id: app.grantId,
    name: app.name,
    scopes: app.scope,
    connected_at: app.connectedAt,
    ...(app.lastUsedAt ? { last_used_at: app.lastUsedAt } : {}),
  };
}

/** The address an assistant connects to, for the site served at `origin`. */
export function mcpUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/api/mcp`;
}

/** What an app may do, in words: the write scope means it can change recipes. */
export function accessLabel(scopes: readonly string[]): string {
  return scopes.includes('recipes:write') ? 'Can edit' : 'Read only';
}
