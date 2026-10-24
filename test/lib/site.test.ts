import { describe, expect, it } from '@jest/globals';

import {
  GPC_LAST_UPDATE,
  MCP_URL,
  PRIVACY_LAST_UPDATED,
  SECURITY_POLICY_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from '@/lib/site';

describe('site identity', () => {
  it('gives the site an https address with no trailing slash', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
  });

  it('names the site in its address', () => {
    expect(new URL(SITE_URL).hostname.startsWith(`${SITE_NAME}.`)).toBe(true);
  });

  it('gives the site a default title and description', () => {
    expect(SITE_TITLE).not.toBe('');
    expect(SITE_DESCRIPTION).not.toBe('');
  });
});

describe('MCP_URL', () => {
  it('is the MCP endpoint of the site itself', () => {
    expect(MCP_URL).toBe(`${SITE_URL}/mcp`);
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
