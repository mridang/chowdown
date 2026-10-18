import { describe, expect, it } from '@jest/globals';

import { securityTxt } from '../../src/lib/security-txt';

describe('securityTxt', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const lines = securityTxt(now).trim().split('\n');
  const field = (name: string) =>
    lines.find((l) => l.startsWith(`${name}:`))?.slice(name.length + 2);

  it('has the one field the standard requires, a contact', () => {
    expect(field('Contact')).toMatch(/^mailto:.+@.+/);
  });

  it('expires a year after it is made, in ISO 8601', () => {
    expect(field('Expires')).toBe('2027-10-18T00:00:00.000Z');
  });

  it('names its own canonical address', () => {
    expect(field('Canonical')).toBe(
      'https://chowdown.apps.mrida.ng/.well-known/security.txt',
    );
  });

  it('ends with a newline', () => {
    expect(securityTxt(now).endsWith('\n')).toBe(true);
  });
});
