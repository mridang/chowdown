/**
 * Dynamic Client Registration (RFC 7591), kept for assistants that don't yet
 * use Client ID Metadata Documents. Only public clients are accepted: they
 * authenticate with PKCE, not a secret.
 *
 *   POST /oauth/register { client_name, redirect_uris, … } → 201 { client_id, … }
 */

import { saveClient } from '@/lib/db/oauth';
import { noStoreJson, oauthError, preflight } from '@/lib/oauth/http';
import { parseRegistration } from '@/lib/oauth/client';
import { getDatabase } from '@/lib/util';

/** Registration bodies are tiny; refuse anything big. */
const MAX_BODY_BYTES = 8_000;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return oauthError('invalid_client_metadata', 'The request is too large.');
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return oauthError(
      'invalid_client_metadata',
      'The request is not valid JSON.',
    );
  }
  const result = parseRegistration(body);
  if (!result.ok) {
    return oauthError(result.error, result.description);
  }
  await saveClient(getDatabase(), result.client);
  return noStoreJson(
    {
      client_id: result.client.clientId,
      client_name: result.client.name,
      redirect_uris: result.client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    201,
  );
}

export function OPTIONS() {
  return preflight();
}
