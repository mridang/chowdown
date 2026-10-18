import type { ReactNode } from 'react';

import { SiteShell } from '@/components/site/shell';

/** Every public and signed-in page shares the same header and footer. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
