import type { ReactNode } from 'react';

import { getShellUser } from '@/lib/auth/shell-user';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/** The frame shared by every page: skip link, header, content and footer. */
export async function SiteShell({ children }: { children: ReactNode }) {
  const user = await getShellUser();
  return (
    <>
      <a
        href="#main"
        className="bg-ink focus:rounded-control sr-only z-50 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader user={user} />
      {/*
        The content area is at least as tall as the screen below the header, so
        the footer always starts below the fold. Pages swap a loading skeleton
        for their real content, and the two differ in height: without this the
        footer, which is huge, would jump up or down in view at every swap.
      */}
      <main id="main" className="min-h-[calc(100svh-4.75rem)] flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
