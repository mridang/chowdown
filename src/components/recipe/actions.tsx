'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import {
  CheckIcon,
  PrinterIcon,
  ShareIcon,
  SparkIcon,
  TrashIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { problemError, problemText } from '@/lib/problem-message';
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
 * Whether the auto-tag endpoint's answer says the recipe was tagged. The body
 * comes off the network, so it is checked rather than trusted: anything but
 * `{ "tagged": true }` counts as "not tagged".
 */
export function wasTagged(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'tagged' in body &&
    body.tagged === true
  );
}

/** How auto-tagging ended, and the sentence to show for it. */
export type AutoTagOutcome = Readonly<{ tagged: boolean; message: string }>;

/**
 * Ask the server to tag a recipe (`POST /rpc/tag-recipe`) and say how it went.
 * Never throws: a refusal carries the server's own words, anything else a fixed
 * sentence.
 */
export async function requestAutoTag(
  recipeId: string,
): Promise<AutoTagOutcome> {
  try {
    const res = await fetch('/rpc/tag-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId }),
    });
    if (!res.ok) {
      throw await problemError(res);
    }
    return wasTagged(await res.json())
      ? { tagged: true, message: 'Tags updated.' }
      : { tagged: false, message: "Couldn't tag this one." };
  } catch (error) {
    return { tagged: false, message: problemText(error, 'Tagging failed.') };
  }
}

/**
 * The less-used actions, tucked in a menu: auto-tag the recipe (Workers AI
 * classifies it against the curated taxonomy and writes the tags into the
 * `.cook` file), print it, or delete it after a confirmation.
 *
 * Progress and failures are announced in a small status message at the foot of
 * the screen, since the menu closes as soon as an item is chosen.
 */
export function MoreMenu({
  recipeId,
  title,
}: Readonly<{
  recipeId: string;
  title: string;
}>): ReactElement {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState('');
  const [tagging, setTagging] = useState(false);
  const clear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuRoot = useRef<HTMLDivElement>(null);
  const deleteWasOpen = useRef(false);

  // Show a message for a few seconds, then let it go.
  const say = (message: string) => {
    clearTimeout(clear.current);
    setStatus(message);
    clear.current = setTimeout(() => setStatus(''), 4000);
  };
  useEffect(() => () => clearTimeout(clear.current), []);

  // When the delete dialog closes, give focus back to the menu button. This is
  // an effect, not part of the close handler, so it runs after the dialog has
  // finished closing (the page behind a modal is inert and cannot take focus).
  useEffect(() => {
    if (deleteWasOpen.current && !confirmingDelete) {
      focusMoreActionsButton(menuRoot.current);
    }
    deleteWasOpen.current = confirmingDelete;
  }, [confirmingDelete]);

  const autoTag = async () => {
    setTagging(true);
    say('Tagging this recipe…');
    const outcome = await requestAutoTag(recipeId);
    say(outcome.message);
    if (outcome.tagged) {
      router.refresh();
    }
    setTagging(false);
  };

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
            disabled={tagging}
            onClick={() => void autoTag()}
            className={POPOVER_ITEM}
          >
            <SparkIcon size="menu" className="text-subtle" />
            Auto-tag
          </button>
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

      <p
        role="status"
        className={
          status
            ? 'rounded-control bg-ink fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4 py-2 text-sm font-medium text-white print:hidden'
            : 'sr-only'
        }
      >
        {status}
      </p>
    </>
  );
}
