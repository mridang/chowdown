import { describe, expect, it } from '@jest/globals';

import { Skeleton, SkeletonFrame } from '@/components/ui/skeleton';
import { classOf, html } from '../render';

describe('Skeleton', () => {
  it('is a grey bar, or a lighter block', () => {
    expect(classOf(html(<Skeleton className="h-4 w-32" />), 'div')).toContain(
      'bg-ink/10',
    );
    expect(
      classOf(html(<Skeleton tone="block" className="h-64" />), 'div'),
    ).toContain('bg-ink/5');
  });
});

describe('Skeleton shapes', () => {
  it('softens the corners by default, and can be square or round', () => {
    expect(classOf(html(<Skeleton />), 'div')).toContain('rounded-control');
    expect(classOf(html(<Skeleton shape="square" />), 'div')).not.toContain(
      'rounded',
    );
    expect(classOf(html(<Skeleton shape="circle" />), 'div')).toContain(
      'rounded-full',
    );
  });
});

describe('SkeletonFrame', () => {
  it('announces the label it is given, instead of just "Loading"', () => {
    expect(
      html(<SkeletonFrame label="Loading your recipes">x</SkeletonFrame>),
    ).toContain('Loading your recipes');
  });

  it('tells assistive technology the page is loading', () => {
    const out = html(<SkeletonFrame>shapes</SkeletonFrame>);
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('sr-only');
    expect(out).toContain('Loading');
  });

  it('pulses, unless the person wants less motion', () => {
    const cls = classOf(html(<SkeletonFrame>x</SkeletonFrame>), 'div');
    expect(cls).toContain('animate-pulse');
    expect(cls).toContain('motion-reduce:animate-none');
  });
});
