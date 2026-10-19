import Link from 'next/link';
import { Suspense, type ReactElement } from 'react';

import { DriveIcon, GoogleIcon, PlusIcon, SparkIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { driveConnectHref } from '@/lib/auth/drive-access';
import type { ShellUser } from '@/lib/auth/shell-user';

import { AccountMenu } from './account-menu';
import { HEADER_ROW_CLASS } from './header-height';
import { HeaderNav } from './header-nav';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { menuLinks, VISITOR_NAV } from './nav-links';

/**
 * The site header. Signed in: the main app links, a "Cook with AI" call to
 * action and the account menu ("Hi Mridang" beside the person's Google photo).
 * Until Google Drive is connected, "Connect Google Drive" takes the place of
 * "Add recipe" (there is nowhere to save one yet) and disappears once it is.
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
              <>
                {user.driveConnected ? (
                  <ButtonLink
                    href="/recipes/add"
                    variant="outline"
                    className="max-md:hidden"
                  >
                    <PlusIcon size="sm" />
                    Add recipe
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    href={driveConnectHref()}
                    variant="outline"
                    className="max-md:hidden"
                  >
                    <DriveIcon size="sm" />
                    Connect Google Drive
                  </ButtonLink>
                )}
                <ButtonLink
                  href="/connect"
                  variant="accent"
                  className="max-sm:hidden"
                >
                  <SparkIcon size="sm" />
                  Cook with AI
                </ButtonLink>
                <AccountMenu
                  firstName={user.firstName}
                  name={user.name}
                  email={user.email}
                  picture={user.picture}
                  driveConnected={user.driveConnected}
                />
              </>
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
