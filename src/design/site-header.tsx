import Link from 'next/link';

import { AccountMenu } from './account-menu';
import { GoogleIcon, PlugIcon } from './icons';
import { MobileNav } from './mobile-nav';
import { ButtonLink } from './ui/button';
import { cn } from './ui/cn';
import { Container } from './ui/layout';

/** The wordmark: a heavy heading face, lower case, with a small descriptor beneath. */
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

export type NavKey = 'search' | 'favourites' | 'connect' | 'home';

/** Links for someone who is signed in. */
const APP_NAV: [string, string, NavKey][] = [
  ['Recipes', '/design/search', 'search'],
  ['Favourites', '/design/search?fav=1', 'favourites'],
  ['Connect AI', '/design/connect', 'connect'],
];

/** Links for a visitor: they jump to sections of the landing page. */
const VISITOR_NAV: [string, string][] = [
  ['Features', '#features'],
  ['FAQ', '#faq'],
];

/**
 * The site header. Signed in: the main app links and the account menu. Signed
 * out: links to the landing page's sections and a Sign in button. On phones the
 * links fold into a menu.
 */
export function SiteHeader({
  user,
  active,
}: {
  user: { name: string; email: string } | null;
  active?: NavKey;
}) {
  const links: [string, string][] = user
    ? APP_NAV.map(([label, href]) => [label, href])
    : VISITOR_NAV;
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
              {user
                ? APP_NAV.map(([label, href, key]) => (
                    <Link
                      key={key}
                      href={href}
                      aria-current={active === key ? 'page' : undefined}
                      className={cn(
                        'flex h-10 items-center gap-1.5 rounded-control px-3 text-sm font-medium transition hover:bg-ink/5',
                        active === key
                          ? 'text-ink underline decoration-2 underline-offset-[10px]'
                          : 'text-ink/75',
                      )}
                    >
                      {key === 'connect' ? (
                        <PlugIcon className="text-ember h-4 w-4" />
                      ) : null}
                      {label}
                    </Link>
                  ))
                : VISITOR_NAV.map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      className="rounded-control text-ink/75 hover:bg-ink/5 flex h-10 items-center px-3 text-sm font-medium transition"
                    >
                      {label}
                    </a>
                  ))}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <AccountMenu name={user.name} email={user.email} />
            ) : (
              <ButtonLink href="/design/home?user=1">
                <GoogleIcon className="h-4 w-4" />
                Sign in
              </ButtonLink>
            )}
            <MobileNav links={links} />
          </div>
        </Container>
      </div>
    </header>
  );
}
