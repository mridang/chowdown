import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { closeAfterClick } from '../../../src/components/ui/popover';

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
