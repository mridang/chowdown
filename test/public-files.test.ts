import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SECURITY_CONTACT, SITE_URL } from '../src/lib/site';

const read = (name: string) =>
  readFileSync(path.join(process.cwd(), 'public', name), 'utf8');

/** Plain-text files are served without a charset, so they must be ASCII. */
const NON_ASCII = /[\u0080-\uffff]/;

describe('public/llms.txt', () => {
  const text = read('llms.txt');
  /** The part before `## Optional`: what an assistant should read first. */
  const main = text.split('\n## Optional')[0] ?? '';

  it('follows the llms.txt shape: a title, a summary and sections of links', () => {
    expect(text.startsWith('# chowdown\n')).toBe(true);
    expect(text).toMatch(/\n> .+/);
    expect(text).toMatch(/\n## .+/);
  });

  it('links only to this site, outside the Optional section', () => {
    const links = [...main.matchAll(/\]\((https?:[^)]+)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });

  it('puts the Cooklang spec under Optional, where outside links belong', () => {
    expect(text.split('\n## Optional')[1]).toContain('https://cooklang.org/');
  });

  it('names the MCP address and does not hand-list tools that may change', () => {
    expect(text).toContain(`${SITE_URL}/api/mcp`);
    expect(text).not.toMatch(/\b[a-z]+(_[a-z]+)+\b/);
  });

  it('is ASCII, since it is served with no charset', () => {
    expect(text).not.toMatch(NON_ASCII);
  });
});

describe('public/security-policy.txt', () => {
  const text = read('security-policy.txt');

  it('says where to report, with the same contact security.txt gives', () => {
    expect(text).toContain(SECURITY_CONTACT.replace('mailto:', ''));
  });

  it('says what to expect, what is in scope and that good faith is safe', () => {
    expect(text).toMatch(/What to expect/);
    expect(text).toMatch(/In scope/);
    expect(text).toMatch(/Out of scope/);
    expect(text).toMatch(/good faith/);
  });

  it('is ASCII, since it is served with no charset', () => {
    expect(text).not.toMatch(NON_ASCII);
  });
});

describe('public/_headers', () => {
  const file = read('_headers');

  it('caches the security policy for a day and lets other sites fetch it', () => {
    const block = file.split('\n/security-policy.txt\n')[1] ?? '';
    expect(block).toContain('Cache-Control: public, max-age=86400');
    expect(block).toContain('Cross-Origin-Resource-Policy: cross-origin');
  });
});
