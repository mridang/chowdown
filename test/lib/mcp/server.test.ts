import { describe, expect, it } from '@jest/globals';

import type { User } from '../../../src/lib/db/users';
import { TOOLS, handleMcpMessage } from '../../../src/lib/mcp/server';
import {
  SCOPE_READ,
  SCOPE_WRITE,
  scopeForTool,
} from '../../../src/lib/oauth/scopes';

describe('MCP tool scopes', () => {
  it('only lets read-only tools through with the read scope', () => {
    const readTools = TOOLS.filter(
      (t) => scopeForTool(t.name) === SCOPE_READ,
    ).map((t) => t.name);
    expect(readTools.sort()).toEqual([
      'browse_recipes',
      'find_recipes',
      'find_similar',
      'get_recipe',
      'list_filters',
      'list_recipes',
      'recipes_from_ingredients',
      'search_recipes',
    ]);
  });

  it('treats every other tool as a write, so new tools are protected by default', () => {
    const writeTools = TOOLS.filter(
      (t) => scopeForTool(t.name) === SCOPE_WRITE,
    ).map((t) => t.name);
    expect(writeTools).toEqual(
      expect.arrayContaining([
        'import_recipe',
        'add_recipe',
        'tag_recipe',
        'set_recipe_images',
        'favourite_recipe',
      ]),
    );
    expect(scopeForTool('a_tool_added_next_year')).toBe(SCOPE_WRITE);
  });
});

describe('handleMcpMessage without Google Drive', () => {
  const noDrive = { id: 1, refresh_token_enc: null } as User;

  it('tells the assistant how to fix it, as a tool error, when Drive is not connected', async () => {
    const reply = (await handleMcpMessage(noDrive, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_recipe', arguments: { recipe: 'pancakes' } },
    })) as {
      result: { isError: boolean; content: { text: string }[] };
      error?: unknown;
    };
    expect(reply.error).toBeUndefined();
    expect(reply.result.isError).toBe(true);
    expect(reply.result.content[0]!.text).toContain('Connect Google Drive');
    expect(reply.result.content[0]!.text).toContain(
      'https://chowdown.apps.mrida.ng',
    );
  });

  it('gives no reply to any notification', async () => {
    for (const method of [
      'notifications/initialized',
      'notifications/cancelled',
    ]) {
      expect(
        await handleMcpMessage(noDrive, { jsonrpc: '2.0', method }),
      ).toBeNull();
    }
  });
});
