import { describe, expect, it } from '@jest/globals';

import {
  SCOPE_READ,
  SCOPE_WRITE,
  hasScope,
  normaliseScope,
  scopeForMessage,
  scopeForTool,
} from '@/lib/oauth/scopes';

describe('normaliseScope', () => {
  it('grants everything supported when nothing is asked for', () => {
    expect(normaliseScope(undefined)).toEqual([SCOPE_READ, SCOPE_WRITE]);
    expect(normaliseScope('  ')).toEqual([SCOPE_READ, SCOPE_WRITE]);
  });

  it('grants only what was asked for', () => {
    expect(normaliseScope('recipes:read')).toEqual([SCOPE_READ]);
  });

  it('drops unknown scopes but keeps the known ones', () => {
    expect(normaliseScope('recipes:read admin offline_access')).toEqual([
      SCOPE_READ,
    ]);
  });

  it('returns nothing when only unknown scopes are asked for', () => {
    expect(normaliseScope('admin')).toEqual([]);
    expect(normaliseScope('admin offline_access')).toEqual([]);
  });

  it('ignores offline_access: it alone is the same as asking for nothing', () => {
    expect(normaliseScope('offline_access')).toEqual([SCOPE_READ, SCOPE_WRITE]);
    expect(normaliseScope('recipes:read offline_access')).toEqual([SCOPE_READ]);
  });
});

describe('hasScope', () => {
  it('lets write cover read but not the other way round', () => {
    expect(hasScope([SCOPE_WRITE], SCOPE_READ)).toBe(true);
    expect(hasScope([SCOPE_READ], SCOPE_WRITE)).toBe(false);
  });

  it('is false with no scopes', () => {
    expect(hasScope([], SCOPE_READ)).toBe(false);
  });
});

describe('scopeForTool', () => {
  it('needs only read for viewing tools', () => {
    expect(scopeForTool('get_recipe')).toBe(SCOPE_READ);
    expect(scopeForTool('search_recipes')).toBe(SCOPE_READ);
    expect(scopeForTool('recipes_from_ingredients')).toBe(SCOPE_READ);
  });

  it('needs write for anything that changes data, including unknown tools', () => {
    expect(scopeForTool('import_recipe')).toBe(SCOPE_WRITE);
    expect(scopeForTool('not_a_known_tool')).toBe(SCOPE_WRITE);
  });
});

describe('scopeForMessage', () => {
  it('uses the tool being called', () => {
    expect(
      scopeForMessage({ method: 'tools/call', params: { name: 'get_recipe' } }),
    ).toBe(SCOPE_READ);
    expect(
      scopeForMessage({ method: 'tools/call', params: { name: 'tag_recipe' } }),
    ).toBe(SCOPE_WRITE);
  });

  it('treats a tool call with no name as a write', () => {
    expect(scopeForMessage({ method: 'tools/call', params: {} })).toBe(
      SCOPE_WRITE,
    );
  });

  it('needs only read for the handshake and listings', () => {
    expect(scopeForMessage({ method: 'initialize' })).toBe(SCOPE_READ);
    expect(scopeForMessage({ method: 'tools/list' })).toBe(SCOPE_READ);
  });
});
