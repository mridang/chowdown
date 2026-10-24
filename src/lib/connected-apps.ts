/**
 * @packageDocumentation
 *
 * What the "Cook with AI" page needs to know about assistants: the addresses
 * people paste into them, and how a connected app is described in the list of
 * apps that have been given access.
 */

import type { ConnectedApp as StoredConnectedApp } from './db/oauth';

/** An app the user has connected, as `GET /api/users/self/connections` returns it. */
export interface ConnectedApp {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly string[];
  /** How many separate installs of the app are connected (each approved on its own). */
  readonly installs: number;
  /** The domain that published the app; absent for an app that registered itself without any check. */
  readonly domain?: string;
  /** The picture the app publishes for itself; absent for an app that has none or is unverified. */
  readonly logo_uri?: string;
  readonly connected_at: string;
  readonly last_used_at?: string;
}

/** The wire form of a stored connection: snake_case members, no `last_used_at` for an app never used and no `domain` for an unverified one. */
export function connectedAppResource(
  app: Readonly<StoredConnectedApp>,
): ConnectedApp {
  return {
    id: app.grantId,
    name: app.name,
    scopes: app.scope,
    installs: app.installs,
    ...(app.domain ? { domain: app.domain } : {}),
    ...(app.logoUri ? { logo_uri: app.logoUri } : {}),
    connected_at: app.connectedAt,
    ...(app.lastUsedAt ? { last_used_at: app.lastUsedAt } : {}),
  };
}

/** The address an assistant connects to, for the site served at `origin`. */
export function mcpUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/mcp`;
}

/**
 * What an app may do, in words: the write scope means it can change recipes. An
 * app connected more than once says so ("Can edit (2 installs)"): the scopes
 * shown are the widest of any install, and disconnecting ends all of them.
 */
export function accessLabel(
  scopes: readonly string[],
  installs: number = 1,
): string {
  const access = scopes.includes('recipes:write') ? 'Can edit' : 'Read only';
  return installs > 1 ? `${access} (${installs} installs)` : access;
}
