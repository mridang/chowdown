import { afterEach, describe, expect, it } from '@jest/globals';

import { ALLOWED_ORIGINS_SETTING, getEnvSafe } from '@/domain/mcp/env';

const key = Symbol.for('__cloudflare-context__');
const before: unknown = Object.getOwnPropertyDescriptor(globalThis, key)?.value;

/** Run with this as the Worker's environment, the way the runtime provides it. */
function withEnv(env: Record<string, unknown>): void {
  Reflect.set(globalThis, key, {
    env,
    ctx: { waitUntil: () => undefined },
    cf: {},
  });
}

afterEach(() => {
  Reflect.set(globalThis, key, before);
});

describe('ALLOWED_ORIGINS_SETTING', () => {
  it('is the name operators set', () => {
    expect(ALLOWED_ORIGINS_SETTING).toBe('MCP_ALLOWED_ORIGINS');
  });
});

describe('getEnvSafe', () => {
  it('reads a text setting from the environment', () => {
    withEnv({ MCP_ALLOWED_ORIGINS: 'app://x' });
    expect(getEnvSafe(ALLOWED_ORIGINS_SETTING)).toBe('app://x');
  });

  it('answers undefined for a setting that is not there or not text', () => {
    withEnv({ DB: {}, COUNT: 3 });
    expect(getEnvSafe(ALLOWED_ORIGINS_SETTING)).toBeUndefined();
    expect(getEnvSafe('COUNT')).toBeUndefined();
  });

  it('answers undefined, not an error, where there is no environment at all', () => {
    Reflect.deleteProperty(globalThis, key);
    expect(getEnvSafe(ALLOWED_ORIGINS_SETTING)).toBeUndefined();
  });
});
