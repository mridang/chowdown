import { describe, expect, it } from '@jest/globals';

import { GET, OPTIONS } from '@/app/.well-known/[...path]/route';

describe('GET /.well-known/<anything else>', () => {
  const res = GET();

  it('answers 404 as JSON, not as the HTML not-found page', async () => {
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.clone().json()).toMatchObject({ error: 'not_found' });
  });

  it('can be read by a browser-based client', () => {
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('is cacheable for ten minutes so repeat probes stay cheap', () => {
    expect(res.headers.get('cache-control')).toContain('max-age=600');
  });
});

describe('OPTIONS /.well-known/<anything else>', () => {
  it('answers the CORS preflight with 204', () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain(
      'MCP-Protocol-Version',
    );
  });
});
