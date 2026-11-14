import { describe, expect, it } from '@jest/globals';

import { SCOPE_READ, SCOPE_TEXT, SCOPE_WRITE } from '@/domain/mcp/app';

describe('the connector settings', () => {
  it('name two different scopes and describe both', () => {
    expect(SCOPE_READ).not.toBe(SCOPE_WRITE);
    expect(SCOPE_TEXT[SCOPE_READ]).toBeTruthy();
    expect(SCOPE_TEXT[SCOPE_WRITE]).toBeTruthy();
  });
});
