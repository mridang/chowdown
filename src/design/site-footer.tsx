import Link from 'next/link';

import { Logo } from './site-header';

/**
 * A jagged edge, like torn paper, that lets the page background cut into the
 * flame-orange footer. Drawn as one polygon so it scales to any width.
 */
function ZigZag() {
  return (
    <svg
      viewBox="0 0 1512 160"
      preserveAspectRatio="none"
      className="text-flame block h-20 w-full sm:h-32"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M0 160V70L190 128 430 22 690 120 930 6 1190 112 1360 40 1512 96V160Z"
      />
    </svg>
  );
}

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Cook',
    links: [
      ['All recipes', '/design/search'],
      ['Favourites', '/design/search?fav=1'],
      ['Add a recipe', '/design/home'],
    ],
  },
  {
    title: 'Your kitchen',
    links: [
      ['Connect an assistant', '/design/home'],
      ['Connected apps', '/design/home'],
      ['Sign out', '/design/home'],
    ],
  },
  {
    title: 'chowdown',
    links: [
      ['How it works', '/design/home'],
      ['Privacy', '/privacy'],
      ['Cooklang', 'https://cooklang.org'],
    ],
  },
];

/** The footer: zigzag edge, flame block with the black wordmark, marigold strip. */
export function SiteFooter() {
  return (
    <footer className="mt-24">
      <ZigZag />
      <div className="bg-flame text-ink -mt-px">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-4 pb-14 sm:px-8 md:grid-cols-[1.2fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs font-serif text-lg leading-snug">
              Recipes kept as plain text in your own Google Drive. Yours to
              cook, to keep and to take anywhere.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-lg tracking-wide uppercase">
                {col.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-2 font-serif text-lg">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-ink bg-marigold border-t-2">
        <div className="font-display mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs tracking-wide uppercase sm:px-8">
          <span>© chowdown</span>
          <span>Made for cooking, not scrolling</span>
        </div>
      </div>
    </footer>
  );
}
