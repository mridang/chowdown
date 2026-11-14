import { describe, expect, it } from '@jest/globals';

import {
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

  it.each([...READ_ONLY_TOOLS].map((tool) => [tool]))(
    'names only tools that exist (%s)',
    (tool) => {
      expect(toolNamed(tool ?? '')).toBeDefined();
    },
  );
});
