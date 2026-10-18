import { describe, expect, it } from '@jest/globals';

import {
  accessLabel,
  mcpUrl,
  secretMcpUrl,
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

describe('secretMcpUrl', () => {
  it('appends the private token to the MCP address', () => {
    expect(secretMcpUrl('https://chowdown.example', 'abc123')).toBe(
      'https://chowdown.example/api/mcp/abc123',
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
