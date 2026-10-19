import { describe, expect, it } from '@jest/globals';

import { shouldMoveFocus } from '../../../src/components/ui/use-focus-on-change';

describe('shouldMoveFocus', () => {
  it('moves focus when the step changes', () => {
    expect(shouldMoveFocus('input', 'review')).toBe(true);
  });

  it('leaves focus alone while the step stays the same', () => {
    expect(shouldMoveFocus('review', 'review')).toBe(false);
  });

  it('moves focus on first render when told nothing has been focused yet', () => {
    expect(shouldMoveFocus(null, 'input')).toBe(true);
  });

  it('never moves focus for a step that is not there', () => {
    expect(shouldMoveFocus('review', null)).toBe(false);
    expect(shouldMoveFocus(null, null)).toBe(false);
  });
});
