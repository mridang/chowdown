import { afterEach, describe, expect, it } from '@jest/globals';

import { getOpenAi, globalsFromEvent } from '../../src/views/openai-bridge';

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'openai');
});

describe('getOpenAi', () => {
  it('finds nothing outside ChatGPT', () => {
    expect(getOpenAi()).toBeUndefined();
  });

  it('finds ChatGPT’s bridge when it is there', () => {
    const bridge = { displayMode: 'inline' };
    Reflect.set(globalThis, 'openai', bridge);
    expect(getOpenAi()).toBe(bridge);
  });

  it('ignores a global of the wrong kind', () => {
    Reflect.set(globalThis, 'openai', 'nope');
    expect(getOpenAi()).toBeUndefined();
  });
});

describe('globalsFromEvent', () => {
  it('reads the globals an openai:set_globals event carries', () => {
    const event = new CustomEvent('openai:set_globals', {
      detail: { globals: { displayMode: 'fullscreen' } },
    });
    expect(globalsFromEvent(event)).toEqual({ displayMode: 'fullscreen' });
  });

  it('reads nothing from other events or odd details', () => {
    expect(globalsFromEvent(new Event('click'))).toBeUndefined();
    expect(
      globalsFromEvent(new CustomEvent('x', { detail: 'text' })),
    ).toBeUndefined();
    expect(
      globalsFromEvent(new CustomEvent('x', { detail: { globals: 5 } })),
    ).toBeUndefined();
  });
});
