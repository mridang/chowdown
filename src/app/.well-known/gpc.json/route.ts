/**
 * The Global Privacy Control support resource (W3C GPC, section on the
 * well-known resource).
 *
 *   GET /.well-known/gpc.json
 */

import { GPC_LAST_UPDATE } from '@/lib/site';

/**
 * `GET /.well-known/gpc.json`: says this site honours Global Privacy Control,
 * a signal a visitor's browser sends to opt out of the sale or sharing of their
 * data. The statement is true by construction (nothing here sells or shares
 * personal data, and there are no ads or trackers), so there is no behaviour
 * to wire to the signal. Public, answers 200.
 */
export function GET(): Response {
  return Response.json(
    { gpc: true, lastUpdate: GPC_LAST_UPDATE },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
