import { describe, expect, it } from '@jest/globals';

import {
  ERROR_HEADER_MISMATCH,
  ERROR_UNSUPPORTED_VERSION,
  MODERN_VERSION,
  SUPPORTED_VERSIONS,
  checkRequestHeaders,
  declaredVersion,
  decodeHeaderValue,
  isAllowedOrigin,
  isModernRequest,
  negotiateLegacyVersion,
} from '../../../src/lib/mcp/protocol';

const META = 'io.modelcontextprotocol/protocolVersion';
const modern = (method: string, params: Record<string, unknown> = {}) => ({
  jsonrpc: '2.0' as const,
  id: 1,
  method,
  params: { ...params, _meta: { [META]: MODERN_VERSION } },
});
const headers = (h: Record<string, string>) => new Headers(h);
const good = { 'mcp-protocol-version': MODERN_VERSION };

describe('negotiateLegacyVersion', () => {
  it('answers with the version the client asked for when we speak it', () => {
    expect(negotiateLegacyVersion('2025-06-18')).toBe('2025-06-18');
    expect(negotiateLegacyVersion('2024-11-05')).toBe('2024-11-05');
  });

  it('answers with our newest older version otherwise', () => {
    expect(negotiateLegacyVersion('1999-01-01')).toBe('2025-11-25');
    expect(negotiateLegacyVersion(undefined)).toBe('2025-11-25');
    expect(negotiateLegacyVersion(42)).toBe('2025-11-25');
  });

  it('does not hand out the newest revision, which has no handshake', () => {
    expect(negotiateLegacyVersion(MODERN_VERSION)).toBe('2025-11-25');
  });
});

describe('declaredVersion / isModernRequest', () => {
  it('reads the version a request carries in its _meta', () => {
    expect(declaredVersion(modern('tools/list'))).toBe(MODERN_VERSION);
    expect(isModernRequest(modern('tools/list'))).toBe(true);
  });

  it('treats a request without one as an older request', () => {
    expect(isModernRequest({ method: 'initialize', params: {} })).toBe(false);
    expect(isModernRequest({ method: 'ping' })).toBe(false);
  });
});

describe('checkRequestHeaders', () => {
  it('accepts an older request with no protocol headers at all', () => {
    expect(
      checkRequestHeaders(headers({}), { method: 'tools/list', id: 1 }),
    ).toBeNull();
  });

  it('accepts an older request that names a version we speak', () => {
    expect(
      checkRequestHeaders(headers({ 'mcp-protocol-version': '2025-06-18' }), {
        method: 'tools/list',
      }),
    ).toBeNull();
  });

  it('refuses a version header we do not speak, listing the ones we do', () => {
    const refusal = checkRequestHeaders(
      headers({ 'mcp-protocol-version': '1999-01-01' }),
      { method: 'tools/list' },
    )!;
    expect(refusal.status).toBe(400);
    expect(refusal.body.error.code).toBe(ERROR_UNSUPPORTED_VERSION);
    expect(refusal.body.error.data).toEqual({
      supported: SUPPORTED_VERSIONS,
      requested: '1999-01-01',
    });
  });

  it('refuses a body version we do not speak', () => {
    const message = modern('tools/list');
    message.params._meta[META] = '2099-01-01' as typeof MODERN_VERSION;
    expect(
      checkRequestHeaders(
        headers({ 'mcp-protocol-version': '2099-01-01' }),
        message,
      )!.body.error.code,
    ).toBe(ERROR_UNSUPPORTED_VERSION);
  });

  it('accepts a newest-era request whose headers match its body', () => {
    expect(
      checkRequestHeaders(
        headers({ ...good, 'mcp-method': 'tools/list' }),
        modern('tools/list'),
      ),
    ).toBeNull();
  });

  it.each([
    ['no version header', {}, 'tools/list'],
    [
      'a version header that differs from the body',
      { 'mcp-protocol-version': '2025-11-25', 'mcp-method': 'tools/list' },
      'tools/list',
    ],
    ['no method header', good, 'tools/list'],
    [
      'a method header that differs from the body',
      { ...good, 'mcp-method': 'ping' },
      'tools/list',
    ],
  ])('refuses a newest-era request with %s', (_name, h, method) => {
    const refusal = checkRequestHeaders(headers(h), modern(method))!;
    expect(refusal.status).toBe(400);
    expect(refusal.body.error.code).toBe(ERROR_HEADER_MISMATCH);
  });

  it('requires Mcp-Name to match the tool or resource a call names', () => {
    const call = modern('tools/call', { name: 'get_recipe' });
    const base = { ...good, 'mcp-method': 'tools/call' };
    expect(
      checkRequestHeaders(headers({ ...base, 'mcp-name': 'get_recipe' }), call),
    ).toBeNull();
    expect(
      checkRequestHeaders(headers({ ...base, 'mcp-name': 'other' }), call)!
        .status,
    ).toBe(400);
    expect(checkRequestHeaders(headers(base), call)!.status).toBe(400);
    const read = modern('resources/read', { uri: 'ui://x' });
    expect(
      checkRequestHeaders(
        headers({
          ...good,
          'mcp-method': 'resources/read',
          'mcp-name': 'ui://x',
        }),
        read,
      ),
    ).toBeNull();
  });

  it('decodes a base64 Mcp-Name before comparing', () => {
    const name = 'crème brûlée';
    const encoded = `=?base64?${Buffer.from(name).toString('base64')}?=`;
    expect(
      checkRequestHeaders(
        headers({ ...good, 'mcp-method': 'tools/call', 'mcp-name': encoded }),
        modern('tools/call', { name }),
      ),
    ).toBeNull();
  });
});

describe('decodeHeaderValue', () => {
  it('passes plain values through and decodes the base64 form', () => {
    expect(decodeHeaderValue('plain')).toBe('plain');
    expect(decodeHeaderValue('=?base64?SGk=?=')).toBe('Hi');
    expect(decodeHeaderValue(null)).toBeUndefined();
    expect(decodeHeaderValue('=?base64?!!!?=')).toBeUndefined();
  });
});

describe('isAllowedOrigin', () => {
  const self = 'https://chowdown.apps.mrida.ng';

  it('lets through a request with no Origin and our own origin', () => {
    expect(isAllowedOrigin(null, self)).toBe(true);
    expect(isAllowedOrigin(self, self)).toBe(true);
  });

  it('lets through the assistants’ web apps and local tools', () => {
    for (const origin of [
      'https://claude.ai',
      'https://www.claude.ai',
      'https://chatgpt.com',
      'https://chat.openai.com',
      'http://localhost:6274',
      'http://127.0.0.1:3000',
    ]) {
      expect(isAllowedOrigin(origin, self)).toBe(true);
    }
  });

  it('turns away everything else, including look-alikes', () => {
    for (const origin of [
      'https://evil.example',
      'https://claude.ai.evil.example',
      'https://notclaude.ai',
      'http://claude.ai',
      'https://claude.ai/path',
      'null',
      'not a url',
    ]) {
      expect(isAllowedOrigin(origin, self)).toBe(false);
    }
  });

  it('can be extended from the environment', () => {
    expect(
      isAllowedOrigin(
        'https://tool.example',
        self,
        'https://tool.example, https://b.example',
      ),
    ).toBe(true);
    expect(
      isAllowedOrigin('https://other.example', self, 'https://tool.example'),
    ).toBe(false);
  });
});
