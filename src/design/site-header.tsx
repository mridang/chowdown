import Link from 'next/link';

import { MenuIcon, SearchIcon, UserIcon } from './icons';
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
      <span className="mt-1 block text-[9px] font-semibold tracking-[0.28em] uppercase">
        Recipe keeper
      </span>
    </Link>
  );
}

type NavKey = 'search' | 'favourites' | 'home';

const NAV: [string, string, NavKey][] = [
  ['Recipes', '/design/search', 'search'],
  ['Favourites', '/design/search?fav=1', 'favourites'],
  ['How it works', '/design/home', 'home'],
];

/** The signed-in account: avatar with a live dot, and (on wider screens) the name. */
function UserBadge({ name, email }: { name: string; email: string }) {
  return (
    <div
      className="rounded-control border-ink/15 flex h-10 items-center gap-2.5 border bg-white pr-1 pl-1 sm:pr-4"
      title={email}
    >
      <span className="bg-ink relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white">
        {name.slice(0, 1)}
        <span className="bg-leaf absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white" />
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="text-ink/55 block text-[10px] font-medium tracking-wider uppercase">
          Signed in
        </span>
        <span className="block text-sm font-semibold">{name}</span>
      </span>
    </div>
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
  active?: NavKey;
}) {
  return (
    <header className="bg-blush/95 sticky top-0 z-30 backdrop-blur">
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
                    'rounded-control px-3 py-2 text-sm font-medium transition hover:bg-ink/5',
                    active === key
                      ? 'text-ink underline decoration-2 underline-offset-[10px]'
                      : 'text-ink/70',
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/design/search"
              aria-label="Search recipes"
              className="rounded-control hover:bg-ink/5 grid h-10 w-10 place-items-center transition"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            {user ? (
              <UserBadge name={user.name} email={user.email} />
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
