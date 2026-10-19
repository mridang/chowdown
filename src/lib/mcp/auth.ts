/**
 * @packageDocumentation
 *
 * Who is calling the MCP endpoint: the bearer token on the request, resolved
 * to a user and the scopes they approved. The token store and user lookup are
 * passed in, so the decision can be tested without a database.
 */

import { createOAuthStore } from '../db/oauth';
import { getUserById, type User } from '../db/users';
import { bearerToken } from '../oauth/http';
import { resourceUri } from '../oauth/metadata';
import {
  authenticateAccessToken,
  type AccessIdentity,
} from '../oauth/token-endpoint';
import { getDatabase } from '../util';

/** Who the request is from, or why it is not allowed in. */
export type McpAuth =
  /** No `Authorization: Bearer` header at all: start the sign-in flow. */
  | { readonly kind: 'no-token' }
  /** A token was sent but it is unknown, expired, revoked or for another server. */
  | { readonly kind: 'invalid-token' }
  /** A valid token: the user it belongs to and the scopes they approved. */
  | {
      readonly kind: 'ok';
      readonly user: Readonly<User>;
      readonly scope: readonly string[];
    };

/** What authenticating reaches out to. */
export interface McpAuthDeps {
  /** Resolve an access token for `resource` to the grant behind it. */
  readonly identify: (
    token: string,
    resource: string,
    now: number,
  ) => Promise<AccessIdentity | undefined>;
  /** The user with this id, if they still exist. */
  readonly findUser: (id: number) => Promise<User | undefined>;
  /** The time now, in Unix seconds. */
  readonly now: () => number;
}

/** The real database, opened only once a token has actually been sent. */
function liveDeps(): McpAuthDeps {
  const db = getDatabase();
  const store = createOAuthStore(db);
  return {
    identify: (token, resource, now) =>
      authenticateAccessToken(store, token, resource, now),
    findUser: (id) => getUserById(db, id),
    now: () => Math.floor(Date.now() / 1000),
  };
}

/**
 * Resolve the request's bearer token. `origin` is this site's public origin
 * (a token is only good for the MCP server it was issued for). `deps` is a
 * function so the database is not touched for requests that carry no token.
 */
export async function authenticateMcpRequest(
  request: Request,
  origin: string,
  deps: () => McpAuthDeps = liveDeps,
): Promise<McpAuth> {
  const token = bearerToken(request);
  if (!token) {
    return { kind: 'no-token' };
  }
  const { identify, findUser, now } = deps();
  const identity = await identify(token, resourceUri(origin), now());
  const user = identity ? await findUser(identity.userId) : undefined;
  return identity && user
    ? { kind: 'ok', user, scope: identity.scope }
    : { kind: 'invalid-token' };
}
