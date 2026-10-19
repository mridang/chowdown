import { describe, expect, it } from '@jest/globals';

import {
  SECURITY_TXT_VALID_DAYS,
  securityTxt,
} from '../../src/lib/security-txt';
import { SECURITY_POLICY_URL, SITE_URL } from '../../src/lib/site';

describe('securityTxt', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const lines = securityTxt(now).trim().split('\n');
  const field = (name: string) =>
    lines.find((l) => l.startsWith(`${name}:`))?.slice(name.length + 2);

  it('has the one field the standard requires, a contact', () => {
    expect(field('Contact')).toMatch(/^mailto:.+@.+/);
  });

  it('expires half a year after it is made, in ISO 8601', () => {
    expect(field('Expires')).toBe('2027-04-16T00:00:00.000Z');
  });

  it('expires less than a year ahead, as RFC 9116 recommends', () => {
    const expires = new Date(field('Expires') ?? '');
    const year = 365 * 24 * 60 * 60 * 1000;
    expect(SECURITY_TXT_VALID_DAYS).toBeLessThan(365);
    expect(expires.getTime() - now.getTime()).toBeLessThan(year);
    expect(expires.getTime()).toBeGreaterThan(now.getTime());
  });

  it('names its own canonical address', () => {
    expect(field('Canonical')).toBe(
      'https://chowdown.apps.mrida.ng/.well-known/security.txt',
    );
  });

  it('points at a disclosure policy on this site, not at the privacy notice', () => {
    expect(field('Policy')).toBe(SECURITY_POLICY_URL);
    expect(field('Policy')?.startsWith(`${SITE_URL}/`)).toBe(true);
    expect(field('Policy')).not.toContain('/privacy');
  });

  it('ends with a newline', () => {
    expect(securityTxt(now).endsWith('\n')).toBe(true);
  });
});
