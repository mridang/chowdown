import { describe, expect, it, jest } from '@jest/globals';

import {
  focusMoreActionsButton,
  MoreMenu,
  ShareButton,
  wasTagged,
} from '../../../src/components/recipe/actions';
import { htmlAt } from '../render';

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

describe('ShareButton', () => {
  it('is a button named "Share" before anything is copied', () => {
    const out = htmlAt(<ShareButton title="Dal" />);
    expect(out).toMatch(/<button[^>]*>.*Share<\/button>/s);
    expect(out).not.toContain('Link copied');
  });

  it('announces its change of label politely', () => {
    expect(htmlAt(<ShareButton title="Dal" />)).toContain('aria-live="polite"');
  });
});

describe('MoreMenu', () => {
  const out = htmlAt(<MoreMenu recipeId="dal" title="Dal" />);

  it('is one button named "More actions", which says the menu is closed', () => {
    expect(out).toContain('aria-label="More actions"');
    expect(out).toContain('aria-expanded="false"');
  });

  it('keeps the actions out of the page until the menu is opened', () => {
    expect(out).not.toContain('Auto-tag');
    expect(out).not.toContain('Print');
  });

  it('keeps the delete question closed', () => {
    expect(out).not.toContain('Delete this recipe?');
  });

  it('has a status line for progress and failures, empty to begin with', () => {
    expect(out).toMatch(/<p role="status"[^>]*><\/p>/);
  });
});

describe('wasTagged', () => {
  it('is true only for { tagged: true }', () => {
    expect(wasTagged({ tagged: true })).toBe(true);
    expect(wasTagged({ tagged: false })).toBe(false);
  });

  it('is false for anything else the network might hand back', () => {
    expect(wasTagged(null)).toBe(false);
    expect(wasTagged('tagged')).toBe(false);
    expect(wasTagged({})).toBe(false);
    expect(wasTagged({ tagged: 'yes' })).toBe(false);
  });
});
