import { describe, expect, it } from '@jest/globals';

import { PageHeader } from '../../../src/components/ui/page-header';
import { html } from '../render';

describe('PageHeader', () => {
  it('has the page’s one h1, with the eyebrow above it', () => {
    const out = html(<PageHeader eyebrow="Your collection" title="Recipes" />);
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out.indexOf('Your collection')).toBeLessThan(out.indexOf('Recipes'));
  });

  it('shows the introduction, the action and the extra content when given', () => {
    const out = html(
      <PageHeader
        title="Cook with AI"
        intro="Connect an assistant."
        actions={<a href="/add">Add</a>}
      >
        <input aria-label="Address" />
      </PageHeader>,
    );
    expect(out).toContain('Connect an assistant.');
    expect(out).toContain('href="/add"');
    expect(out).toContain('aria-label="Address"');
  });

  it('leaves out what it is not given', () => {
    const out = html(<PageHeader title="Recipes" />);
    expect(out).not.toContain('<p');
  });

  it('can be roomier for an introductory page', () => {
    expect(html(<PageHeader title="x" roomy />)).toContain('py-10');
    expect(html(<PageHeader title="x" />)).toContain('py-8');
  });
});
