'use client';

import Link from 'next/link';
import { useState, type ComponentProps, type ReactElement } from 'react';

/**
 * A link that fetches its whole page, data included, before it is clicked, so
 * the page opens with no wait. By default Next only prepares the page's loading
 * shell for a link in view; this goes further for the links people are about to
 * use: on hover, keyboard focus or the first touch (which lands a few hundred
 * milliseconds before the tap completes) the full page is fetched. `eager` does
 * it straight away, for the one or two links a person is most likely to take.
 */
export function IntentLink({
  eager = false,
  enabled = true,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Readonly<
  {
    /** Fetch the whole page at once, without waiting for any sign of intent. */
    eager?: boolean;
    /** Off for links that go nowhere real (demo content): no fetching at all. */
    enabled?: boolean;
  } & ComponentProps<typeof Link>
>): ReactElement {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={enabled ? (eager || intent ? true : null) : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
