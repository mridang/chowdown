import { describe, expect, it } from '@jest/globals';

import {
  ClockIcon,
  GoogleIcon,
  HeartIcon,
  PlayIcon,
} from '../../src/components/icons';
import { classOf, html } from './render';

describe('icons', () => {
  it('follow the text around them unless given a size', () => {
    const out = html(<ClockIcon />);
    expect(out).toContain('width="1em"');
    expect(out).not.toContain('class=');
  });

  it('take a standard size instead of hand-written classes', () => {
    expect(classOf(html(<ClockIcon size="sm" />), 'svg')).toBe('h-4 w-4');
    expect(classOf(html(<ClockIcon size="md" />), 'svg')).toBe('h-5 w-5');
    expect(classOf(html(<ClockIcon size="lg" />), 'svg')).toBe('h-6 w-6');
    expect(classOf(html(<ClockIcon size="xs" />), 'svg')).toBe('h-3 w-3');
    expect(classOf(html(<ClockIcon size="menu" />), 'svg')).toBe(
      'h-[18px] w-[18px]',
    );
  });

  it('add any further classes after the size', () => {
    expect(
      classOf(html(<ClockIcon size="sm" className="text-subtle" />), 'svg'),
    ).toBe('h-4 w-4 text-subtle');
  });

  it('are hidden from assistive technology, and the Google one honours sizes too', () => {
    expect(html(<HeartIcon />)).toContain('aria-hidden="true"');
    expect(classOf(html(<GoogleIcon size="md" />), 'svg')).toBe('h-5 w-5');
  });

  it('has a filled play triangle that takes the same sizes', () => {
    const out = html(<PlayIcon size="sm" />);
    expect(classOf(out, 'svg')).toBe('h-4 w-4');
    expect(out).toContain('fill="currentColor"');
    expect(out).toContain('stroke="none"');
  });
});
