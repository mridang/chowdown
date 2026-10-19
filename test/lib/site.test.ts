import { describe, expect, it } from '@jest/globals';

import { MCP_URL, SITE_URL } from '../../src/lib/site';

describe('MCP_URL', () => {
  it('is the MCP endpoint of the site itself', () => {
    expect(MCP_URL).toBe(`${SITE_URL}/api/mcp`);
  });
});
