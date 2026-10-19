import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Caveat, Inter } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';

import { ServiceWorker } from '@/components/site/service-worker';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';

import './globals.css';

/**
 * Body face. `optional` means a slow first load shows the (metrics-matched)
 * system font instead of swapping to Inter mid-read, which keeps paragraphs from
 * repainting late; the font is cached for every page after the first.
 */
const sans = Inter({
  variable: '--font-sans-face',
  subsets: ['latin'],
  display: 'optional',
  preload: false,
});

/** Display face for headings: a heavy, friendly grotesque. */
const display = Bricolage_Grotesque({
  variable: '--font-display-face',
  subsets: ['latin'],
  display: 'optional',
  preload: false,
});

/**
 * Handwriting, used for one thing only: a recipe author's name, so it reads as
 * a person's and not as interface text. Caveat is a variable face (weights 400
 * to 700, one small file) with Latin-extended coverage for names such as
 * "Zoë Jõgi". Like the other faces it is self-hosted at build
 * time (the Content Security Policy allows fonts only from this site) and not
 * preloaded, since only recipe pages use it. Unlike them it is `swap`, not
 * `optional`: `optional` would skip it on a first visit, and a handwriting
 * face that never appears defeats its purpose. The name is one short line set
 * in a size-matched fallback until the face arrives, so little moves.
 */
const hand = Caveat({
  variable: '--font-hand-face',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: false,
});

const TITLE = SITE_NAME;
const DEFAULT_TITLE = SITE_TITLE;
const DESCRIPTION = SITE_DESCRIPTION;

/**
 * What every page says about itself unless it says otherwise: the title and
 * description, the social card, and the home-screen look on iOS. Pages override
 * the parts they need to (their own title, or the right to be indexed).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DESCRIPTION,
  // Private by default: almost every page is someone's own recipes, so crawlers
  // are told to keep out. The two public pages (the home page for signed-out
  // visitors, and privacy) opt back in on their own. robots.txt and an
  // X-Robots-Tag header (see lib/http/headers.ts) say the same thing.
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: TITLE,
    locale: 'en_US',
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  applicationName: TITLE,
  // iOS: open from the home screen without Safari's chrome, in the brand colour.
  appleWebApp: { capable: true, title: TITLE, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
  },
};

/** How phones lay the page out, and the colour of the browser's own chrome. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The marigold of the header strip, so Chrome's address bar on Android and
  // the installed app's title bar take the brand colour.
  themeColor: '#ffb100',
  // The site has no dark theme. Saying so stops Android's "auto dark" from
  // inverting the pages and keeps form controls and scrollbars light.
  colorScheme: 'only light',
};

/**
 * The document every page sits in: the language, the typefaces, the page
 * colours, and the service worker that makes the app installable. The site's
 * header and footer are added one level down, in the `(site)` layout, so the
 * not-found and error pages can use a plainer frame.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${hand.variable} h-full antialiased`}
    >
      <body className="bg-paper text-ink flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
