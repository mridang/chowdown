import { describe, expect, it } from '@jest/globals';

import { TOOLS } from '../../../src/lib/mcp/server';
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
