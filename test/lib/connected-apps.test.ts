import { describe, expect, it } from '@jest/globals';

import {
  accessLabel,
  connectedAppResource,
  mcpUrl,
} from '../../src/lib/connected-apps';

describe('mcpUrl', () => {
  it('puts the MCP path on the origin it is served from', () => {
    expect(mcpUrl('https://chowdown.example')).toBe(
      'https://chowdown.example/api/mcp',
    );
  });

  it('does not double the slash when the origin ends with one', () => {
    expect(mcpUrl('http://localhost:3737/')).toBe(
      'http://localhost:3737/api/mcp',
    );
  });
});

describe('accessLabel', () => {
  it('says an app with the write scope can edit', () => {
    expect(accessLabel(['recipes:read', 'recipes:write'])).toBe('Can edit');
  });

  it('says an app with only the read scope is read only', () => {
    expect(accessLabel(['recipes:read'])).toBe('Read only');
  });

  it('treats an app with no scopes as read only', () => {
    expect(accessLabel([])).toBe('Read only');
  });
});

describe('connectedAppResource', () => {
  const stored = {
    grantId: 'g1',
    name: 'Claude',
    scope: ['recipes:read'],
    connectedAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-02-01T00:00:00.000Z',
  };

  it('renames the members to the wire form', () => {
    expect(connectedAppResource(stored)).toEqual({
      id: 'g1',
      name: 'Claude',
      scopes: ['recipes:read'],
      connected_at: '2026-01-01T00:00:00.000Z',
      last_used_at: '2026-02-01T00:00:00.000Z',
    });
  });

  it('leaves last_used_at out for an app that was never used', () => {
    expect(
      connectedAppResource({ ...stored, lastUsedAt: null }),
    ).not.toHaveProperty('last_used_at');
  });
});
