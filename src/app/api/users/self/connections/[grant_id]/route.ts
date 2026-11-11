/* eslint-disable unicorn/filename-case -- the framework requires this name: the directory name is the route parameter name */
/* eslint-enable unicorn/filename-case -- the exemption covers only the file name checked on line 1 */
/**
 * Disconnect an app: its access and refresh tokens stop working immediately.
 *
 *   DELETE /api/users/self/connections/:grant_id → 204.
 *
 * The behaviour lives in the `connectionItem` controller; this file only mounts it.
 */

import { connectionItem } from '@/domain/api/connections';

export const dynamic = 'force-dynamic';

export const { DELETE } = connectionItem.handlers();
