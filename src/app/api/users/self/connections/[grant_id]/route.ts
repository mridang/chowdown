/**
 * Disconnect an app: its access and refresh tokens stop working immediately.
 *
 *   DELETE /api/users/self/connections/:grant_id → 204
 *
 * The behaviour lives in the `connectionItem` controller; this file only mounts it.
 */

import { connectionItem } from '@/domain/api/connections';

export const dynamic = 'force-dynamic';

export const { DELETE } = connectionItem.handlers();
