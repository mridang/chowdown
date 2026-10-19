import { describe, expect, it } from '@jest/globals';

import {
  GPC_LAST_UPDATE,
  MCP_URL,
  PRIVACY_LAST_UPDATED,
  SECURITY_POLICY_URL,
  SITE_URL,
} from '../../src/lib/site';

describe('MCP_URL', () => {
  it('is the MCP endpoint of the site itself', () => {
    expect(MCP_URL).toBe(`${SITE_URL}/api/mcp`);
  });
});

describe('SECURITY_POLICY_URL', () => {
  it('is an https address on this site', () => {
    expect(SECURITY_POLICY_URL).toBe(`${SITE_URL}/security-policy.txt`);
  });
});

describe('date constants', () => {
  it.each([PRIVACY_LAST_UPDATED, GPC_LAST_UPDATE])(
    '%s is a valid ISO calendar date',
    (date) => {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(
        date,
      );
    },
  );
});
