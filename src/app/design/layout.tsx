import { notFound } from 'next/navigation';
import {
  Bricolage_Grotesque,
  DM_Sans,
  DM_Serif_Display,
  Inter,
  Instrument_Serif,
  Manrope,
  Newsreader,
  Playfair_Display,
  Space_Grotesk,
} from 'next/font/google';
import type { ReactNode } from 'react';

import { DesignRoot } from '@/design/design-root';

// Candidate faces, loaded only for the sandbox so pairings can be compared.
// (Fraunces is already loaded for the whole app.)
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
const dmSerif = DM_Serif_Display({
  variable: '--font-dm-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
});
const instrument = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
});
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
});
const space = Space_Grotesk({ variable: '--font-space', subsets: ['latin'] });
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });

const FONT_VARIABLES = [
  newsreader,
  playfair,
  dmSerif,
  instrument,
  bricolage,
  space,
  inter,
  dmSans,
  manrope,
]
  .map((font) => font.variable)
  .join(' ');

/**
 * The design sandbox: mock-ups of the redesign on real (local) or sample data,
 * for trying looks in the browser without signing in. It only exists in
 * development; in production these routes don't exist.
 */
export default function DesignLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <DesignRoot fontClassNames={FONT_VARIABLES}>{children}</DesignRoot>;
}
