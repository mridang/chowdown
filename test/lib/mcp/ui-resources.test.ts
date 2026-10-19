import { createHash } from 'node:crypto';

import { describe, expect, it } from '@jest/globals';

import {
  contentHash as cardHash,
  html as cardHtml,
} from '../../../build/views/recipe-card';
import {
  contentHash as listHash,
  html as listHtml,
} from '../../../build/views/recipe-list';
import {
  APP_RESOURCES,
  CARD_RESOURCE_URI,
  LEGACY_CARD_RESOURCE_URI,
  LEGACY_LIST_RESOURCE_URI,
  LEGACY_RESOURCE_URI_META_KEY,
  LIST_RESOURCE_URI,
  OPENAI_WIDGET_DOMAIN,
  RESOURCE_MIME_TYPE,
  VIEW_RESOURCE_META,
  buildCsp,
  buildResourceMeta,
  findAppResource,
  hashedResourceUri,
  viewToolMeta,
} from '../../../src/lib/mcp/ui-resources';
import { SITE_URL } from '../../../src/lib/site';

/** The document with its inline script removed: what the host's CSP actually has to police. */
function shellOf(html: string): string {
  return html.replace(
    /<script type="module">[\s\S]*<\/script>/,
    '<script></script>',
  );
}

describe('ui resource addresses', () => {
  it('puts a hash of the HTML in each address, so a changed view gets a new one', () => {
    expect(CARD_RESOURCE_URI).toMatch(
      /^ui:\/\/chowdown\/recipe-card-[0-9a-f]{12}\.html$/,
    );
    expect(LIST_RESOURCE_URI).toMatch(
      /^ui:\/\/chowdown\/recipe-list-[0-9a-f]{12}\.html$/,
    );
    expect(CARD_RESOURCE_URI).toContain(cardHash.slice(0, 12));
    expect(LIST_RESOURCE_URI).toContain(listHash.slice(0, 12));
  });

  it('derives the hash from the generated HTML itself', () => {
    expect(cardHash).toBe(createHash('sha256').update(cardHtml).digest('hex'));
    expect(listHash).toBe(createHash('sha256').update(listHtml).digest('hex'));
  });

  it('hashedResourceUri is stable for one hash and differs for another', () => {
    const a = 'a'.repeat(64);
    const b = `b${'a'.repeat(63)}`;
    expect(hashedResourceUri('recipe-card', a)).toBe(
      hashedResourceUri('recipe-card', a),
    );
    expect(hashedResourceUri('recipe-card', a)).not.toBe(
      hashedResourceUri('recipe-card', b),
    );
    expect(hashedResourceUri('recipe-card', a)).toBe(
      'ui://chowdown/recipe-card-aaaaaaaaaaaa.html',
    );
  });

  it('still knows the old, hash-free addresses', () => {
    expect(LEGACY_CARD_RESOURCE_URI).toBe('ui://recipe/card.html');
    expect(LEGACY_LIST_RESOURCE_URI).toBe('ui://recipe/list.html');
  });
});

describe('ui resources served', () => {
  it('serves each view at its hashed address and at its legacy one', () => {
    expect(APP_RESOURCES.map((r) => r.uri)).toEqual([
      CARD_RESOURCE_URI,
      LEGACY_CARD_RESOURCE_URI,
      LIST_RESOURCE_URI,
      LEGACY_LIST_RESOURCE_URI,
    ]);
    expect(new Set(APP_RESOURCES.map((r) => r.uri)).size).toBe(4);
  });

  it('flags only the hash-free addresses as legacy', () => {
    expect(APP_RESOURCES.filter((r) => r.legacy).map((r) => r.uri)).toEqual([
      LEGACY_CARD_RESOURCE_URI,
      LEGACY_LIST_RESOURCE_URI,
    ]);
  });

  it('serves the same HTML at the old and the new address', () => {
    expect(findAppResource(LEGACY_CARD_RESOURCE_URI)?.html).toBe(
      findAppResource(CARD_RESOURCE_URI)?.html,
    );
    expect(findAppResource(LEGACY_LIST_RESOURCE_URI)?.html).toBe(
      findAppResource(LIST_RESOURCE_URI)?.html,
    );
    expect(findAppResource(CARD_RESOURCE_URI)?.html).not.toBe(
      findAppResource(LIST_RESOURCE_URI)?.html,
    );
  });

  it('finds nothing at any other address', () => {
    expect(findAppResource('ui://nope')).toBeUndefined();
  });

  it('serves the current card to an older hashed address, under the address asked for', () => {
    const stale = 'ui://chowdown/recipe-card-000000000000.html';
    const resource = findAppResource(stale);
    expect(resource?.uri).toBe(stale);
    expect(resource?.html).toBe(cardHtml);
    expect(resource?.meta).toBe(VIEW_RESOURCE_META);
  });

  it('serves the current list to an older hashed address of the list', () => {
    const stale = 'ui://chowdown/recipe-list-abcdef012345.html';
    const resource = findAppResource(stale);
    expect(resource?.uri).toBe(stale);
    expect(resource?.html).toBe(listHtml);
  });

  it('refuses addresses that only look like a hashed view address', () => {
    for (const uri of [
      'ui://chowdown/other-aaaaaaaaaaaa.html',
      'ui://chowdown/recipe-card-aaaaaaaaaaa.html',
      'ui://chowdown/recipe-card-aaaaaaaaaaaaa.html',
      'ui://chowdown/recipe-card-AAAAAAAAAAAA.html',
      'ui://chowdown/recipe-card-000000000000.htmlx',
      'ui://other/recipe-card-000000000000.html',
      'ui://chowdown/recipe-card-000000000000.html/../x',
    ]) {
      expect(findAppResource(uri)).toBeUndefined();
    }
  });

  it('marks only the current hashed addresses as immutable, so only they are cached for long', () => {
    expect(findAppResource(CARD_RESOURCE_URI)?.immutable).toBe(true);
    expect(findAppResource(LIST_RESOURCE_URI)?.immutable).toBe(true);
    expect(findAppResource(LEGACY_CARD_RESOURCE_URI)?.immutable).toBe(false);
    expect(
      findAppResource('ui://chowdown/recipe-card-000000000000.html')?.immutable,
    ).toBe(false);
  });

  it('does not list a stale address among the resources', () => {
    const stale = findAppResource(
      'ui://chowdown/recipe-card-000000000000.html',
    );
    expect(stale?.legacy).toBe(true);
    expect(APP_RESOURCES.map((r) => r.uri)).not.toContain(stale?.uri);
  });

  it('ships a real HTML5 document for each view', () => {
    for (const resource of APP_RESOURCES) {
      expect(resource.html).toMatch(/^<!doctype html>/);
      expect(resource.html).toContain('<meta charset="utf-8">');
      expect(resource.html).toContain(
        '<meta name="color-scheme" content="light dark">',
      );
      expect(resource.html).toMatch(/<title>[^<]+<\/title>/);
      expect(resource.html).toContain('<div id="root">');
    }
  });

  it('uses the media type the MCP Apps spec requires', async () => {
    const official = await import('@modelcontextprotocol/ext-apps/server');
    expect(RESOURCE_MIME_TYPE).toBe(official.RESOURCE_MIME_TYPE);
  });

  it('uses the same legacy metadata key as the official SDK', async () => {
    const official = await import('@modelcontextprotocol/ext-apps/server');
    expect(LEGACY_RESOURCE_URI_META_KEY).toBe(official.RESOURCE_URI_META_KEY);
  });

  it('keeps the bundle small enough to fetch on a phone', () => {
    for (const resource of APP_RESOURCES) {
      expect(resource.html.length).toBeLessThan(600 * 1024);
    }
  });
});

describe('viewToolMeta', () => {
  it('links a tool to its view in the standard, legacy and ChatGPT forms', () => {
    expect(viewToolMeta(CARD_RESOURCE_URI)).toEqual({
      ui: { resourceUri: CARD_RESOURCE_URI },
      'ui/resourceUri': CARD_RESOURCE_URI,
      'openai/outputTemplate': CARD_RESOURCE_URI,
    });
  });
});

describe('Content-Security-Policy', () => {
  it('declares nothing by default, with the lists hosts expect', () => {
    expect(buildCsp()).toEqual({
      ui: { connectDomains: [], resourceDomains: [] },
      openai: { connect_domains: [], resource_domains: [] },
    });
  });

  it('carries the origins it is given in both forms', () => {
    const csp = buildCsp({
      connect: ['https://api.example.com'],
      resource: ['https://cdn.example.com'],
      frame: ['https://player.example.com'],
      baseUri: ['https://cdn.example.com'],
    });
    expect(csp.ui).toEqual({
      connectDomains: ['https://api.example.com'],
      resourceDomains: ['https://cdn.example.com'],
      frameDomains: ['https://player.example.com'],
      baseUriDomains: ['https://cdn.example.com'],
    });
    expect(csp.openai).toEqual({
      connect_domains: ['https://api.example.com'],
      resource_domains: ['https://cdn.example.com'],
      frame_domains: ['https://player.example.com'],
    });
  });

  it('omits empty frame and base-URI lists rather than declaring them empty', () => {
    const { ui, openai } = buildCsp({ connect: ['https://a.example'] });
    expect(ui).not.toHaveProperty('frameDomains');
    expect(ui).not.toHaveProperty('baseUriDomains');
    expect(openai).not.toHaveProperty('frame_domains');
  });

  it('is true: the views load nothing from the network', () => {
    for (const { html } of [{ html: cardHtml }, { html: listHtml }]) {
      const shell = shellOf(html);
      expect(shell).not.toMatch(/<link\b/);
      expect(shell).not.toMatch(/<img\b/);
      expect(shell).not.toMatch(/<iframe\b/);
      expect(shell).not.toMatch(/\b(src|href)=/);
      expect(shell).not.toContain('@import');
      expect(html).not.toMatch(/\bfetch\(/);
      expect(html).not.toContain('XMLHttpRequest');
      expect(html).not.toMatch(/new WebSocket\b/);
      expect(html).not.toMatch(/new EventSource\b/);
    }
  });

  it('works under the default policy, which forbids eval', () => {
    for (const html of [cardHtml, listHtml]) {
      expect(html).not.toMatch(/\beval\(/);
      expect(html).not.toContain('new Function(');
    }
  });
});

describe('view resource metadata', () => {
  it('has no standard ui.domain: Claude rejects the view for any value but its own hash form', () => {
    expect(VIEW_RESOURCE_META.ui).not.toHaveProperty('domain');
    expect(buildResourceMeta().ui).not.toHaveProperty('domain');
  });

  it('uses the site’s own address as the widget domain, not a copy of it', () => {
    expect(OPENAI_WIDGET_DOMAIN).toBe(SITE_URL);
  });

  it('keeps ChatGPT’s own widget domain, as an https origin', () => {
    expect(VIEW_RESOURCE_META['openai/widgetDomain']).toBe(
      OPENAI_WIDGET_DOMAIN,
    );
    expect(new URL(OPENAI_WIDGET_DOMAIN).origin).toBe(OPENAI_WIDGET_DOMAIN);
  });

  it('declares an empty policy in the standard and the ChatGPT form', () => {
    expect(VIEW_RESOURCE_META.ui.csp).toEqual({
      connectDomains: [],
      resourceDomains: [],
    });
    expect(VIEW_RESOURCE_META['openai/widgetCSP']).toEqual({
      connect_domains: [],
      resource_domains: [],
    });
  });

  it('tells ChatGPT which display modes the views support', () => {
    expect(VIEW_RESOURCE_META['openai/ui'].availableDisplayModes).toEqual([
      'inline',
      'fullscreen',
    ]);
  });

  it('asks the host for no border, because the views draw their own card', () => {
    expect(VIEW_RESOURCE_META.ui.prefersBorder).toBe(false);
    expect(VIEW_RESOURCE_META['openai/widgetPrefersBorder']).toBe(false);
  });

  it('gives ChatGPT a description so the model does not repeat the view', () => {
    expect(VIEW_RESOURCE_META['openai/widgetDescription']).not.toBe('');
  });

  it('puts the same metadata on every served resource', () => {
    for (const resource of APP_RESOURCES) {
      expect(resource.meta).toBe(VIEW_RESOURCE_META);
    }
  });
});
