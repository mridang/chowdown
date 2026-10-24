import { describe, expect, it } from '@jest/globals';

import {
  accessLabel,
  connectedAppResource,
  mcpUrl,
} from '@/domain/connected-apps';

describe('mcpUrl', () => {
  it('puts the MCP path on the origin it is served from', () => {
    expect(mcpUrl('https://chowdown.example')).toBe(
      'https://chowdown.example/mcp',
    );
  });

  it('does not double the slash when the origin ends with one', () => {
    expect(mcpUrl('http://localhost:3737/')).toBe('http://localhost:3737/mcp');
  });
});

describe('accessLabel', () => {
  it('says an app with the write scope can edit', () => {
    expect(accessLabel(['recipes:read', 'recipes:write'])).toBe('Can edit');
  });

  it('says an app with only the read scope is read only', () => {
    expect(accessLabel(['recipes:read'])).toBe('Read only');
  });

  it('says how many installs there are when there is more than one', () => {
    expect(accessLabel(['recipes:write'], 2)).toBe('Can edit (2 installs)');
    expect(accessLabel(['recipes:read'], 3)).toBe('Read only (3 installs)');
    expect(accessLabel(['recipes:write'], 1)).toBe('Can edit');
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
    installs: 1,
    domain: 'claude.ai',
    connectedAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-02-01T00:00:00.000Z',
  };

  it('renames the members to the wire form', () => {
    expect(connectedAppResource(stored)).toEqual({
      id: 'g1',
      name: 'Claude',
      scopes: ['recipes:read'],
      installs: 1,
      domain: 'claude.ai',
      connected_at: '2026-01-01T00:00:00.000Z',
      last_used_at: '2026-02-01T00:00:00.000Z',
    });
  });

  it('leaves domain out for an unverified app', () => {
    expect(
      connectedAppResource({ ...stored, domain: null }),
    ).not.toHaveProperty('domain');
  });

  it('leaves last_used_at out for an app that was never used', () => {
    expect(
      connectedAppResource({ ...stored, lastUsedAt: null }),
    ).not.toHaveProperty('last_used_at');
  });
});
