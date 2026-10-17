/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414): the endpoints an
 * assistant uses to register, ask for access and get tokens.
 */

import { noStoreJson, preflight } from '@/lib/oauth/http';
import { authorizationServerMetadata } from '@/lib/oauth/metadata';
import { appOrigin } from '@/lib/util';

export async function GET(request: Request) {
  return noStoreJson(authorizationServerMetadata(appOrigin(request)));
}

export function OPTIONS() {
  return preflight();
}
