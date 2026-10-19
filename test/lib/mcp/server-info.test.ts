import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { SITE_URL } from '../../../src/lib/site';
import {
  CAPABILITIES,
  INSTRUCTIONS,
  SERVER_INFO,
  SERVER_INFO_META_KEY,
  SERVER_VERSION,
  UI_EXTENSION_ID,
} from '../../../src/lib/mcp/server-info';
import { TOOLS } from '../../../src/lib/mcp/tool-definitions';

const root = process.cwd();

/** The width and height written in a PNG file's header. */
function pngSize(file: string): string {
  const bytes = readFileSync(path.join(root, 'public', file));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('SERVER_VERSION', () => {
  it('is the version in package.json', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(root, 'package.json'), 'utf8'),
    ) as { version: string };
    expect(SERVER_VERSION).toBe(manifest.version);
  });
});

describe('SERVER_INFO', () => {
  it('names the server, describes it and points to its website', () => {
    expect(SERVER_INFO).toMatchObject({
      name: 'chowdown',
      title: 'chowdown',
      version: SERVER_VERSION,
      websiteUrl: 'https://chowdown.apps.mrida.ng',
    });
    expect(SERVER_INFO.description.length).toBeGreaterThan(20);
  });

  it('is keyed in results by the name the protocol reserves', () => {
    expect(SERVER_INFO_META_KEY).toBe('io.modelcontextprotocol/serverInfo');
  });

  it('lists icons that are absolute HTTPS addresses on this site, to real PNG files of the size they claim', () => {
    expect(SERVER_INFO.icons.length).toBeGreaterThan(0);
    for (const icon of SERVER_INFO.icons) {
      expect(icon.src.startsWith(`${SITE_URL}/icons/`)).toBe(true);
      expect(new URL(icon.src).protocol).toBe('https:');
      expect(icon.mimeType).toBe('image/png');
      const file = new URL(icon.src).pathname.slice(1);
      expect(icon.sizes).toEqual([pngSize(file)]);
    }
  });
});

describe('CAPABILITIES', () => {
  it('declare tools, resources, prompts and the MCP Apps extension, and nothing the server does not do', () => {
    expect(CAPABILITIES).toEqual({
      tools: {},
      resources: {},
      prompts: {},
      extensions: { 'io.modelcontextprotocol/ui': {} },
    });
    expect(UI_EXTENSION_ID).toBe('io.modelcontextprotocol/ui');
  });

  it('promise no change notifications and no subscriptions', () => {
    expect(CAPABILITIES.tools).not.toHaveProperty('listChanged');
    expect(CAPABILITIES.resources).not.toHaveProperty('listChanged');
    expect(CAPABILITIES.resources).not.toHaveProperty('subscribe');
    expect(CAPABILITIES.prompts).not.toHaveProperty('listChanged');
    for (const unsupported of ['logging', 'completions', 'tasks']) {
      expect(CAPABILITIES).not.toHaveProperty(unsupported);
    }
  });
});

describe('INSTRUCTIONS', () => {
  it('do not claim the server never fetches pages, because import_recipe and tag_recipe do', () => {
    expect(INSTRUCTIONS).not.toMatch(/never fetches/i);
    expect(INSTRUCTIONS).toMatch(/fetch that page once more/);
  });

  it('only name tools that exist', () => {
    const names = TOOLS.map((t) => t.name) as readonly string[];
    const mentioned = [...INSTRUCTIONS.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)].map(
      (m) => m[0],
    );
    expect(mentioned.length).toBeGreaterThan(5);
    for (const name of mentioned) {
      expect(names).toContain(name);
    }
  });

  it('tell the assistant where to connect Drive', () => {
    expect(INSTRUCTIONS).toContain(`${SITE_URL}/app`);
  });
});
