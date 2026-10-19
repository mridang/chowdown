import { describe, expect, it } from '@jest/globals';

import { DELETE, GET, OPTIONS, POST } from '../../../../src/app/api/mcp/route';

const URL = 'https://chowdown.test/api/mcp';
const OTHER = 'https://evil.example';

const request = (
  method: string,
  headers: Record<string, string> = {},
  body?: string,
) => new Request(URL, { method, headers, body });

describe('OPTIONS /api/mcp', () => {
  it('answers a preflight from an allowed origin with 204 and echoes the origin', () => {
    const res = OPTIONS(request('OPTIONS', { origin: 'https://claude.ai' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://claude.ai',
    );
    expect(res.headers.get('access-control-allow-headers')).toContain(
      'MCP-Protocol-Version',
    );
    expect(res.headers.get('access-control-allow-methods')).toContain('DELETE');
  });

  it('refuses a preflight from an origin we do not know', async () => {
    const res = OPTIONS(request('OPTIONS', { origin: OTHER }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: number } }).error.code).toBe(
      -32600,
    );
  });
});

describe('without a token', () => {
  it.each([
    ['POST', POST],
    ['GET', GET],
    ['DELETE', DELETE],
  ])('answers %s with the 401 that starts sign-in', async (method, handler) => {
    const res = await handler(request(method));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain(
      'resource_metadata="https://chowdown.test/.well-known/oauth-protected-resource/api/mcp"',
    );
    expect(await res.json()).toMatchObject({
      id: null,
      error: { code: -32600 },
    });
  });

  it('turns away an unknown origin before it asks for a token', async () => {
    const res = await POST(request('POST', { origin: OTHER }, '{}'));
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toBeNull();
  });
});
