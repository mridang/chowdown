import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET } from '../../../../src/app/api/health/route';
import { openWorld, type World } from '../world';

let world: World | undefined;

beforeEach(() => {
  world = openWorld();
});

afterEach(async () => {
  await world?.close();
});

describe('GET /api/health', () => {
  it('answers 200 with ok, the database binding and a timestamp', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; db: boolean; ts: string };
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(new Date(body.ts).toISOString()).toBe(body.ts);
  });

  it('is never cached', () => {
    expect(GET().headers.get('cache-control')).toBe('no-store');
  });

  it('reports the database as missing outside a Worker, without failing', async () => {
    await world?.close();
    world = undefined;
    const res = GET();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { db: boolean }).db).toBe(false);
  });
});
