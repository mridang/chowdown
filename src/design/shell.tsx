import type { ReactNode } from 'react';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/** The signed-in sample user the sandbox shows. */
export const SAMPLE_USER = { name: 'Mridang', email: 'mridang@example.com' };

/** Page frame shared by every design screen: header, content, footer. */
export function DesignShell({
  signedIn,
  active,
  children,
}: {
  signedIn: boolean;
  active?: 'home' | 'search' | 'favourites' | 'connect';
  children: ReactNode;
}) {
  return (
    <div className="bg-blush text-ink min-h-screen font-sans antialiased">
      <SiteHeader user={signedIn ? SAMPLE_USER : null} active={active} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
