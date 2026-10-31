import { describe, expect, it } from '@jest/globals';

import {
  ARGUMENT_ALIASES,
  LISTS_OF_TEXT,
  READ_ONLY_TOOLS,
  SCOPE_READ,
  SCOPE_TEXT,
  SCOPE_WRITE,
} from '@/domain/mcp/app';
import { toolNamed } from '@/domain/mcp/tool-definitions';

describe('the connector settings', () => {
  it('name two different scopes and describe both', () => {
    expect(SCOPE_READ).not.toBe(SCOPE_WRITE);
    expect(SCOPE_TEXT[SCOPE_READ]).toBeTruthy();
    expect(SCOPE_TEXT[SCOPE_WRITE]).toBeTruthy();
  });

  it.each([
    ...[...READ_ONLY_TOOLS].map((tool) => ['read-only', tool]),
    ...Object.keys(ARGUMENT_ALIASES).map((tool) => ['aliased', tool]),
    ...Object.keys(LISTS_OF_TEXT).map((tool) => ['list-taking', tool]),
  ])('name only tools that exist (%s %s)', (_kind, tool) => {
    expect(toolNamed(tool ?? '')).toBeDefined();
  });
});
