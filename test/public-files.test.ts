import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (name: string) =>
  readFileSync(path.join(process.cwd(), 'public', name), 'utf8');

describe('public/llms.txt', () => {
  const text = read('llms.txt');

  it('follows the llms.txt shape: a title, a summary and sections of links', () => {
    expect(text.startsWith('# chowdown\n')).toBe(true);
    expect(text).toMatch(/\n> .+/);
    expect(text).toMatch(/\n## .+/);
  });

  it('only links to addresses on this site', () => {
    const links = [...text.matchAll(/\]\((https?:[^)]+)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.startsWith('https://chowdown.apps.mrida.ng/')).toBe(true);
    }
  });

  it('names the MCP address', () => {
    expect(text).toContain('https://chowdown.apps.mrida.ng/api/mcp');
  });
});
