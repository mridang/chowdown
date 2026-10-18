import Link from 'next/link';

import { BoltIcon, MenuIcon, SearchIcon, UserIcon } from './icons';

/** The scrolling strip above the header: marigold, flame-coloured shouting. */
function Ticker() {
  const items = [
    'Your recipes, your Drive',
    'Cook what you saved',
    'Plain text, forever',
    'Bring your own AI',
  ];
  const run = [...items, ...items, ...items, ...items];
  return (
    <div
      className="border-ink bg-marigold text-flame overflow-hidden border-b py-1.5"
      aria-hidden="true"
    >
      <div className="animate-ticker font-display flex w-max items-center gap-6 text-[13px] tracking-wide whitespace-nowrap uppercase">
        {[...run, ...run].map((text, i) => (
          <span key={i} className="flex items-center gap-6">
            {text}
            <BoltIcon className="h-3.5 w-3.5" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The wordmark: heavy, tilted a touch, with a small tagline underneath. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/design" className={`inline-block text-center ${className}`}>
      <span className="font-display text-ink block text-3xl leading-none tracking-tight">
        chowdown
      </span>
      <span className="text-ink mt-1 block text-[9px] font-semibold tracking-[0.3em] uppercase">
        ✦ recipe keeper ✦
      </span>
    </Link>
  );
}

/**
 * The site header. When someone is signed in it shows who, with a green "live"
 * dot, so it is always obvious which account the recipes belong to.
 */
export function SiteHeader({
  user,
  active,
}: {
  user: { name: string; email: string } | null;
  active?: 'home' | 'search' | 'favourites';
}) {
  const link = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={`font-display text-sm tracking-wide uppercase decoration-2 underline-offset-8 hover:underline ${
        active === key ? 'underline' : ''
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header>
      <Ticker />
      <div className="border-ink bg-blush border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <nav className="hidden items-center gap-7 md:flex">
            {link('/design/search', 'Recipes', 'search')}
            {link('/design/search?fav=1', 'Favourites', 'favourites')}
            {link('/design/home', 'How it works', 'home')}
          </nav>
          <button
            type="button"
            className="border-ink grid h-11 w-11 place-items-center rounded-full border bg-white md:hidden"
            aria-label="Menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <Logo />

          <div className="flex items-center gap-3">
            <Link
              href="/design/search"
              className="border-ink hover:bg-marigold grid h-11 w-11 place-items-center rounded-full border bg-white transition"
              aria-label="Search recipes"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            {user ? (
              <div
                className="border-ink flex items-center gap-2.5 rounded-full border bg-white py-1 pr-4 pl-1"
                title={user.email}
              >
                <span className="bg-plum font-display relative grid h-9 w-9 place-items-center rounded-full text-sm text-white">
                  {user.name.slice(0, 1)}
                  <span className="bg-leaf absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border border-white" />
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="text-ink/60 block text-[10px] font-semibold tracking-wider uppercase">
                    Signed in
                  </span>
                  <span className="font-display block text-sm">
                    {user.name}
                  </span>
                </span>
              </div>
            ) : (
              <Link
                href="/design/home?user=1"
                className="border-ink bg-flame font-display flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm tracking-wide text-white uppercase transition"
              >
                <UserIcon className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
