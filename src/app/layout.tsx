import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';

/** Body face. */
const sans = Inter({ variable: '--font-sans-face', subsets: ['latin'] });

/** Display face for headings: a heavy, friendly grotesque. */
const display = Bricolage_Grotesque({
  variable: '--font-display-face',
  subsets: ['latin'],
});

const TITLE = 'chowdown';
const DESCRIPTION =
  'A viewer for Cooklang (.cook) recipe files opened straight from Google ' +
  'Drive — ingredients, cookware and method with inline highlights.';
const SITE_URL = 'https://chowdown.apps.mrida.ng';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // Keep the site out of search indexes, but social scrapers ignore this
  // and still read the OpenGraph tags below, so share cards keep working.
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary',
    title: TITLE,
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
      </body>
    </html>
  );
}
