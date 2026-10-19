import type { ReactNode } from 'react';

import { BarePage } from '@/components/landing/bare-page';
import { Card } from '@/components/ui/card';

/**
 * A single card centred on a bare page (no site header or footer): the layout
 * of the approval screen an assistant sends people to, and of the step that
 * asks them to connect Google Drive first.
 *
 * `framed` (the default) puts `children` in a white card. Pass `framed={false}`
 * when `children` is already a card of its own, such as the Drive connect
 * panel, so the two do not nest.
 */
export function CenteredCard({
  framed = true,
  children,
}: {
  framed?: boolean;
  children: ReactNode;
}) {
  return (
    <BarePage>
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
        {framed ? <Card padding="lg">{children}</Card> : children}
      </div>
    </BarePage>
  );
}
