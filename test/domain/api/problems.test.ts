import { describe, expect, it } from '@jest/globals';

import { driveNotConnected, upstream } from '@/domain/api/problems';

describe('driveNotConnected', () => {
  it('is a 409 that tells the client to connect Drive', async () => {
    const res = driveNotConnected();
    expect(res.status).toBe(409);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toBe('/problems/drive-not-connected');
    expect(body.detail).toContain('Connect your Google Drive');
  });
});

describe('upstream', () => {
  it('is a 502 carrying the given detail', async () => {
    const res = upstream('drive down');
    expect(res.status).toBe(502);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toBe('/problems/upstream-failure');
    expect(body.detail).toBe('drive down');
  });
});
