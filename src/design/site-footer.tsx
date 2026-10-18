import Link from 'next/link';

import { PanIcon, SparkIcon } from './icons';
import { Logo } from './site-header';
import { CopyField } from './ui/copy-field';
import { Container } from './ui/layout';

/** The address assistants connect to. */
export const MCP_URL = 'https://chowdown.apps.mrida.ng/api/mcp';

/**
 * The jagged edge above the footer: one flame-orange polygon whose top edge
 * climbs and falls in broad peaks, tall enough to read as a landscape. It
 * scales with the width (the ratio stays 1512:240).
 */
function ZigZag() {
  return (
    <svg
      viewBox="0 0 1512 240"
      className="text-flame block h-auto w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        fill="currentColor"
        d="M0 0V239.461H1511.78L1511.57 87.2116L922.286 214.468L793.24 62.2531L383.847 166.712L0 0Z"
      />
    </svg>
  );
}

const LINKS: [string, string][][] = [
  [
    ['Contact', '/design/home'],
    ['Cooklang', 'https://cooklang.org'],
    ['Privacy', '/privacy'],
    ['Terms', '/design/home'],
  ],
  [
    ['Recipes', '/design/search'],
    ['Favourites', '/design/search?fav=1'],
    ['Connect AI', '/design/connect'],
    ['How it works', '/design/home'],
  ],
];

/**
 * The footer, built like Gran Luchito's: a tall zigzag edge, then a flame block
 * with the black wordmark and a call to action on the left, two columns of small
 * caps links in the middle and a column on the right, then a thin marigold strip
 * with the small print. The call to action here is the MCP address.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-24 sm:mt-32">
      <PanIcon
        className="text-flame/10 pointer-events-none absolute -top-4 left-[10%] h-28 w-28 sm:-top-14 sm:h-44 sm:w-44"
        strokeWidth={1}
      />
      <SparkIcon
        className="text-flame/10 pointer-events-none absolute -top-2 right-[8%] h-20 w-20 sm:-top-10 sm:h-32 sm:w-32"
        strokeWidth={1}
      />
      <ZigZag />
      <div className="bg-flame text-ink -mt-px">
        <Container className="grid grid-cols-1 gap-12 pt-2 pb-14 md:grid-cols-[1.3fr_auto_1fr] md:gap-16 md:pb-16">
          <div>
            <Logo className="origin-left scale-125" />
            <h2 className="font-display mt-10 text-3xl font-semibold uppercase">
              Cook with your AI
            </h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed">
              Add chowdown to ChatGPT or Claude with one address. Sign in,
              approve, and ask for dinner ideas from recipes you already trust.
            </p>
            <div className="mt-5 max-w-md">
              <CopyField
                value={MCP_URL}
                label="MCP server address"
                tone="onFlame"
              />
            </div>
          </div>

          <div className="flex gap-12 md:gap-14">
            {LINKS.map((column, i) => (
              <ul
                key={i}
                className="flex flex-col gap-3 text-sm font-semibold uppercase"
              >
                {column.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>

          <div className="md:justify-self-end">
            <h2 className="font-display text-3xl font-semibold uppercase">
              Your kitchen
            </h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm font-semibold uppercase">
              <li>
                <Link href="/design/connect" className="hover:underline">
                  Connected apps
                </Link>
              </li>
              <li>
                <Link href="/design/search" className="hover:underline">
                  Add a recipe
                </Link>
              </li>
              <li>
                <Link href="/design/home" className="hover:underline">
                  Sign out
                </Link>
              </li>
            </ul>
          </div>
        </Container>
      </div>
      <div className="bg-marigold">
        <Container className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 py-3 text-xs">
          <span>
            © 2026 chowdown. Your recipes stay in your own Google Drive.
          </span>
          <span className="text-ink/70">Made with Cooklang</span>
        </Container>
      </div>
    </footer>
  );
}
