import type { ReactElement, ReactNode } from 'react';

import { getShellUser } from '@/core/auth/shell-user';

import { MAIN_MIN_HEIGHT_CLASS } from '@/components/site/header-height';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';

/** The frame shared by every page: skip link, header, content and footer. */
export async function SiteShell({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  const user = await getShellUser();
  return (
    <>
      <SkipLink />
      <SiteHeader user={user} />
      {/*
        The content area is at least as tall as the screen below the header, so
        the footer always starts below the fold. Pages swap a loading skeleton
        for their real content, and the two differ in height: without this the
        footer, which is huge, would jump up or down in view at every swap.
      */}
      <main id="main" className={`${MAIN_MIN_HEIGHT_CLASS} flex-1`}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
