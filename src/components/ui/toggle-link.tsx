import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * A link that switches a filter on or off, such as a facet option or the
 * Favourites switch. Pressing it navigates to `href`, which is the same page
 * with the filter toggled in the address, so the filter survives a reload, can
 * be shared, and works before any script has loaded.
 *
 * **Why `aria-current`, and not a `switch` or `checkbox` role.** These used to
 * be links carrying `role="switch"` or `role="checkbox"`. That promises the
 * keyboard behaviour of the role, where Space toggles the control, but a link
 * only activates on Enter, so Space did nothing and the role was a broken
 * promise. `aria-pressed` is not allowed on a link at all. The honest semantics
 * are a real link that says whether it is the current choice, and
 * `aria-current="true"` does exactly that: it is valid on a link, and screen
 * readers announce it ("Favourites, link, current"). When the filter is off the
 * attribute is left out, so an off link reads as a plain link.
 *
 * The caller supplies the look (`className`), since a facet row and a full-width
 * switch share nothing but their behaviour. The page does not scroll back to
 * the top when one is pressed, because the person is mid-way down a list.
 */
export function ToggleLink({
  href,
  active,
  activeText,
  className,
  children,
}: {
  /** Where pressing it goes: the current page with the filter flipped. */
  href: string;
  /** Whether the filter is switched on right now. */
  active: boolean;
  /**
   * What to add for screen readers while it is on ("selected", "on"). Without
   * it a selected option would read "link, current", which does not say that
   * pressing it again removes the filter.
   */
  activeText?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={className}
    >
      {children}
      {active && activeText ? (
        <span className="sr-only">, {activeText}</span>
      ) : null}
    </Link>
  );
}
