/**
 * @packageDocumentation
 *
 * The connected-apps API as controllers over the `core/api` framework: listing
 * the apps the signed-in person has approved, and disconnecting one. The route
 * files only mount these.
 */

import {
  ApiController,
  decodeCursor,
  page,
  parseLimit,
  problems,
  sliceAfter,
  type CursorPosition,
  type Slice,
} from '@/lib/core/api';
import { compareNewestFirst } from '@/domain/api/newest-first';
import {
  liveUid,
  requestCookieResolver,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import {
  connectedAppResource,
  type ConnectedApp,
} from '@/domain/connected-apps';
import { listConnectedApps, revokeConnectedApp } from '@/domain/db/oauth';
import { getDatabase } from '@/domain/db/client';

/** The signed-in person's id. */
interface UidContext {
  readonly uid: number;
}

/** The page asked for: how many apps, and where to start after. */
interface PageRequest {
  readonly limit: number;
  readonly after?: CursorPosition;
}

/** A connected app's place in the list, for cursors. */
function appPosition(app: Readonly<ConnectedApp>): CursorPosition {
  return { key: app.connected_at, id: app.id };
}

/**
 * `GET /api/users/self/connections`: the apps the user has approved and not
 * disconnected, newest first, one page at a time (`limit`, `cursor`). 200 with
 * a page of apps, 400 for a bad `limit` or `cursor`, 401 when nobody is signed
 * in. The resolver decides who is calling; it defaults to the production one
 * and is injected in tests.
 */
export function makeConnectionsCollection(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<UidContext> {
  return new ApiController<UidContext>({
    context: async (request) => ({
      uid: await liveUid(request, resolver),
    }),
  }).on<PageRequest, Slice<ConnectedApp>>({
    method: 'GET',
    decode: (request): PageRequest => {
      const query = new URL(request.url).searchParams;
      const limit = parseLimit(query.get('limit'));
      if (typeof limit !== 'number') {
        throw limit;
      }
      const cursor = query.get('cursor');
      const after = cursor ? decodeCursor(cursor) : undefined;
      if (cursor && !after) {
        throw problems.badRequest('The cursor is not valid.');
      }
      return { limit, after };
    },
    handle: async ({ limit, after }, { uid }) => {
      const apps = await listConnectedApps(getDatabase(), uid);
      return sliceAfter(
        apps.map((app) => connectedAppResource(app)),
        appPosition,
        compareNewestFirst,
        after,
        limit,
      );
    },
    encode: (slice) =>
      page(slice.items, slice.next, { 'Cache-Control': 'private, no-cache' }),
  });
}

/** The connected-apps collection controller, wired with the production resolver. */
export const connectionsCollection = makeConnectionsCollection();

/** The signed-in person's id and the grant to act on. */
interface GrantContext {
  readonly uid: number;
  readonly grantId: string;
}

/**
 * `DELETE /api/users/self/connections/:grant_id`: revoke the app's access right
 * away. 204, 404 when the grant is not the user's (or already revoked), 401
 * when nobody is signed in.
 */
export function makeConnectionItem(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<GrantContext> {
  return new ApiController<GrantContext>({
    context: async (request, route) => {
      const uid = await liveUid(request, resolver);
      const params = await route.params;
      return { uid, grantId: params?.['grant_id'] ?? '' };
    },
  }).on({
    method: 'DELETE',
    handle: async (_input, { uid, grantId }) => {
      const revoked = await revokeConnectedApp(getDatabase(), uid, grantId);
      if (!revoked) {
        throw problems.notFound('connected app');
      }
    },
  });
}

/** The connected-app item controller, wired with the production resolver. */
export const connectionItem = makeConnectionItem();
