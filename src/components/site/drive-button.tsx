import type { ReactElement } from 'react';

import { DriveIcon } from '@/components/icons';
import { ButtonLink, buttonClass } from '@/components/ui/button';

import { NEW_TAB, type DriveLink } from './drive-link';

/**
 * The words on the button. Below `xl` the header has no room for them beside
 * the other buttons, so they fold away visually and the logo stands alone; they
 * stay for screen readers either way (`sr-only` takes them out of the layout,
 * so no gap is left beside the icon).
 */
function ButtonLabel({
  children,
}: Readonly<{ children: string }>): ReactElement {
  return <span className="max-xl:sr-only">{children}</span>;
}

/**
 * The header's Google Drive button, always present for a signed-in person.
 * Not connected, it is an ordinary link to our connect route. Connected, it
 * opens Google Drive itself in a new tab: a link out of the app, so it carries
 * `rel="noopener noreferrer"` (the new page gets no handle back to this one)
 * and says so to screen readers. Either way it wears the Drive logo, which is all that shows below `xl`.
 */
export function DriveButton({
  link,
  className,
}: Readonly<{
  link: DriveLink;
  /** Extra layout classes, such as which screen sizes show it. */
  className?: string;
}>): ReactElement {
  if (!link.external) {
    return (
      <ButtonLink href={link.href} variant="outline" className={className}>
        <DriveIcon size="md" />
        <ButtonLabel>{link.label}</ButtonLabel>
      </ButtonLink>
    );
  }
  return (
    <a
      href={link.href}
      {...NEW_TAB}
      className={buttonClass({ variant: 'outline', className })}
    >
      <DriveIcon size="md" />
      <ButtonLabel>{link.label}</ButtonLabel>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
