import Link from 'next/link';

import {
  ChevronIcon,
  HeartIcon,
  LogoutIcon,
  MenuIcon,
  PlugIcon,
  SearchIcon,
  UserIcon,
} from './icons';
import { ButtonLink } from './ui/button';
import { cn } from './ui/cn';
import { Container } from './ui/layout';

/** The wordmark: a heavy serif, lower case, with a small descriptor beneath. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/design"
      className={cn('inline-block leading-none text-ink', className)}
      aria-label="chowdown home"
    >
      <span className="font-display block text-[1.7rem] font-bold tracking-tight">
        chowdown
      </span>
      <span className="mt-1 block text-[10px] font-semibold tracking-[0.24em] uppercase">
        Recipe keeper
      </span>
    </Link>
  );
}

type NavKey = 'search' | 'favourites' | 'connect';

const NAV: [string, string, NavKey][] = [
  ['Recipes', '/design/search', 'search'],
  ['Favourites', '/design/search?fav=1', 'favourites'],
  ['Connect AI', '/design/connect', 'connect'],
];

/** A row in the account menu. */
function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-control hover:bg-ink/5 flex h-10 items-center gap-3 px-3 text-sm font-medium transition"
    >
      <span className="text-ink/65">{icon}</span>
      {children}
    </Link>
  );
}

/**
 * The account control. Closed, it is just an avatar (with a green dot while
 * signed in) and the first name; opened, it says which account you are in and
 * holds the account links. There is no "Signed in" label cluttering the bar.
 */
function AccountMenu({ name, email }: { name: string; email: string }) {
  return (
    <details className="group relative">
      <summary className="rounded-control hover:bg-ink/5 flex h-10 cursor-pointer list-none items-center gap-2 pr-2 pl-1 transition sm:pr-3">
        <span className="bg-ink relative grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-white">
          {name.slice(0, 1)}
          <span className="border-paper bg-live absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2" />
        </span>
        <span className="hidden text-sm font-semibold sm:block">{name}</span>
        <ChevronIcon className="text-ink/65 hidden h-4 w-4 transition group-open:rotate-180 sm:block" />
      </summary>
      <div className="rounded-card border-ink/15 absolute right-0 mt-2 w-64 border bg-white p-2">
        <div className="px-3 py-2.5">
          <p className="text-ink/65 text-xs">Signed in as</p>
          <p className="truncate text-sm font-semibold">{email}</p>
        </div>
        <div className="border-ink/10 my-1 border-t" />
        <MenuLink
          href="/design/search"
          icon={<SearchIcon className="h-[18px] w-[18px]" />}
        >
          Your recipes
        </MenuLink>
        <MenuLink
          href="/design/search?fav=1"
          icon={<HeartIcon className="h-[18px] w-[18px]" />}
        >
          Favourites
        </MenuLink>
        <MenuLink
          href="/design/connect"
          icon={<PlugIcon className="h-[18px] w-[18px]" />}
        >
          Connect an assistant
        </MenuLink>
        <div className="border-ink/10 my-1 border-t" />
        <MenuLink
          href="/design/home"
          icon={<LogoutIcon className="h-[18px] w-[18px]" />}
        >
          Sign out
        </MenuLink>
      </div>
    </details>
  );
}

/**
 * The site header: a thin marigold rule, then the wordmark, navigation and the
 * account. On phones the navigation folds into a menu and the account shrinks
 * to the avatar.
 */
export function SiteHeader({
  user,
  active,
}: {
  user: { name: string; email: string } | null;
  active?: NavKey | 'home';
}) {
  return (
    <header className="bg-paper/95 sticky top-0 z-30 backdrop-blur">
      <div className="bg-marigold h-1.5" />
      <div className="border-ink/10 border-b">
        <Container className="flex h-[4.25rem] items-center justify-between gap-4">
          <div className="flex items-center gap-8 lg:gap-10">
            <Logo />
            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Main"
            >
              {NAV.map(([label, href, key]) => (
                <Link
                  key={key}
                  href={href}
                  aria-current={active === key ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center gap-1.5 rounded-control px-3 text-sm font-medium transition hover:bg-ink/5',
                    active === key
                      ? 'text-ink underline decoration-2 underline-offset-[10px]'
                      : 'text-ink/70',
                  )}
                >
                  {key === 'connect' ? (
                    <PlugIcon className="text-ember h-4 w-4" />
                  ) : null}
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/design/search"
              aria-label="Search recipes"
              className="rounded-control hover:bg-ink/5 grid h-10 w-10 place-items-center transition"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            {user ? (
              <AccountMenu name={user.name} email={user.email} />
            ) : (
              <ButtonLink href="/design/home?user=1">
                <UserIcon className="h-4 w-4" />
                Sign in
              </ButtonLink>
            )}
            <details className="relative md:hidden">
              <summary
                aria-label="Menu"
                className="rounded-control hover:bg-ink/5 grid h-10 w-10 cursor-pointer list-none place-items-center"
              >
                <MenuIcon className="h-5 w-5" />
              </summary>
              <nav
                aria-label="Mobile"
                className="rounded-card border-ink/15 absolute right-0 mt-2 w-52 border bg-white p-1.5"
              >
                {NAV.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-control hover:bg-ink/5 block px-3 py-2.5 text-sm font-medium"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </Container>
      </div>
    </header>
  );
}
