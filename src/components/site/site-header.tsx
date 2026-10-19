import Link from 'next/link';
import { Suspense, type ReactElement } from 'react';

import { GoogleIcon, PlusIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import type { ShellUser } from '@/lib/auth/shell-user';

import { AccountMenu } from './account-menu';
import { driveLink } from './drive-link';
import { HEADER_ROW_CLASS } from './header-height';
import { HeaderNav } from './header-nav';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { menuLinks, VISITOR_NAV } from './nav-links';

/**
 * What sits beside the account menu for someone signed in: the "Add recipe"
 * button, the one call to action on the site, shown once Drive is connected
 * (there is nowhere to save a recipe before). It folds into the phone menu on
 * small screens. Connecting Drive, connecting an assistant and installing the
 * app all live in the account menu, so the header carries nothing else.
 */
function SignedInActions({
  user,
}: Readonly<{ user: ShellUser }>): ReactElement {
  return (
    <>
      {user.driveConnected ? (
        <ButtonLink
          href="/recipes/add"
          variant="accent"
          className="max-md:hidden"
        >
          <PlusIcon size="sm" />
          Add recipe
        </ButtonLink>
      ) : null}
      <AccountMenu
        firstName={user.firstName}
        name={user.name}
        email={user.email}
        picture={user.picture}
        drive={driveLink(user)}
      />
    </>
  );
}

/**
 * The site header. Signed in: the main app links, the "Add recipe" call to
 * action (once Drive is connected) and the account menu ("Hi Mridang" beside
 * the person's Google photo), which holds Drive, the assistant connection and
 * installing the app. Signed out: links to the landing page's sections and a Sign in button. On
 * phones the links fold into a menu.
 */
export function SiteHeader({
  user,
}: Readonly<{ user: ShellUser | null }>): ReactElement {
  return (
    <header className="bg-paper/95 sticky top-0 z-30 backdrop-blur">
      <div className="bg-marigold h-1.5" />
      <div className="border-line border-b">
        <Container
          className={`flex ${HEADER_ROW_CLASS} items-center justify-between gap-4`}
        >
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
                {VISITOR_NAV.map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-control text-muted hover:bg-ink/5 flex h-10 items-center px-3 text-sm font-medium transition"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <SignedInActions user={user} />
            ) : (
              <ButtonLink href="/api/auth/login">
                <GoogleIcon size="sm" />
                Sign in
              </ButtonLink>
            )}
            <MobileNav links={menuLinks(user)} />
          </div>
        </Container>
      </div>
    </header>
  );
}
