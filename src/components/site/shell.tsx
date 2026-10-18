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
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
