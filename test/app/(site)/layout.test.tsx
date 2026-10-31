import { describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';

import { html } from '../../components/render';

jest.unstable_mockModule('nuqs/adapters/next/app', () => ({
  NuqsAdapter: ({ children }: { children: ReactNode }) => (
    <div data-testid="nuqs">{children}</div>
  ),
}));

jest.unstable_mockModule('@/components/site/shell', () => ({
  SiteShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

const { default: SiteLayout } = await import('@/app/(site)/layout');

describe('SiteLayout', () => {
  const out = html(
    <SiteLayout>
      <p>The page.</p>
    </SiteLayout>,
  );

  it('draws every page inside the shared header and footer', () => {
    expect(out).toContain('<div data-testid="shell"><p>The page.</p></div>');
  });

  it('keeps the search state in the address for the pages inside it', () => {
    expect(out).toMatch(
      /^<div data-testid="nuqs"><div data-testid="shell">.*<\/div><\/div>$/,
    );
  });
});
