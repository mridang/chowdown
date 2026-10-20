import { describe, expect, it } from '@jest/globals';

import extraHandlers from '../../src/lib/worker-extras';

describe('extraHandlers', () => {
  it('adds no handler to the Worker besides fetch', () => {
    expect(extraHandlers).toEqual({});
  });
});
