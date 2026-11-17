import { describe, expect, it, jest } from '@jest/globals';
import { html } from '../../components/render';
import type { ReactNode } from 'react';

const DIV_DATA_TESTID =
  /^<div data-testid="nuqs"><div data-testid="shell">.*<\/div><\/div>$/u;

// eslint-disable-next-line tslop/no-module-mocking -- nuqs/adapters/next/app is a framework module the layout imports directly, and it needs a Next router
jest.unstable_mockModule('nuqs/adapters/next/app', () => ({
  NuqsAdapter: ({ children }: { readonly children: ReactNode }) => (
    <div data-testid="nuqs">{children}</div>
  ),
}));

// eslint-disable-next-line tslop/no-module-mocking -- @/components/site/shell is imported directly by the code under test, which has no parameter to take it instead
jest.unstable_mockModule('@/components/site/shell', () => ({
  SiteShell: ({ children }: { readonly children: ReactNode }) => (
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
    expect(out).toMatch(DIV_DATA_TESTID);
  });
});
