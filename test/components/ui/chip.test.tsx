import { describe, expect, it } from '@jest/globals';

import { CountBadge, FilterChip, Tag } from '@/components/ui/chip';
import { html } from '../render';

describe('FilterChip', () => {
  const out = html(<FilterChip href="/app?q=x">Easy</FilterChip>);

  it('is a link to the page without that filter', () => {
    expect(out).toContain('href="/app?q=x"');
    expect(out).toContain('Easy');
  });

  it('says what following it does, to people who cannot see the cross', () => {
    expect(out).toMatch(/<span class="sr-only">Remove filter<\/span>/);
  });
});

describe('CountBadge', () => {
  it('shows the count', () => {
    expect(html(<CountBadge>3</CountBadge>)).toMatch(/>3<\/span>$/);
  });

  it('takes extra layout classes from the caller', () => {
    expect(html(<CountBadge className="ml-2">3</CountBadge>)).toContain('ml-2');
  });
});

describe('Tag', () => {
  it('is a link to the recipes that carry the tag', () => {
    const out = html(<Tag href="/app?tag=soup">soup</Tag>);
    expect(out).toContain('href="/app?tag=soup"');
    expect(out).toContain('soup');
  });
});
