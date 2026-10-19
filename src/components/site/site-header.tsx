import Link from 'next/link';
import { Suspense, type ReactElement } from 'react';

import { GoogleIcon, PlusIcon, SparklesIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import type { ShellUser } from '@/lib/auth/shell-user';

import { AccountMenu } from './account-menu';
import { DriveButton } from './drive-button';
import { driveLink } from './drive-link';
import { HEADER_ROW_CLASS } from './header-height';
import { HeaderNav } from './header-nav';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { menuLinks, VISITOR_NAV } from './nav-links';

/**
 * The buttons beside the account menu for someone signed in: add a recipe (once
 * Drive is connected), the Drive button, and "Cook with AI". The first two fold
 * into the phone menu on small screens, and "Cook with AI" under `sm`. On
 * tablets (`md` up to `lg`) the buttons are too many for the row, so they show
 * only their icons there; the words stay for screen readers.
 */
function SignedInActions({
  user,
}: Readonly<{ user: ShellUser }>): ReactElement {
  const drive = driveLink(user);
  return (
    <>
      {user.driveConnected ? (
        <ButtonLink
          href="/recipes/add"
          variant="outline"
          className="max-md:hidden"
        >
          <PlusIcon size="sm" />
          <span className="md:max-lg:sr-only">Add recipe</span>
        </ButtonLink>
      ) : null}
      <DriveButton link={drive} className="max-md:hidden" />
      <ButtonLink href="/connect" variant="accent" className="max-sm:hidden">
        <SparklesIcon size="md" />
        <span className="md:max-lg:sr-only">Cook with AI</span>
      </ButtonLink>
      <AccountMenu
        firstName={user.firstName}
        name={user.name}
        email={user.email}
        picture={user.picture}
        drive={drive}
      />
    </>
  );
}

/**
 * The site header. Signed in: the main app links, a "Cook with AI" call to
 * action and the account menu ("Hi Mridang" beside the person's Google photo).
 * A Google Drive button is always there: "Connect Google Drive" until that is
 * done, then "Open Drive", which opens Drive in a new tab. "Add recipe" appears
 * only once Drive is connected (there is nowhere to save one before).
 * Signed out: links to the landing page's sections and a Sign in button. On
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
