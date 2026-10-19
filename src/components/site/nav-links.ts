/**
 * @packageDocumentation
 *
 * The site's navigation, as data: which links the header offers a signed-in
 * person, which section the current address belongs to, and what the phone menu
 * lists. They live here, rather than in the components that draw them, so the
 * server-rendered header and the client-side nav read one list, and so the
 * choices can be tested without rendering anything.
 */

import { driveConnectHref } from '@/lib/auth/drive-access';
import type { ShellUser } from '@/lib/auth/shell-user';

/** One link: the words on it and where it goes. */
export type NavLink = Readonly<{ label: string; href: string }>;

/** The links a signed-in person sees in the header, and the section each belongs to. */
export const APP_NAV = [
  { key: 'search', label: 'Recipes', href: '/app' },
  { key: 'favourites', label: 'Favourites', href: '/app?fav=1' },
] as const;

/** A section of the app the header can mark as the current one. */
export type NavKey = (typeof APP_NAV)[number]['key'] | 'connect';

/**
 * Which section the current address is in, or `undefined` for a page that
 * belongs to none (the privacy policy, the add-recipes page). A recipe opened
 * from the list counts as part of Recipes, and `?fav=1` only picks Favourites
 * on the list itself.
 */
export function activeSection(
  pathname: string,
  favourites: boolean,
): NavKey | undefined {
  if (pathname === '/app' || pathname.startsWith('/recipe/')) {
    return favourites && pathname === '/app' ? 'favourites' : 'search';
  }
  if (pathname.startsWith('/connect')) {
    return 'connect';
  }
  return undefined;
}

/** Links for a visitor: they jump to sections of the landing page. */
export const VISITOR_NAV: readonly NavLink[] = [
  { label: 'Features', href: '/#features' },
  { label: 'FAQ', href: '/#faq' },
];

/** Links in the phone menu for someone signed in. */
const APP_MENU: readonly NavLink[] = [
  ...APP_NAV.map(({ label, href }) => ({ label, href })),
  { label: 'Add recipes', href: '/recipes/add' },
  { label: 'Cook with AI', href: '/connect' },
];

/**
 * The phone menu's links. A visitor gets the landing page's sections; someone
 * signed in gets the app links, plus "Connect Google Drive" until that is done
 * (the header's own button for it is hidden on a phone).
 */
export function menuLinks(user: ShellUser | null): readonly NavLink[] {
  if (!user) {
    return VISITOR_NAV;
  }
  return user.driveConnected
    ? APP_MENU
    : [
        ...APP_MENU,
        { label: 'Connect Google Drive', href: driveConnectHref() },
      ];
}
