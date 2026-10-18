import Link from 'next/link';
import { Suspense } from 'react';

import { GoogleIcon, PlusIcon, SparkIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Container } from '@/components/ui/layout';
import type { ShellUser } from '@/lib/auth/shell-user';

import { AccountMenu } from './account-menu';
import { HeaderNav } from './header-nav';
import { MobileNav } from './mobile-nav';

/** The wordmark: a heavy heading face, lower case, with a small descriptor beneath. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn('text-ink inline-block leading-none', className)}
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

/** Links for a visitor: they jump to sections of the landing page. */
const VISITOR_NAV: [string, string][] = [
  ['Features', '/#features'],
  ['FAQ', '/#faq'],
];

/** Links in the phone menu for someone signed in. */
const APP_MENU: [string, string][] = [
  ['Recipes', '/app'],
  ['Favourites', '/app?fav=1'],
  ['Add recipes', '/recipes/add'],
  ['Cook with AI', '/connect'],
];

/**
 * The site header. Signed in: the main app links, a "Cook with AI" call to
 * action and the account menu ("Hi Mridang" beside the person's Google photo).
 * Signed out: links to the landing page's sections and a Sign in button. On
 * phones the links fold into a menu.
 */
export function SiteHeader({ user }: { user: ShellUser | null }) {
  return (
    <header className="bg-paper/95 sticky top-0 z-30 backdrop-blur">
      <div className="bg-marigold h-1.5" />
      <div className="border-ink/10 border-b">
        <Container className="flex h-[4.25rem] items-center justify-between gap-4">
          <div className="flex items-center gap-8 lg:gap-10">
            <Logo />
            {user ? (
              <Suspense
                fallback={
                  <nav className="hidden w-48 md:block" aria-label="Main" />
                }
              >
                <HeaderNav />
              </Suspense>
            ) : (
              <nav
                className="hidden items-center gap-1 md:flex"
                aria-label="Main"
              >
                {VISITOR_NAV.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-control text-ink/75 hover:bg-ink/5 flex h-10 items-center px-3 text-sm font-medium transition"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <>
                <ButtonLink
                  href="/recipes/add"
                  variant="outline"
                  className="max-md:hidden"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add recipe
                </ButtonLink>
                <ButtonLink
                  href="/connect"
                  variant="accent"
                  className="max-sm:hidden"
                >
                  <SparkIcon className="h-4 w-4" />
                  Cook with AI
                </ButtonLink>
                <AccountMenu
                  firstName={user.firstName}
                  name={user.name}
                  email={user.email}
                  picture={user.picture}
                />
              </>
            ) : (
              <ButtonLink href="/api/auth/login">
                <GoogleIcon className="h-4 w-4" />
                Sign in
              </ButtonLink>
            )}
            <MobileNav links={user ? APP_MENU : VISITOR_NAV} />
          </div>
        </Container>
      </div>
    </header>
  );
}
