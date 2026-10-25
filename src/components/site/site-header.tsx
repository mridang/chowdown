import Link from 'next/link';
import { Suspense, type ReactElement } from 'react';

import { GoogleIcon, PlusIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import type { ShellUser } from '@/lib/core/auth/shell-user';

import { AccountMenu } from '@/components/site/account-menu';
import { driveLink } from '@/components/site/drive-link';
import { HEADER_ROW_CLASS } from '@/components/site/header-height';
import { HeaderNav } from '@/components/site/header-nav';
import { Logo } from '@/components/site/logo';
import { MobileNav } from '@/components/site/mobile-nav';
import { menuLinks, VISITOR_NAV } from '@/components/site/nav-links';

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
    <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur">
      <div className="h-1.5 bg-marigold" />
      <div className="border-b border-line">
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
                    className="flex h-10 items-center rounded-control px-3 text-sm font-medium text-muted transition hover:bg-ink/5"
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
              <ButtonLink href="/auth/login">
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
