/**
 * The apps (ChatGPT, Claude…) the user has connected with sign-in.
 *
 *   GET /api/users/self/connections
 */

import { ApiController } from '@/core/api/controller';
import { liveUid } from '@/domain/api/auth';
import { pageBody } from '@/core/api/pagination';
import { connectedAppResource } from '@/domain/connected-apps';
import { listConnectedApps } from '@/domain/db/oauth';
import { getDatabase } from '@/core/runtime';

/**
 * `GET /api/users/self/connections`: the apps the user has approved and not
 * disconnected, newest first. Answers 200 with a page of apps, or 401 when
 * nobody is signed in.
 */
export const GET = new ApiController<{
  readonly request: Request;
  readonly uid: number;
}>({
  context: async (request) => ({ request, uid: await liveUid(request) }),
})
  .on({
    method: 'GET',
    handle: async (_input, { uid }) =>
      (await listConnectedApps(getDatabase(), uid)).map(connectedAppResource),
    encode: (apps, { request }) => ({
      body: pageBody(request, apps),
      headers: { 'Cache-Control': 'private, no-cache' },
    }),
  })
  .handler('GET');
