/**
 * @packageDocumentation
 *
 * How tall the site header is, and everything laid out relative to it, kept
 * together so they cannot drift apart.
 *
 * These are literal class strings, not values built from a number, on purpose:
 * Tailwind finds classes by scanning the source for whole strings, so a class
 * assembled at runtime (`h-[${rem}rem]`) would never be generated. When the
 * header's height changes, change every constant here in step; the test in
 * `test/components/site/header-height.test.ts` checks that the relationships
 * still hold.
 *
 * The header is a 0.375rem marigold strip, then a row of {@link HEADER_ROW_REM}
 * with a 1px rule beneath it.
 */

/** The height, in rem, of the header's row of logo, links and account menu. */
export const HEADER_ROW_REM = 4.25;

/** Sets the header row's height (the site header and the bare page's header). */
export const HEADER_ROW_CLASS = 'h-[4.25rem]';

/**
 * Makes the main content at least as tall as the screen below the header (the
 * header row plus its strip and rule, rounded up to 4.75rem), so the footer
 * always starts below the fold.
 */
export const MAIN_MIN_HEIGHT_CLASS = 'min-h-[calc(100svh-4.75rem)]';

/**
 * Pins a sidebar below the sticky header on desktop and caps its height to
 * what remains of the screen, so it scrolls on its own rather than running
 * under the footer.
 */
export const STICKY_SIDEBAR_CLASS =
  'md:sticky md:top-24 md:max-h-[calc(100vh-7rem)]';

/**
 * The recipe page's ingredients panel, pinned a little lower than a filter
 * sidebar because it has a title bar of its own above it.
 */
export const STICKY_PANEL_CLASS =
  'md:sticky md:top-28 md:max-h-[calc(100vh-8rem)]';
