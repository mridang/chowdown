/**
 * Disconnect an app: its access and refresh tokens stop working immediately.
 *
 *   DELETE /api/users/self/connections/:grant_id → 204
 */

import { ApiController } from '@/core/api/controller';
import { liveUid } from '@/domain/api/auth';
import { ProblemError, problems } from '@/lib/rest-json/problem';
import { revokeConnectedApp } from '@/domain/db/oauth';
import { getDatabase } from '@/core/runtime';

/**
 * `DELETE /api/users/self/connections/:grant_id`: revoke the app's access
 * right away. Answers 204, 404 when the grant is not the user's (or is already
 * revoked), 401 when nobody is signed in.
 */
export const DELETE = new ApiController<
  { readonly uid: number; readonly grantId: string },
  { readonly params: Promise<{ readonly grant_id: string }> }
>({
  context: async (request, route) => ({
    uid: await liveUid(request),
    grantId: (await route.params).grant_id,
  }),
})
  .on({
    method: 'DELETE',
    handle: async (_input, { uid, grantId }) => {
      const revoked = await revokeConnectedApp(getDatabase(), uid, grantId);
      if (!revoked) {
        throw new ProblemError(problems.notFound('connected app'));
      }
    },
  })
  .handler('DELETE');
