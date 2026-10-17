/**
 * @packageDocumentation
 *
 * The documents that let an assistant discover how to sign in, and the
 * `WWW-Authenticate` challenge that points it at them:
 *
 *  - protected resource metadata (RFC 9728): "this MCP server's authorization
 *    server is over here";
 *  - authorization server metadata (RFC 8414): the endpoints and what they
 *    support.
 *
 * chowdown is both the resource server and its own authorization server, so
 * both documents describe the same origin.
 */

import { SUPPORTED_SCOPES } from './scopes';

/** Path of the OAuth-protected MCP endpoint. */
export const MCP_PATH = '/api/mcp';

/** Well-known path of the protected resource metadata for the MCP endpoint. */
export const RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`;

/** The canonical URI of the MCP server: the `resource` in tokens and requests. */
export function resourceUri(origin: string): string {
  return `${origin}${MCP_PATH}`;
}

/** The authorization server's issuer identifier. */
export function issuerOf(origin: string): string {
  return origin;
}

/**
 * Whether a client-supplied `resource` names this MCP server. Trailing slashes
 * are tolerated, since the spec's own examples vary on them.
 */
export function isOurResource(value: string, origin: string): boolean {
  const strip = (s: string) => s.replace(/\/+$/, '');
  return strip(value) === strip(resourceUri(origin));
}

/** RFC 9728 document for the MCP endpoint. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: resourceUri(origin),
    authorization_servers: [issuerOf(origin)],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'chowdown recipes',
  };
}

/** RFC 8414 document for the authorization server. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: issuerOf(origin),
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    scopes_supported: SUPPORTED_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

/**
 * The `WWW-Authenticate` value for a 401/403 from the MCP endpoint. It carries
 * the metadata URL (so a client with no token knows where to start) and the
 * scopes needed.
 */
export function wwwAuthenticate(
  origin: string,
  options: { error?: string; description?: string; scope?: string } = {},
): string {
  const parts = [`resource_metadata="${origin}${RESOURCE_METADATA_PATH}"`];
  if (options.error) {
    parts.unshift(`error="${options.error}"`);
  }
  if (options.description) {
    parts.push(`error_description="${options.description}"`);
  }
  parts.push(`scope="${options.scope ?? SUPPORTED_SCOPES.join(' ')}"`);
  return `Bearer ${parts.join(', ')}`;
}
