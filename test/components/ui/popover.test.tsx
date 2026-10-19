import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  PopoverLabel,
  PopoverSeparator,
  closeAfterClick,
} from '../../../src/components/ui/popover';
import { html } from '../render';

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
