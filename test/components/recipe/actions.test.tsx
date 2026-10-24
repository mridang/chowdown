import { describe, expect, it, jest } from '@jest/globals';

import {
  focusMoreActionsButton,
  MoreMenu,
  ShareButton,
  shareLink,
} from '@/components/recipe/actions';
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
    expect(out).not.toContain('Print');
  });

  it('keeps the delete question closed', () => {
    expect(out).not.toContain('Delete this recipe?');
  });

  it('offers only what is still a recipe action: nothing that is a one-off job', () => {
    expect(out).not.toContain('Auto-tag');
    expect(out).not.toContain('role="status"');
  });
});

describe('shareLink', () => {
  const link = { title: 'Dal', url: 'https://chowdown.test/recipe/dal' };

  it('uses the device’s share sheet where there is one', async () => {
    const share = jest.fn<
      (data: { title: string; url: string }) => Promise<void>
    >(async () => undefined);
    const writeText = jest.fn<(text: string) => Promise<void>>();
    await expect(
      shareLink({ share, clipboard: { writeText } }, link),
    ).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(link);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('counts a dismissed share sheet as shared: there is nothing to say', async () => {
    const share = jest.fn<() => Promise<void>>(async () => {
      throw new DOMException('Dismissed', 'AbortError');
    });
    await expect(shareLink({ share }, link)).resolves.toBe('shared');
  });

  it('copies the address when there is no share sheet', async () => {
    const writeText = jest.fn<(text: string) => Promise<void>>(
      async () => undefined,
    );
    await expect(shareLink({ clipboard: { writeText } }, link)).resolves.toBe(
      'copied',
    );
    expect(writeText).toHaveBeenCalledWith(link.url);
  });

  it('fails quietly when the clipboard refuses', async () => {
    const writeText = jest.fn<(text: string) => Promise<void>>(async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    });
    await expect(shareLink({ clipboard: { writeText } }, link)).resolves.toBe(
      'failed',
    );
  });

  it('fails quietly when there is neither a share sheet nor a clipboard', async () => {
    await expect(shareLink({}, link)).resolves.toBe('failed');
  });
});
