'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/components/ui/cn';
import { IntentLink } from '@/components/ui/intent-link';

/** The links a signed-in person sees, and the section each belongs to. */
export const APP_NAV = [
  { key: 'search', label: 'Recipes', href: '/app' },
  { key: 'favourites', label: 'Favourites', href: '/app?fav=1' },
] as const;

export type NavKey = (typeof APP_NAV)[number]['key'] | 'connect' | 'home';

/** Which section the current address is in. */
export function activeSection(
  pathname: string,
  favourites: boolean,
): NavKey | undefined {
  if (pathname === '/app' || pathname.startsWith('/recipe')) {
    return favourites && pathname === '/app' ? 'favourites' : 'search';
  }
  if (pathname.startsWith('/connect')) {
    return 'connect';
  }
  return undefined;
}

/** The main navigation on wide screens, marking the current section. */
export function HeaderNav() {
  const pathname = usePathname();
  const favourites = useSearchParams().get('fav') === '1';
  const active = activeSection(pathname, favourites);
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {APP_NAV.map(({ key, label, href }) => (
        <IntentLink
          key={key}
          href={href}
          // The main destination: fetch it as soon as the header appears.
          eager={key === 'search'}
          aria-current={active === key ? 'page' : undefined}
          className={cn(
            'rounded-control hover:bg-ink/5 flex h-10 items-center px-3 text-sm font-medium transition',
            active === key
              ? 'text-ink underline decoration-2 underline-offset-[10px]'
              : 'text-ink/75',
          )}
        >
          {label}
        </IntentLink>
      ))}
    </nav>
  );
}
