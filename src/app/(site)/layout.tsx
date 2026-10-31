import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactElement, ReactNode } from 'react';

import { SiteShell } from '@/components/site/shell';

/**
 * Every public and signed-in page shares the same header and footer. The
 * search state some pages keep in the address (`nuqs`) is wired here rather
 * than in the root layout, which is the same in every app.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <NuqsAdapter>
      <SiteShell>{children}</SiteShell>
    </NuqsAdapter>
  );
}
