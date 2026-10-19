import { describe, expect, it, jest } from '@jest/globals';

import type { User } from '../../../src/lib/db/users';
import { SCENARIO_TOOLS } from '../../../src/lib/mcp/scenarios';
import {
  CACHE_HINTS,
  handleMcpMessage,
  readCache,
  isAdvertisedTool,
  type JsonRpcResponse,
  type ToolRunner,
} from '../../../src/lib/mcp/server';
import { callTool } from '../../../src/lib/mcp/tool-calls';
import {
  InvalidToolArguments,
  UnknownTool,
} from '../../../src/lib/mcp/tool-errors';
import {
  CAPABILITIES,
  INSTRUCTIONS,
  SERVER_INFO,
} from '../../../src/lib/mcp/server-info';
import { textResult } from '../../../src/lib/mcp/tool-results';
import { APP_RESOURCES } from '../../../src/lib/mcp/ui-resources';
import { TOOLS } from '../../../src/lib/mcp/tool-definitions';
import {
  SCOPE_READ,
  SCOPE_WRITE,
  scopeForTool,
} from '../../../src/lib/oauth/scopes';

/** The address of a view the server serves. */
const FIRST_VIEW = APP_RESOURCES.at(0)?.uri ?? '';

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
      params: { name: 'get_recipe', arguments: { name: 'pancakes' } },
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
    expect(
      await send({ method: 'tools/list', params: MODERN_META }),
    ).toMatchObject({
      result: { resultType: 'complete' },
    });
    expect(await send({ method: 'ping' })).not.toHaveProperty(
      'result.resultType',
    );
  });

  it.each(['initialize', 'ping'])(
    'answers %s for the older revisions, and says it was removed to the newest',
    async (method) => {
      expect(await send({ method })).toMatchObject({ result: {} });
      expect(await send({ method, params: MODERN_META })).toMatchObject({
        error: { code: -32601 },
      });
    },
  );

  it('lists the tools', async () => {
    const reply = await send({ method: 'tools/list' });
    expect(reply).toMatchObject({ result: { tools: TOOLS } });
  });

  it('lists the views and serves their HTML', async () => {
    const listed = (await send({ method: 'resources/list' })) as {
      result: { resources: { uri: string; mimeType: string }[] };
    };
    expect(listed.result.resources.map((r) => r.uri)).toEqual(
      APP_RESOURCES.filter((r) => !r.legacy).map((r) => r.uri),
    );
    const [first] = APP_RESOURCES;
    const read = await send({
      method: 'resources/read',
      params: { uri: first?.uri },
    });
    expect(read).toMatchObject({
      result: {
        contents: [
          {
            uri: first?.uri,
            mimeType: 'text/html;profile=mcp-app',
          },
        ],
      },
    });
  });

  it('serves the older view addresses without listing them', async () => {
    const legacy = APP_RESOURCES.filter((r) => r.legacy);
    expect(legacy.length).toBeGreaterThan(0);
    for (const view of legacy) {
      expect(
        await send({ method: 'resources/read', params: { uri: view.uri } }),
      ).toMatchObject({ result: { contents: [{ uri: view.uri }] } });
    }
  });

  it('lists the template a single recipe is read at', async () => {
    expect(await send({ method: 'resources/templates/list' })).toMatchObject({
      result: {
        resourceTemplates: [{ uriTemplate: 'recipe://{id}' }],
      },
    });
  });

  it('lists the prompts and returns one with its arguments filled in', async () => {
    const listed = (await send({ method: 'prompts/list' })) as {
      result: { prompts: { name: string }[] };
    };
    expect(listed.result.prompts.map((p) => p.name)).toEqual([
      'what-should-i-cook',
      'use-up-ingredients',
      'plan-the-week',
    ]);
    expect(
      await send({
        method: 'prompts/get',
        params: {
          name: 'use-up-ingredients',
          arguments: { ingredients: 'eggs' },
        },
      }),
    ).toMatchObject({
      result: { messages: [{ role: 'user', content: { type: 'text' } }] },
    });
  });

  it('refuses an unknown prompt and a missing required argument as bad parameters', async () => {
    expect(
      await send({ method: 'prompts/get', params: { name: 'nope' } }),
    ).toMatchObject({ error: { code: -32602 } });
    expect(
      await send({
        method: 'prompts/get',
        params: { name: 'use-up-ingredients' },
      }),
    ).toMatchObject({ error: { code: -32602 } });
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
    const reply = await handleMcpMessage(
      someone,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_recipes', arguments: {} },
      },
      async () => {
        throw new Error('the database said something private');
      },
    );
    // The client learns nothing of why.
    expect(reply).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'Something went wrong on the server.' },
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
    // Empty arguments may well be refused as invalid; what must never happen is
    // that the dispatcher does not know the tool.
    const isUnknown = async (name: string): Promise<boolean> => {
      try {
        const result = await callTool(
          empty.user,
          { name, arguments: {} },
          async () => empty,
        );
        return result.content[0]?.text.startsWith('Unknown tool') ?? false;
      } catch (error) {
        return error instanceof UnknownTool;
      }
    };
    const candidates = TOOLS.filter((t) => !needsDatabase.includes(t.name));
    const unknown = (
      await Promise.all(
        candidates.map(async (t) => ((await isUnknown(t.name)) ? t.name : '')),
      )
    ).filter(Boolean);
    expect(unknown).toEqual([]);
  });

  it('describes every scenario tool', () => {
    const names = TOOLS.map((t) => t.name) as readonly string[];
    for (const scenario of SCENARIO_TOOLS) {
      expect(names).toContain(scenario);
    }
  });
});

describe('handleMcpMessage — the newest revision', () => {
  const someone = { id: 1, refresh_token_enc: null } as User;
  const MODERN = {
    _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  };
  const SERVER_INFO_KEY = 'io.modelcontextprotocol/serverInfo';
  const send = (
    message: Record<string, unknown>,
    runTool?: ToolRunner,
  ): Promise<JsonRpcResponse | null> =>
    handleMcpMessage(someone, { jsonrpc: '2.0', id: 1, ...message }, runTool);
  const resultOf = async (
    message: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const reply = await send(message);
    if (!reply || !('result' in reply)) {
      throw new Error(`expected a result, got ${JSON.stringify(reply)}`);
    }
    return reply.result as Record<string, unknown>;
  };

  it.each([
    ['tools/list', undefined, CACHE_HINTS.list],
    ['resources/list', undefined, CACHE_HINTS.list],
    ['resources/read', { uri: FIRST_VIEW }, CACHE_HINTS.read],
    ['server/discover', undefined, CACHE_HINTS.discover],
  ])(
    'tells the client how long it may keep %s',
    async (method, params, hint) => {
      const result = await resultOf({
        method,
        params: { ...params, ...MODERN },
      });
      expect(result['ttlMs']).toBe(hint.ttlMs);
      expect(result['cacheScope']).toBe(hint.cacheScope);
      expect(result['resultType']).toBe('complete');
    },
  );

  it('gives every cache hint a non-negative lifetime and a scope the spec knows', () => {
    for (const hint of Object.values(CACHE_HINTS)) {
      expect(Number.isInteger(hint.ttlMs)).toBe(true);
      expect(hint.ttlMs).toBeGreaterThanOrEqual(0);
      expect(['public', 'private']).toContain(hint.cacheScope);
    }
  });

  it('keeps the large view cached longer than the lists, and shares them all (nothing here is per user)', () => {
    expect(CACHE_HINTS.read.ttlMs).toBeGreaterThan(CACHE_HINTS.list.ttlMs);
    const { recipe, ...everyoneHints } = CACHE_HINTS;
    for (const hint of Object.values(everyoneHints)) {
      expect(hint.cacheScope).toBe('public');
    }
    expect(recipe.cacheScope).toBe('private');
  });

  it('caches a view for everyone, and puts the cache hints on the lists the newest revision adds', async () => {
    for (const method of ['prompts/list', 'resources/templates/list']) {
      expect(await resultOf({ method, params: MODERN })).toMatchObject(
        CACHE_HINTS.list,
      );
    }
    expect(
      await resultOf({
        method: 'resources/read',
        params: { uri: FIRST_VIEW, ...MODERN },
      }),
    ).toMatchObject(CACHE_HINTS.read);
  });

  it('lets only the person who read a recipe reuse it, and a view be shared', () => {
    expect(readCache({ contents: [{ uri: 'recipe://abc', text: 'x' }] })).toBe(
      CACHE_HINTS.recipe,
    );
    expect(readCache({ contents: [{ uri: FIRST_VIEW, text: 'x' }] })).toBe(
      CACHE_HINTS.read,
    );
    expect(readCache({})).toBe(CACHE_HINTS.read);
  });

  it('puts no cache hints on a prompt', async () => {
    const result = await resultOf({
      method: 'prompts/get',
      params: { name: 'what-should-i-cook', ...MODERN },
    });
    expect(result).not.toHaveProperty('ttlMs');
  });

  it('puts no cache hints on results that are not cacheable', async () => {
    for (const message of [
      { method: 'ping' },
      {
        method: 'tools/call',
        params: { name: 'list_recipes', arguments: {}, ...MODERN },
      },
    ]) {
      const reply = await send(message, async () => textResult('ok'));
      const result = (reply as { result: Record<string, unknown> }).result;
      expect(result).not.toHaveProperty('ttlMs');
      expect(result).not.toHaveProperty('cacheScope');
    }
  });

  it('puts no cache hints on an error', async () => {
    const reply = await send({
      method: 'resources/read',
      params: { uri: 'ui://nope', ...MODERN },
    });
    expect(reply).not.toHaveProperty('result');
    expect(JSON.stringify(reply)).not.toContain('ttlMs');
  });

  it('names the server in the _meta of every result', async () => {
    for (const message of [
      { method: 'prompts/list', params: MODERN },
      { method: 'tools/list', params: MODERN },
      { method: 'resources/list', params: MODERN },
      { method: 'server/discover', params: MODERN },
    ]) {
      const result = await resultOf(message);
      expect(result['_meta']).toMatchObject({ [SERVER_INFO_KEY]: SERVER_INFO });
    }
  });

  it('adds the server to a result’s own _meta instead of replacing it', async () => {
    const withMeta: ToolRunner = async () => ({
      ...textResult('ok'),
      _meta: { 'openai/outputTemplate': 'ui://x' },
    });
    const reply = await send(
      {
        method: 'tools/call',
        params: { name: 'list_recipes', ...MODERN },
      },
      withMeta,
    );
    expect((reply as { result: { _meta: unknown } }).result._meta).toEqual({
      'openai/outputTemplate': 'ui://x',
      [SERVER_INFO_KEY]: SERVER_INFO,
    });
  });

  it('answers discovery the same with or without per-request metadata', async () => {
    const bare = await resultOf({ method: 'server/discover' });
    const full = await resultOf({ method: 'server/discover', params: MODERN });
    expect(bare).toEqual(full);
    expect(full).toMatchObject({
      supportedVersions: expect.arrayContaining(['2026-07-28', '2025-11-25']),
      capabilities: CAPABILITIES,
      instructions: INSTRUCTIONS,
    });
  });

  it('leaves a result for an older client exactly as the method made it', async () => {
    for (const method of ['tools/list', 'resources/list']) {
      const result = await resultOf({ method });
      expect(Object.keys(result)).toHaveLength(1);
    }
    const read = await resultOf({
      method: 'resources/read',
      params: { uri: FIRST_VIEW },
    });
    expect(Object.keys(read)).toEqual(['contents']);
  });

  it('does not treat an older version named in _meta as the newest era', async () => {
    const result = await resultOf({
      method: 'tools/list',
      params: {
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2025-11-25' },
      },
    });
    expect(result).not.toHaveProperty('ttlMs');
    expect(result).not.toHaveProperty('resultType');
  });
});

describe('handleMcpMessage — what the server says about itself', () => {
  const someone = { id: 1, refresh_token_enc: null } as User;
  const result = async (message: Record<string, unknown>) =>
    (
      (await handleMcpMessage(someone, {
        jsonrpc: '2.0',
        id: 1,
        ...message,
      })) as { result: Record<string, unknown> }
    ).result;

  it('answers the older handshake with the full identity, the capabilities and the instructions', async () => {
    expect(
      await result({
        method: 'initialize',
        params: { protocolVersion: '2025-11-25' },
      }),
    ).toEqual({
      protocolVersion: '2025-11-25',
      capabilities: CAPABILITIES,
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    });
  });

  it('declares the MCP Apps extension in the handshake and in discovery, and no more than it does', async () => {
    const handshake = await result({ method: 'initialize' });
    const discovery = await result({ method: 'server/discover' });
    for (const reply of [handshake, discovery]) {
      expect(reply['capabilities']).toEqual({
        tools: {},
        resources: {},
        prompts: {},
        extensions: { 'io.modelcontextprotocol/ui': {} },
      });
    }
  });
});

describe('handleMcpMessage — refusals', () => {
  const someone = { id: 1, refresh_token_enc: null } as User;
  const neverRun: ToolRunner = async () => {
    throw new Error('the tool must not run');
  };
  const send = (
    message: Record<string, unknown>,
    runTool: ToolRunner = neverRun,
  ) =>
    handleMcpMessage(
      someone,
      { jsonrpc: '2.0', id: 'q1', ...message },
      runTool,
    );

  it('echoes the request id on every error', async () => {
    for (const message of [
      { method: 'nope' },
      { method: 'resources/read', params: { uri: 'ui://nope' } },
      { method: 'tools/call', params: { name: 'nope' } },
    ]) {
      expect(await send(message)).toMatchObject({ id: 'q1' });
    }
  });

  it('answers a tool that is not advertised with -32602 and the tool names, without running anything', async () => {
    const reply = await send({
      method: 'tools/call',
      params: { name: 'wibble', arguments: {} },
    });
    expect(reply).toMatchObject({ error: { code: -32602 } });
    const message = (reply as { error: { message: string } }).error.message;
    expect(message).toContain('Unknown tool: wibble');
    expect(message).toContain('list_recipes');
  });

  it('answers a missing or non-text tool name the same way', async () => {
    for (const params of [{}, { name: 7 }, { name: null }, undefined]) {
      expect(await send({ method: 'tools/call', params })).toMatchObject({
        error: { code: -32602 },
      });
    }
  });

  it('answers arguments that are not an object with -32602, before running anything', async () => {
    for (const args of ['x', 5, [], null]) {
      const reply = await send({
        method: 'tools/call',
        params: { name: 'list_recipes', arguments: args },
      });
      expect(reply).toMatchObject({ error: { code: -32602 } });
    }
  });

  it('runs a tool that is advertised, whatever its arguments are', async () => {
    const ran: unknown[] = [];
    const reply = await send(
      {
        method: 'tools/call',
        params: { name: 'list_recipes', arguments: { limit: 3 } },
      },
      async (_user, params) => {
        ran.push(params);
        return textResult('done');
      },
    );
    expect(reply).toMatchObject({ result: { content: [{ text: 'done' }] } });
    expect(ran).toEqual([{ name: 'list_recipes', arguments: { limit: 3 } }]);
  });

  it('maps an unknown tool reported by the tool code to -32602', async () => {
    const reply = await send(
      { method: 'tools/call', params: { name: 'list_recipes' } },
      async () => {
        throw new UnknownTool('ghost');
      },
    );
    expect(reply).toMatchObject({
      id: 'q1',
      error: { code: -32602, message: expect.stringContaining('ghost') },
    });
  });

  it('maps invalid arguments reported by the tool code to -32602, with what to fix', async () => {
    const reply = await send(
      { method: 'tools/call', params: { name: 'get_recipe' } },
      async () => {
        throw new InvalidToolArguments([
          'Missing "name".',
          '"limit" must be a number.',
        ]);
      },
    );
    expect(reply).toEqual({
      jsonrpc: '2.0',
      id: 'q1',
      error: {
        code: -32602,
        message:
          'Invalid arguments for tool get_recipe: Missing "name". "limit" must be a number.',
        data: {
          tool: 'get_recipe',
          problems: ['Missing "name".', '"limit" must be a number.'],
        },
      },
    });
  });

  it('answers any other fault with -32603 and no detail', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const reply = await send(
      { method: 'tools/call', params: { name: 'list_recipes' } },
      async () => {
        throw new Error('Google said: secret');
      },
    );
    expect(reply).toEqual({
      jsonrpc: '2.0',
      id: 'q1',
      error: { code: -32603, message: 'Something went wrong on the server.' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('tells a view that is not there from a request with no address, and says which', async () => {
    expect(
      await send({ method: 'resources/read', params: { uri: 'ui://nope' } }),
    ).toEqual({
      jsonrpc: '2.0',
      id: 'q1',
      error: {
        code: -32602,
        message: 'Resource not found',
        data: { uri: 'ui://nope' },
      },
    });
    for (const params of [{}, { uri: 5 }, { uri: null }, undefined]) {
      expect(await send({ method: 'resources/read', params })).toMatchObject({
        error: { code: -32602, message: expect.stringContaining('`uri`') },
      });
    }
  });

  it('does not take the names of things every object has for methods', async () => {
    for (const method of [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
    ]) {
      expect(await send({ method })).toMatchObject({
        error: { code: -32601 },
      });
    }
  });
});

describe('isAdvertisedTool', () => {
  it('is true for the tools in the catalogue and nothing else', () => {
    for (const tool of TOOLS) {
      expect(isAdvertisedTool(tool.name)).toBe(true);
    }
    for (const other of ['nope', '', 'LIST_RECIPES', 5, null, undefined]) {
      expect(isAdvertisedTool(other)).toBe(false);
    }
  });
});
