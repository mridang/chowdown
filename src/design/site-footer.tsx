import Link from 'next/link';

import { Logo } from './site-header';
import { Container } from './ui/layout';

/**
 * A jagged edge, like torn paper, that lets the page background cut into the
 * flame-orange footer. One polygon, so it scales to any width.
 */
function ZigZag() {
  return (
    <svg
      viewBox="0 0 1512 160"
      preserveAspectRatio="none"
      className="text-flame block h-14 w-full sm:h-24"
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
    <footer className="mt-20 sm:mt-28">
      <ZigZag />
      <div className="bg-flame text-ink -mt-px">
        <Container className="grid grid-cols-1 gap-10 pt-2 pb-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-base leading-relaxed">
              Recipes kept as plain text in your own Google Drive. Yours to
              cook, to keep and to take anywhere.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-label font-semibold uppercase">
                {col.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-[15px] font-medium">
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
        </Container>
      </div>
      <div className="bg-marigold">
        <Container className="flex flex-wrap items-center justify-between gap-2 py-4 text-xs font-medium">
          <span>© chowdown</span>
          <span>Made for cooking, not scrolling</span>
        </Container>
      </div>
    </footer>
  );
}
