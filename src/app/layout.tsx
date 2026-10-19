import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
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
};

/**
 * The document every page sits in: the language, the two typefaces, the page
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
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="bg-paper text-ink flex min-h-full flex-col overflow-x-hidden font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
