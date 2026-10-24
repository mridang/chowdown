import Link from 'next/link';
import type { ReactElement } from 'react';

import { DriveIcon, HeartIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { isServerHref } from '@/components/ui/button';
import { POPOVER_ITEM } from '@/components/ui/popover';

import { NEW_TAB } from '@/components/site/drive-link';
import type { NavIcon, NavLink } from '@/components/site/nav-links';

/** The picture for each kind of menu link; the Drive one is the colour logo. */
const ICONS: Readonly<Record<NavIcon, ReactElement>> = {
  recipes: <SearchIcon size="menu" className="text-subtle" />,
  favourites: <HeartIcon size="menu" className="text-subtle" />,
  add: <PlusIcon size="menu" className="text-subtle" />,
  drive: <DriveIcon size="menu" />,
};

/**
 * One row of a popover menu (the phone menu and the account menu): a link
 * inside the app, to one of our API routes (a plain `<a>`, because those
 * redirect to other sites), or out to another site, which opens in a new tab
 * and says so to screen readers.
 */
export function MenuLink({
  label,
  href,
  icon,
  external,
}: NavLink): ReactElement {
  const content = (
    <>
      {icon ? ICONS[icon] : null}
      {label}
      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </>
  );
  if (external) {
    return (
      <a href={href} {...NEW_TAB} className={POPOVER_ITEM}>
        {content}
      </a>
    );
  }
  return isServerHref(href) ? (
    <a href={href} className={POPOVER_ITEM}>
      {content}
    </a>
  ) : (
    <Link href={href} className={POPOVER_ITEM}>
      {content}
    </Link>
  );
}
