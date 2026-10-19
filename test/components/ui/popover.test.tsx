import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  Popover,
  PopoverLabel,
  PopoverSeparator,
  PopoverStatus,
  closeAfterClick,
  escapeHandler,
  focusLeft,
  isOpenOn,
} from '../../../src/components/ui/popover';
import { html, htmlAt } from '../render';

describe('closeAfterClick', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not close while the click is still being handled', () => {
    const close = jest.fn();
    closeAfterClick(close);
    // Still inside the click: the menu item must still be there to receive it.
    expect(close).not.toHaveBeenCalled();
  });

  it('closes as soon as the click has been handled', () => {
    const close = jest.fn();
    closeAfterClick(close);
    jest.runAllTimers();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('PopoverSeparator', () => {
  it('is a thin rule that assistive technology knows is a separator', () => {
    const out = html(<PopoverSeparator />);
    expect(out).toContain('role="separator"');
    expect(out).toContain('h-px');
  });
});

describe('PopoverLabel', () => {
  it('shows a small caption over the value, and keeps a long value to one line', () => {
    const out = html(
      <PopoverLabel caption="Signed in as">ada@example.com</PopoverLabel>,
    );
    expect(out.indexOf('Signed in as')).toBeLessThan(
      out.indexOf('ada@example.com'),
    );
    expect(out).toContain('truncate');
  });
});

describe('Popover', () => {
  const out = html(
    <Popover label="Menu" button="Open">
      <a href="/x">Inside</a>
    </Popover>,
  );

  it('is a button that says the panel is closed, named for what it opens', () => {
    expect(out).toMatch(/<button[^>]*aria-label="Menu"[^>]*>Open<\/button>/);
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('data-state="closed"');
  });

  it('keeps the panel out of the page until it is opened', () => {
    expect(out).not.toContain('Inside');
    expect(out).not.toContain('aria-controls');
  });
});

describe('focusLeft', () => {
  // Stand-ins for DOM nodes: all `focusLeft` asks of them is identity.
  const inside = { id: 'inside' } as unknown as Node;
  const outside = { id: 'outside' } as unknown as Node;
  const root = { contains: (node: Node | null) => node === inside };

  it('is true when focus moves to something outside the popover', () => {
    expect(focusLeft(root, outside)).toBe(true);
  });

  it('is false while focus stays within it (button to item, item to item)', () => {
    expect(focusLeft(root, inside)).toBe(false);
  });

  it('is false when focus goes nowhere, such as the window losing focus', () => {
    expect(focusLeft(root, null)).toBe(false);
  });
});

describe('isOpenOn', () => {
  it('is open on the page it was opened on', () => {
    expect(isOpenOn({ pathname: '/app' }, '/app')).toBe(true);
  });

  it('is closed once the page has changed', () => {
    expect(isOpenOn({ pathname: '/app' }, '/connect')).toBe(false);
  });

  it('is closed when it was never opened', () => {
    expect(isOpenOn(null, '/app')).toBe(false);
  });
});

describe('PopoverStatus', () => {
  it('is plain text that is announced politely, not a button', () => {
    const out = html(<PopoverStatus>Google Drive connected</PopoverStatus>);
    expect(out).toMatch(/^<p role="status"[^>]*>Google Drive connected<\/p>$/);
    expect(out).not.toContain('<button');
    expect(out).not.toContain('disabled');
  });
});

describe('Popover inside the app', () => {
  it('renders closed on any page', () => {
    const out = htmlAt(
      <Popover label="Menu" button="Open">
        <a href="/x">Inside</a>
      </Popover>,
      { pathname: '/app' },
    );
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain('Inside');
  });
});

describe('escapeHandler', () => {
  it('closes the panel and puts focus back on the button for Escape', () => {
    const close = jest.fn();
    const focusButton = jest.fn();
    escapeHandler(close, focusButton)({ key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    expect(focusButton).toHaveBeenCalledTimes(1);
  });

  it('leaves every other key to whatever has focus', () => {
    const close = jest.fn();
    const focusButton = jest.fn();
    escapeHandler(close, focusButton)({ key: 'ArrowDown' });
    escapeHandler(close, focusButton)({ key: 'Tab' });
    expect(close).not.toHaveBeenCalled();
    expect(focusButton).not.toHaveBeenCalled();
  });
});
