'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

import {
  CheckIcon,
  PrinterIcon,
  ShareIcon,
  TrashIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  POPOVER_ITEM,
  Popover,
  PopoverSeparator,
} from '@/components/ui/popover';

import { DeleteDialog } from './delete-dialog';

/** What the parts of the browser used to share a link look like, so they can be stood in for. */
type ShareEnvironment = Readonly<{
  share?: (data: { title: string; url: string }) => Promise<void>;
  clipboard?: Readonly<{ writeText: (text: string) => Promise<void> }>;
}>;

/**
 * Share a link with the device's own share sheet where there is one, otherwise
 * copy it to the clipboard.
 *
 * Resolves to what happened: `shared` (the sheet was used, or was dismissed,
 * which needs no reply), `copied` (the caller should say so), or `failed` (the
 * clipboard refused: an insecure page, a denied prompt).
 *
 * @param environment The browser's `navigator`, or a stand-in.
 * @param link The title and address to share.
 */
export async function shareLink(
  environment: ShareEnvironment,
  link: Readonly<{ title: string; url: string }>,
): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof environment.share === 'function') {
    try {
      await environment.share(link);
    } catch {
      // The share sheet was dismissed; nothing to do.
    }
    return 'shared';
  }
  try {
    await environment.clipboard?.writeText(link.url);
  } catch {
    return 'failed';
  }
  return environment.clipboard ? 'copied' : 'failed';
}

/**
 * Share the recipe using the device's own share sheet where there is one (phones,
 * and many desktops); otherwise copy the address and say so.
 */
export function ShareButton({
  title,
}: Readonly<{ title: string }>): ReactElement {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const outcome = await shareLink(navigator, {
      title,
      url: window.location.href,
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <Button
      variant="outline"
      onClick={() => void share()}
      aria-live="polite"
      className="gap-2"
    >
      {copied ? <CheckIcon size="menu" /> : <ShareIcon size="menu" />}
      {copied ? 'Link copied' : 'Share'}
    </Button>
  );
}

/** The accessible name of the menu's button, also how `focusMoreActionsButton` finds it. */
const MORE_ACTIONS_LABEL = 'More actions';

/**
 * Put keyboard focus back on the "More actions" button inside `container`.
 *
 * The delete confirmation is opened from a menu item, and the menu (item
 * included) unmounts the moment it closes. A dialog normally hands focus back to
 * whatever opened it, but that element is gone, so focus would fall to the page
 * body and a keyboard user would lose their place. The button is the nearest
 * thing that is still there.
 */
export function focusMoreActionsButton(
  container: Readonly<{
    querySelector(selector: string): { focus(): void } | null;
  }> | null,
): void {
  container
    ?.querySelector(`button[aria-label="${MORE_ACTIONS_LABEL}"]`)
    ?.focus();
}

/**
 * The less-used actions, tucked in a menu: print the recipe, or delete it after
 * a confirmation.
 */
export function MoreMenu({
  recipeId,
  title,
}: Readonly<{
  recipeId: string;
  title: string;
}>): ReactElement {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRoot = useRef<HTMLDivElement>(null);
  const deleteWasOpen = useRef(false);

  // When the delete dialog closes, give focus back to the menu button. This is
  // an effect, not part of the close handler, so it runs after the dialog has
  // finished closing (the page behind a modal is inert and cannot take focus).
  useEffect(() => {
    if (deleteWasOpen.current && !confirmingDelete) {
      focusMoreActionsButton(menuRoot.current);
    }
    deleteWasOpen.current = confirmingDelete;
  }, [confirmingDelete]);

  return (
    <>
      {/* `contents` keeps this wrapper out of the layout; it only gives the ref. */}
      <div ref={menuRoot} className="contents">
        <Popover
          label={MORE_ACTIONS_LABEL}
          button={<span aria-hidden="true">⋯</span>}
          buttonClassName="rounded-control border-field hover:border-ink grid h-10 w-10 place-items-center border bg-white text-xl leading-none transition focus-ring"
          panelClassName="print:hidden"
        >
          <button
            type="button"
            // Let the menu finish closing so it isn't in the printed page.
            onClick={() => setTimeout(() => window.print(), 150)}
            className={POPOVER_ITEM}
          >
            <PrinterIcon size="menu" className="text-subtle" />
            Print
          </button>
          <PopoverSeparator />
          <button
            type="button"
            className={`${POPOVER_ITEM} text-ember`}
            onClick={() => setConfirmingDelete(true)}
          >
            <TrashIcon size="menu" />
            Delete recipe
          </button>
        </Popover>
      </div>

      <DeleteDialog
        recipeId={recipeId}
        title={title}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
      />
    </>
  );
}
