import { notFound } from 'next/navigation';
import {
  DM_Serif_Display,
  Newsreader,
  Playfair_Display,
  Source_Serif_4,
} from 'next/font/google';
import type { ReactNode } from 'react';

import { DesignRoot } from '@/design/design-root';

// Candidate display faces, loaded only for the sandbox so they can be compared.
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});
const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});
const dmSerif = DM_Serif_Display({
  variable: '--font-dm-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
});

/**
 * The design sandbox: sample-data mock-ups of the redesign, for trying looks in
 * the browser without signing in. It only exists in development; in production
 * these routes don't exist.
 */
export default function DesignLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return (
    <DesignRoot
      fontClassNames={`${newsreader.variable} ${playfair.variable} ${sourceSerif.variable} ${dmSerif.variable}`}
    >
      {children}
    </DesignRoot>
  );
}
