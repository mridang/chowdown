import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/** What the mocked parts of the app answer. */
const app = {
  bound: true,
  health: { ok: true, details: {} as Record<string, unknown> },
};

// eslint-disable-next-line tslop/no-module-mocking -- @/lib/core/runtime is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/lib/core/runtime', () => ({
  isDatabaseBound: () => app.bound,
}));

// eslint-disable-next-line tslop/no-module-mocking -- @/lib/core/health is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/lib/core/health', () => ({
  appHealth: async () => app.health,
}));

const { GET } = await import('@/app/health/route');

beforeEach(() => {
  app.bound = true;
  app.health = { ok: true, details: {} };
});

describe('GET /health', () => {
  it('answers 200 with ok, the database binding and a timestamp', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; db: boolean; ts: string }>();
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(new Date(body.ts).toISOString()).toBe(body.ts);
  });

  it('is never cached', async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('reports the database as missing, without failing', async () => {
    app.bound = false;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json<{ db: boolean }>()).toHaveProperty('db', false);
  });

  it('adds what the app reports about itself to the body', async () => {
    app.health = { ok: true, details: { movies: 3 } };
    const res = await GET();
    expect(await res.json<{ movies: number }>()).toHaveProperty('movies', 3);
  });

  it('answers 503 when the app says it is not healthy', async () => {
    app.health = { ok: false, details: { stale: true } };
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json<{ ok: boolean; stale: boolean }>();
    expect(body).toMatchObject({ ok: false, stale: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
