/**
 * @packageDocumentation
 *
 * The connected-apps API as controllers over the `core/api` framework: listing
 * the apps the signed-in person has approved, and disconnecting one. The route
 * files only mount these.
 */

import { ApiController, pageBody } from '@/lib/core/api';
import { liveUid } from '@/domain/api/auth';
import { problems } from '@/lib/rest-json';
import { connectedAppResource } from '@/domain/connected-apps';
import { listConnectedApps, revokeConnectedApp } from '@/domain/db/oauth';
import { getDatabase } from '@/domain/db/client';

/** The signed-in person's id, plus the request (for building page URLs). */
interface UidContext {
  readonly request: Request;
  readonly uid: number;
}

/**
 * `GET /api/users/self/connections`: the apps the user has approved and not
 * disconnected, newest first. 200 with a page of apps, 401 when nobody is
 * signed in.
 */
export const connectionsCollection = new ApiController<UidContext>({
  context: async (request) => ({ request, uid: await liveUid(request) }),
}).on({
  method: 'GET',
  handle: async (_input, { uid }) =>
    (await listConnectedApps(getDatabase(), uid)).map(connectedAppResource),
  encode: (apps, { request }) => ({
    body: pageBody(request, apps),
    headers: { 'Cache-Control': 'private, no-cache' },
  }),
});

/**
 * `DELETE /api/users/self/connections/:grant_id`: revoke the app's access right
 * away. 204, 404 when the grant is not the user's (or already revoked), 401
 * when nobody is signed in.
 */
export const connectionItem = new ApiController<{
  readonly uid: number;
  readonly grantId: string;
}>({
  context: async (request, route) => ({
    uid: await liveUid(request),
    grantId: (await route.params)?.['grant_id'] ?? '',
  }),
}).on({
  method: 'DELETE',
  handle: async (_input, { uid, grantId }) => {
    const revoked = await revokeConnectedApp(getDatabase(), uid, grantId);
    if (!revoked) {
      throw problems.notFound('connected app');
    }
  },
});
