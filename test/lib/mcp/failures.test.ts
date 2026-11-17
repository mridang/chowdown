import { describe, expect, it } from '@jest/globals';

import { NoExplanations } from '@/lib/mcp';

describe('NoExplanations', () => {
  it.each([new Error('x'), undefined, 'a string', { a: 1 }])(
    'recognises nothing, so every failure is handled further up (%j)',
    (failure) => {
      const explainer = new NoExplanations();
      expect(explainer.explain(failure)).toBeUndefined();
    },
  );
});
