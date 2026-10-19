import { describe, expect, it, jest } from '@jest/globals';

import type { User } from '../../../src/lib/db/users';
import { SCENARIO_TOOLS } from '../../../src/lib/mcp/scenarios';
import { handleMcpMessage } from '../../../src/lib/mcp/server';
import { callTool } from '../../../src/lib/mcp/tool-calls';
import { TOOLS } from '../../../src/lib/mcp/tool-definitions';
import {
  SCOPE_READ,
  SCOPE_WRITE,
  scopeForTool,
} from '../../../src/lib/oauth/scopes';

describe('MCP tool scopes', () => {
  it('only lets read-only tools through with the read scope', () => {
    const readTools = TOOLS.filter(
      (t) => scopeForTool(t.name) === SCOPE_READ,
    ).map((t) => t.name);
    expect(readTools.sort()).toEqual([
      'browse_recipes',
      'find_recipes',
      'find_similar',
      'get_recipe',
      'list_filters',
      'list_recipes',
      'recipes_from_ingredients',
      'search_recipes',
    ]);
  });

  it('treats every other tool as a write, so new tools are protected by default', () => {
    const writeTools = TOOLS.filter(
      (t) => scopeForTool(t.name) === SCOPE_WRITE,
    ).map((t) => t.name);
    expect(writeTools).toEqual(
      expect.arrayContaining([
        'import_recipe',
        'add_recipe',
        'tag_recipe',
        'set_recipe_images',
        'favourite_recipe',
      ]),
    );
    expect(scopeForTool('a_tool_added_next_year')).toBe(SCOPE_WRITE);
  });
});

describe('handleMcpMessage without Google Drive', () => {
  const noDrive = { id: 1, refresh_token_enc: null } as User;

  it('tells the assistant how to fix it, as a tool error, when Drive is not connected', async () => {
    const reply = (await handleMcpMessage(noDrive, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_recipe', arguments: { recipe: 'pancakes' } },
    })) as {
      result: { isError: boolean; content: { text: string }[] };
      error?: unknown;
    };
    expect(reply.error).toBeUndefined();
    expect(reply.result.isError).toBe(true);
    expect(reply.result.content[0]!.text).toContain('Connect Google Drive');
    expect(reply.result.content[0]!.text).toContain(
      'https://chowdown.apps.mrida.ng',
    );
  });

  it('gives no reply to any notification', async () => {
    for (const method of [
      'notifications/initialized',
      'notifications/cancelled',
    ]) {
      expect(
        await handleMcpMessage(noDrive, { jsonrpc: '2.0', method }),
      ).toBeNull();
    }
  });
});

describe('handleMcpMessage routing', () => {
  const someone = { id: 1, refresh_token_enc: null } as User;
  const MODERN_META = {
    _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
  };
  const send = (message: Record<string, unknown>) =>
    handleMcpMessage(someone, { jsonrpc: '2.0', id: 1, ...message });

  it('answers the handshake with a version both sides speak', async () => {
    const reply = await send({
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    });
    expect(reply).toMatchObject({
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        serverInfo: { name: 'chowdown' },
      },
    });
  });

  it('describes itself to a client that does not handshake', async () => {
    const reply = await send({ method: 'server/discover' });
    expect(reply).toMatchObject({
      result: { resultType: 'complete', cacheScope: 'public' },
    });
  });

  it('answers ping with an empty result', async () => {
    expect(await send({ method: 'ping' })).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
  });

  it('marks results complete only for the newest revision', async () => {
    expect(await send({ method: 'ping', params: MODERN_META })).toMatchObject({
      result: { resultType: 'complete' },
    });
    expect(await send({ method: 'ping' })).not.toHaveProperty(
      'result.resultType',
    );
  });

  it('lists the tools', async () => {
    const reply = await send({ method: 'tools/list' });
    expect(reply).toMatchObject({ result: { tools: TOOLS } });
  });

  it('lists the views and serves their HTML', async () => {
    const listed = (await send({ method: 'resources/list' })) as {
      result: { resources: { uri: string; mimeType: string }[] };
    };
    expect(listed.result.resources.map((r) => r.uri)).toEqual([
      'ui://recipe/card.html',
      'ui://recipe/list.html',
    ]);
    const read = await send({
      method: 'resources/read',
      params: { uri: 'ui://recipe/card.html' },
    });
    expect(read).toMatchObject({
      result: {
        contents: [
          {
            uri: 'ui://recipe/card.html',
            mimeType: 'text/html;profile=mcp-app',
          },
        ],
      },
    });
  });

  it('refuses an unknown view', async () => {
    expect(
      await send({ method: 'resources/read', params: { uri: 'ui://nope' } }),
    ).toMatchObject({ error: { code: -32602 } });
  });

  it('refuses an unknown method', async () => {
    expect(await send({ method: 'wibble' })).toMatchObject({
      error: { code: -32601, message: 'Method not found' },
    });
  });

  it('keeps the reason for a server fault to itself', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const reply = await send({
      method: 'tools/call',
      params: { name: 'set_measurement_system', arguments: { system: 'us' } },
    });
    // No database in a test, so this fails inside; the client learns nothing of why.
    expect(reply).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'Something went wrong on the server.' },
    });
    spy.mockRestore();
  });
});

describe('the tool catalogue', () => {
  it('has a unique name for every tool', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('is fully served: no advertised tool is unknown to the dispatcher', async () => {
    const empty = {
      user: { id: 1 } as User,
      token: 'tok',
      system: undefined,
      files: {
        list: async () => [],
        read: async () => '',
        create: async (name: string) => ({ id: name, name }),
        update: async () => undefined,
        index: async () => undefined,
      },
    };
    const needsDatabase = SCENARIO_TOOLS as readonly string[];
    const unknown = (
      await Promise.all(
        TOOLS.filter((t) => !needsDatabase.includes(t.name)).map(async (t) => ({
          name: t.name,
          result: await callTool(
            empty.user,
            { name: t.name, arguments: {} },
            async () => empty,
          ),
        })),
      )
    )
      .filter(({ result }) =>
        result.content[0]?.text.startsWith('Unknown tool'),
      )
      .map(({ name }) => name);
    expect(unknown).toEqual([]);
  });

  it('describes every scenario tool', () => {
    const names = TOOLS.map((t) => t.name) as readonly string[];
    for (const scenario of SCENARIO_TOOLS) {
      expect(names).toContain(scenario);
    }
  });
});
