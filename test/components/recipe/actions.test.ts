import { describe, expect, it, jest } from '@jest/globals';

import { focusMoreActionsButton } from '../../../src/components/recipe/actions';

describe('focusMoreActionsButton', () => {
  it('focuses the "More actions" button inside the container', () => {
    const focus = jest.fn();
    const querySelector = jest.fn<(selector: string) => { focus(): void }>(
      () => ({ focus }),
    );
    focusMoreActionsButton({ querySelector });
    expect(querySelector).toHaveBeenCalledWith(
      'button[aria-label="More actions"]',
    );
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the button is not there', () => {
    expect(() =>
      focusMoreActionsButton({ querySelector: () => null }),
    ).not.toThrow();
  });

  it('does nothing before the container has mounted', () => {
    expect(() => focusMoreActionsButton(null)).not.toThrow();
  });
});
