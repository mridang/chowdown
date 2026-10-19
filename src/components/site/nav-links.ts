/**
 * @packageDocumentation
 *
 * The site's navigation, as data: which links the header offers a signed-in
 * person, which section the current address belongs to, and what the phone menu
 * lists. They live here, rather than in the components that draw them, so the
 * server-rendered header and the client-side nav read one list, and so the
 * choices can be tested without rendering anything.
 */

import type { ShellUser } from '@/lib/auth/shell-user';

/** The little pictures a menu link can carry (see the phone menu). */
export type NavIcon = 'recipes' | 'favourites' | 'add' | 'drive';

/** One link: the words on it, where it goes, and how it should open. */
export type NavLink = Readonly<{
  label: string;
  href: string;
  /** A picture to show beside the label, where the menu uses them. */
  icon?: NavIcon;
  /** The link leaves the app: open it in a new tab. */
  external?: boolean;
}>;

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

/** The picture beside each header section in the phone menu. */
const SECTION_ICONS = {
  search: 'recipes',
  favourites: 'favourites',
} as const satisfies Record<(typeof APP_NAV)[number]['key'], NavIcon>;

/** Links in the phone menu for someone signed in. */
const APP_MENU: readonly NavLink[] = [
  ...APP_NAV.map(({ key, label, href }) => ({
    label,
    href,
    icon: SECTION_ICONS[key],
  })),
  { label: 'Add recipes', href: '/recipes/add', icon: 'add' },
];

/**
 * The phone menu's links. A visitor gets the landing page's sections; someone
 * signed in gets the app links. Drive, the assistant connection and installing
 * the app are in the account menu, which is always in the header.
 */
export function menuLinks(user: ShellUser | null): readonly NavLink[] {
  return user ? APP_MENU : VISITOR_NAV;
}
