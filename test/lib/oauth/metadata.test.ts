import { describe, expect, it } from '@jest/globals';

import {
  authorizationServerMetadata,
  isOurResource,
  protectedResourceMetadata,
  resourceUri,
  wwwAuthenticate,
} from '../../../src/lib/oauth/metadata';

const ORIGIN = 'https://chowdown.example';

describe('resource and issuer', () => {
  it('names the MCP endpoint as the resource', () => {
    expect(resourceUri(ORIGIN)).toBe(`${ORIGIN}/api/mcp`);
  });

  it('accepts the resource with or without a trailing slash, nothing else', () => {
    expect(isOurResource(`${ORIGIN}/api/mcp`, ORIGIN)).toBe(true);
    expect(isOurResource(`${ORIGIN}/api/mcp/`, ORIGIN)).toBe(true);
    expect(isOurResource(`${ORIGIN}/api/other`, ORIGIN)).toBe(false);
    expect(isOurResource('https://evil.example/api/mcp', ORIGIN)).toBe(false);
  });
});

describe('protectedResourceMetadata', () => {
  it('points at this origin as its own authorization server', () => {
    const doc = protectedResourceMetadata(ORIGIN);
    expect(doc.resource).toBe(`${ORIGIN}/api/mcp`);
    expect(doc.authorization_servers).toEqual([ORIGIN]);
    expect(doc.bearer_methods_supported).toEqual(['header']);
  });
});

describe('authorizationServerMetadata', () => {
  const doc = authorizationServerMetadata(ORIGIN);

  it('advertises every endpoint on this origin', () => {
    expect(doc.issuer).toBe(ORIGIN);
    expect(doc.authorization_endpoint).toBe(`${ORIGIN}/oauth/authorize`);
    expect(doc.token_endpoint).toBe(`${ORIGIN}/oauth/token`);
    expect(doc.registration_endpoint).toBe(`${ORIGIN}/oauth/register`);
    expect(doc.revocation_endpoint).toBe(`${ORIGIN}/oauth/revoke`);
  });

  it('requires PKCE S256 and supports public clients only', () => {
    expect(doc.code_challenge_methods_supported).toEqual(['S256']);
    expect(doc.token_endpoint_auth_methods_supported).toEqual(['none']);
  });

  it('supports metadata-document clients and the iss parameter', () => {
    expect(doc.client_id_metadata_document_supported).toBe(true);
    expect(doc.authorization_response_iss_parameter_supported).toBe(true);
  });
});

describe('wwwAuthenticate', () => {
  it('points an unauthenticated client at the metadata and asks for all scopes', () => {
    const header = wwwAuthenticate(ORIGIN);
    expect(header).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp"`,
    );
    expect(header).toContain('scope="recipes:read recipes:write"');
    expect(header.startsWith('Bearer ')).toBe(true);
  });

  it('reports an error and the scope an operation needs', () => {
    const header = wwwAuthenticate(ORIGIN, {
      error: 'insufficient_scope',
      scope: 'recipes:write',
    });
    expect(header).toContain('error="insufficient_scope"');
    expect(header).toContain('scope="recipes:write"');
  });
});
