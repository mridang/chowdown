import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
