import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';

import { ServiceWorker } from '@/components/site/service-worker';

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

const TITLE = 'chowdown';
const DEFAULT_TITLE = 'chowdown: your recipes, kept in your own Google Drive';
const DESCRIPTION =
  'Keep every recipe as a plain text file in your own Google Drive, then ' +
  'search, scale and cook from them, and ask your AI assistant what to make.';
const SITE_URL = 'https://chowdown.apps.mrida.ng';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DESCRIPTION,
  // Signed-out visitors only ever see the landing page and the privacy page;
  // everything else sends them to sign in, so there is nothing private to hide
  // from a crawler. (/api and /oauth are disallowed in robots.txt.)
  robots: { index: true, follow: true },
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
    card: 'summary',
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The marigold of the header strip, so Chrome's address bar on Android and
  // the installed app's title bar take the brand colour.
  themeColor: '#ffb100',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
