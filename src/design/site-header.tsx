import Link from 'next/link';

import { MenuIcon, SearchIcon, UserIcon } from './icons';

/** The wordmark: a heavy serif, lower case, with a small descriptor beneath. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/design"
      className={`text-ink inline-block leading-none ${className}`}
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

const NAV: [string, string, 'search' | 'favourites' | 'home'][] = [
  ['Recipes', '/design/search', 'search'],
  ['Favourites', '/design/search?fav=1', 'favourites'],
  ['How it works', '/design/home', 'home'],
];

/**
 * The site header: a thin marigold rule, then the wordmark, navigation and the
 * account. When someone is signed in it names them, with a green dot, so it is
 * always clear whose recipes these are. On phones the navigation folds into a
 * menu and the account shrinks to the avatar.
 */
export function SiteHeader({
  user,
  active,
}: {
  user: { name: string; email: string } | null;
  active?: 'home' | 'search' | 'favourites';
}) {
  return (
    <header className="bg-blush/95 sticky top-0 z-30 backdrop-blur">
      <div className="bg-marigold h-1.5" />
      <div className="border-ink/10 border-b">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-10">
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
                  className={`hover:bg-ink/5 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active === key
                      ? 'text-ink underline decoration-2 underline-offset-[10px]'
                      : 'text-ink/70'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/design/search"
              className="text-ink hover:bg-ink/5 grid h-10 w-10 place-items-center rounded-md transition"
              aria-label="Search recipes"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            {user ? (
              <div
                className="border-ink/15 flex items-center gap-2.5 rounded-md border bg-white py-1 pr-3 pl-1 sm:pr-4"
                title={user.email}
              >
                <span className="bg-ink relative grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-white">
                  {user.name.slice(0, 1)}
                  <span className="bg-leaf absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white" />
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="text-ink/55 block text-[10px] font-medium tracking-wider uppercase">
                    Signed in
                  </span>
                  <span className="block text-sm font-semibold">
                    {user.name}
                  </span>
                </span>
              </div>
            ) : (
              <Link
                href="/design/home?user=1"
                className="bg-ink hover:bg-ink/85 flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition"
              >
                <UserIcon className="h-4 w-4" />
                Sign in
              </Link>
            )}
            <details className="group relative md:hidden">
              <summary
                className="hover:bg-ink/5 grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md"
                aria-label="Menu"
              >
                <MenuIcon className="h-5 w-5" />
              </summary>
              <nav
                className="border-ink/15 absolute right-0 mt-2 w-52 rounded-md border bg-white p-1.5"
                aria-label="Mobile"
              >
                {NAV.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="hover:bg-ink/5 block rounded px-3 py-2.5 text-sm font-medium"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
