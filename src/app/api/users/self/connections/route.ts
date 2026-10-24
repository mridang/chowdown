/**
 * The apps (ChatGPT, Claude…) the user has connected with sign-in.
 *
 *   GET /api/users/self/connections
 *
 * The behaviour lives in the `connectionsCollection` controller; this file only
 * mounts it.
 */

import { connectionsCollection } from '@/domain/api/connections';

export const dynamic = 'force-dynamic';

export const { GET } = connectionsCollection.handlers();
