import { describe, expect, it } from '@jest/globals';

import { cn } from '@/components/ui/cn';

describe('cn', () => {
  it('joins class names with a space', () => {
    expect(cn('flex', 'p-1')).toBe('flex p-1');
  });

  it('skips anything falsy, so a condition can switch a class on', () => {
    const on = true as boolean;
    const off = false as boolean;
    expect(cn('flex', on && 'p-1', off && 'm-1', null, undefined, '')).toBe(
      'flex p-1',
    );
  });

  it('is empty when there is nothing to join', () => {
    expect(cn()).toBe('');
  });
});
