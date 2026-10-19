/**
 * Dynamic Client Registration (RFC 7591), kept for assistants that don't yet
 * use Client ID Metadata Documents. Only public clients are accepted: they
 * authenticate with PKCE, not a secret.
 *
 *   POST /oauth/register { client_name, redirect_uris, … } → 201 { client_id, … }
 */

import { saveClient } from '@/lib/db/oauth';
import {
  parseRegistrationText,
  registrationResponse,
} from '@/lib/oauth/client';
import { noStoreJson, oauthError, preflight } from '@/lib/oauth/http';
import { getDatabase } from '@/lib/util';

/**
 * `POST /oauth/register`: register a public client from a JSON body. Anyone
 * may call it. Answers 201 with the new `client_id` and its details, or 400
 * with an OAuth error for a body that is too large, not JSON, or not an
 * acceptable client.
 */
export async function POST(request: Request) {
  const result = parseRegistrationText(await request.text());
  if (!result.ok) {
    return oauthError(result.error, result.description);
  }
  await saveClient(getDatabase(), result.client);
  return noStoreJson(
    registrationResponse(result.client, Math.floor(Date.now() / 1000)),
    201,
  );
}

/** `OPTIONS /oauth/register`: the CORS preflight for browser-based assistants. Answers 204. */
export function OPTIONS() {
  return preflight();
}
