'use client';

import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
} from 'react';

/**
 * How long the pointer must rest on a link before that counts as intent. A
 * cursor sweeping across a grid of recipe cards (or a page scrolling under a
 * still cursor) enters dozens of cards in a moment, and each full prefetch is a
 * server render with a database read; a person who means to open a card stays on
 * it for longer than this. Keyboard focus and touch are deliberate, so they do
 * not wait.
 */
export const HOVER_INTENT_MS = 120;

/**
 * Run `onIntent` after `delayMs` unless the returned function is called first.
 * The pointer leaving a link before the delay is up cancels the wait.
 */
export function afterDelay(onIntent: () => void, delayMs: number): () => void {
  const timer = setTimeout(onIntent, delayMs);
  return () => clearTimeout(timer);
}

/**
 * A link that fetches its whole page, data included, before it is clicked, so
 * the page opens with no wait. By default Next only prepares the page's loading
 * shell for a link in view; this goes further for the links people are about to
 * use: once the pointer has rested on it (see {@link HOVER_INTENT_MS}), or on
 * keyboard focus, or the first touch (which lands a few hundred milliseconds
 * before the tap completes), the full page is fetched. `eager` does it straight
 * away, for the one or two links a person is most likely to take.
 *
 * The full fetch is deliberately kept for real intent only: it costs a server
 * render, and `staleTimes` in `next.config.ts` keeps what it fetched for three
 * minutes so a second visit costs nothing.
 */
export function IntentLink({
  eager = false,
  enabled = true,
  onMouseEnter,
  onMouseLeave,
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
  /** Cancels the hover wait that is under way, if there is one. */
  const cancelHover = useRef<(() => void) | null>(null);
  // A link that goes away mid-wait must not set state afterwards.
  useEffect(() => () => cancelHover.current?.(), []);
  return (
    <Link
      {...props}
      prefetch={enabled ? (eager || intent ? true : null) : false}
      onMouseEnter={(event) => {
        cancelHover.current?.();
        cancelHover.current = afterDelay(
          () => setIntent(true),
          HOVER_INTENT_MS,
        );
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        cancelHover.current?.();
        onMouseLeave?.(event);
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
