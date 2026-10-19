import { describe, expect, it } from '@jest/globals';

import { SourceLine } from '../../../../../../src/app/(site)/recipe/[id]/_components/source-line';
import { html } from '../../../../../components/render';

describe('SourceLine', () => {
  it('links out to the original page, in a new tab', () => {
    const out = html(
      <SourceLine url="https://www.seriouseats.com/recipes/dal" />,
    );
    expect(out).toContain('href="https://www.seriouseats.com/recipes/dal"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('offers the other recipes saved from the same site', () => {
    const out = html(
      <SourceLine url="https://www.seriouseats.com/recipes/dal" />,
    );
    expect(out).toContain('href="/app?site=seriouseats.com"');
    expect(out).toContain('More from seriouseats.com');
  });

  it('shows a source that is not a web address as plain text', () => {
    const out = html(<SourceLine value="Grandma" />);
    expect(out).toContain('Grandma');
    expect(out).not.toContain('<a');
  });

  it('prefers the address when there is both an address and a typed source', () => {
    const out = html(
      <SourceLine value="Grandma" url="https://example.com/dal" />,
    );
    expect(out).toContain('example.com');
    expect(out).not.toContain('Grandma');
  });

  it('shows nothing when the recipe has no source', () => {
    expect(html(<SourceLine />)).toBe('');
  });
});
