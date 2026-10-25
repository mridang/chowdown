import { describe, expect, it } from '@jest/globals';

import { Breadcrumb } from '@/components/ui/breadcrumb';
import { html } from '../render';

describe('Breadcrumb', () => {
  it('is a labelled navigation landmark', () => {
    expect(
      html(<Breadcrumb crumbs={[{ label: 'Recipes', href: '/app' }]} />),
    ).toContain('aria-label="Breadcrumb"');
  });

  it('links each step and separates them with a hidden slash', () => {
    const out = html(
      <Breadcrumb
        crumbs={[
          { label: 'Recipes', href: '/app' },
          { label: 'Indian', href: '/app?cuisine=Indian' },
        ]}
      />,
    );
    expect(out).toContain('href="/app"');
    expect(out).toContain('href="/app?cuisine=Indian"');
    expect(out.match(/aria-hidden="true"/g)).toHaveLength(1);
  });

  it('shows the last step as the current page when it has no link', () => {
    const out = html(
      <Breadcrumb
        crumbs={[{ label: 'Recipes', href: '/app' }, { label: 'Dal' }]}
      />,
    );
    expect(out).toContain('aria-current="page"');
    expect(out).not.toContain('href="undefined"');
  });
});
