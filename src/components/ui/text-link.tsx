import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

/** How the link is drawn: `inline` among words, `strong` when it stands alone. */
const VARIANTS = {
  /** An ordinary link inside running text. */
  inline: 'text-ember underline underline-offset-4 hover:text-ink',
  /** A standalone link with a bit more weight, such as "Watch the video". */
  strong: 'font-semibold underline underline-offset-4',
} as const;

/**
 * A link that reads as a link: underlined, in the text's own weight. External
 * addresses open in a new tab without handing the other site a reference to
 * this window.
 */
export function TextLink({
  href,
  variant = 'inline',
  external,
  className,
  children,
}: Readonly<{
  href: string;
  variant?: keyof typeof VARIANTS;
  /** The address is on another site: open it in a new tab. */
  external?: boolean;
  className?: string;
  children: ReactNode;
}>): ReactElement {
  const classes = cn(
    'focus-ring rounded-control',
    VARIANTS[variant],
    className,
  );
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
