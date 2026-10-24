import { describe, expect, it } from '@jest/globals';

import { GET } from '@/app/.well-known/gpc.json/route';
import { GPC_LAST_UPDATE } from '@/utils/site';

describe('GET /.well-known/gpc.json', () => {
  const res = GET();

  it('says Global Privacy Control is honoured, and since when', async () => {
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.clone().json()).toEqual({
      gpc: true,
      lastUpdate: GPC_LAST_UPDATE,
    });
  });

  it('can be read by any site, and cached for a day', () => {
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
  });
});
