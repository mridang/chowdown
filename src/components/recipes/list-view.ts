/**
 * @packageDocumentation
 *
 * The two layouts the recipe listing can take, and how the chosen one is
 * remembered. It is kept in a cookie, not in the address or in the database:
 * the listing is rendered on the server, so the layout has to arrive with the
 * request for the first paint to be right (a value kept only in the browser
 * would flash the other layout first). It is a preference about the screen in
 * front of the person (a phone may want the list where a desktop wants the
 * grid), so it belongs to the device, and it needs no migration, no API and no
 * extra read. The address keeps its meaning (search, filters and order), so a
 * link a person shares still shows what they found in whichever layout the
 * reader likes.
 */

/** The layouts, in the order they are offered. */
export const LIST_VIEWS = ['grid', 'list'] as const;

/** One of the layouts of the recipe listing. */
export type ListView = (typeof LIST_VIEWS)[number];

/** The layout before one has been chosen. */
export const DEFAULT_VIEW: ListView = 'grid';

/** The cookie that holds the chosen layout. */
export const VIEW_COOKIE = 'chowdown_view';

/** How long the choice is remembered: a year, in seconds. */
const REMEMBER_SECONDS = 365 * 24 * 60 * 60;

/** Whether `value` is one of the layouts. */
function isListView(value: string | undefined): value is ListView {
  const views: readonly string[] = LIST_VIEWS;
  return value !== undefined && views.includes(value);
}

/**
 * The layout a cookie value names; anything else (no cookie, an old or
 * hand-edited value) is the default, so a bad cookie can never break the page.
 */
export function parseListView(value: string | undefined): ListView {
  return isListView(value) ? value : DEFAULT_VIEW;
}

/**
 * The text to assign to `document.cookie` to remember `view`. It only needs to
 * reach the listing, so it is scoped to `/app`; it holds no secret, so the
 * browser's scripts may write it, and `Secure` is added on https.
 */
export function viewCookie(view: ListView, secure: boolean): string {
  return [
    `${VIEW_COOKIE}=${view}`,
    'Path=/app',
    `Max-Age=${REMEMBER_SECONDS}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
