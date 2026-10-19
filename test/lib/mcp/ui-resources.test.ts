import { describe, expect, it } from '@jest/globals';

import {
  APP_RESOURCES,
  CARD_RESOURCE_URI,
  LIST_RESOURCE_URI,
  RESOURCE_MIME_TYPE,
} from '../../../src/lib/mcp/ui-resources';

describe('ui resources', () => {
  it('serves a card and a list, each at its own ui:// address', () => {
    expect(APP_RESOURCES.map((r) => r.uri)).toEqual([
      CARD_RESOURCE_URI,
      LIST_RESOURCE_URI,
    ]);
    expect(CARD_RESOURCE_URI).not.toBe(LIST_RESOURCE_URI);
  });

  it('ships real HTML for each view', () => {
    for (const resource of APP_RESOURCES) {
      expect(resource.html.length).toBeGreaterThan(0);
    }
  });

  it('uses the media type the MCP Apps spec requires', async () => {
    const official = await import('@modelcontextprotocol/ext-apps/server');
    expect(RESOURCE_MIME_TYPE).toBe(official.RESOURCE_MIME_TYPE);
  });
});
