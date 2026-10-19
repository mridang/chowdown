'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import {
  findAuthor,
  findAuthorMessage,
  type FindAuthorState,
} from '@/components/recipe/find-author';

/**
 * A small text button, in the place where the author line would be, for a
 * recipe that has a source page but no author yet. It asks the server to read
 * the source page and save the author into the recipe, then refreshes the page
 * so the author line appears in its place. Finding nothing is an ordinary
 * answer and is said quietly; being unable to ask (Drive not connected, the
 * site unreachable) says why. A status line announces each step to screen
 * readers.
 */
export function FindAuthorButton({
  recipeId,
  connectHref,
}: Readonly<{
  /** The recipe's Drive file id. */
  recipeId: string;
  /** Where to send someone whose Drive is not connected, so they can fix it. */
  connectHref: string;
}>): ReactElement {
  const router = useRouter();
  const [state, setState] = useState<FindAuthorState>({ kind: 'idle' });
  const busy = state.kind === 'busy';
  // Once it has answered, "found", "none" and "connect" are the end of it; only
  // a failure leaves the button there to try again.
  const canAsk =
    state.kind === 'idle' || state.kind === 'busy' || state.kind === 'failed';
  const message = findAuthorMessage(state);

  const ask = async () => {
    setState({ kind: 'busy' });
    const outcome = await findAuthor(recipeId);
    setState(outcome);
    if (outcome.kind === 'found') {
      router.refresh();
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 text-sm print:hidden">
      {canAsk ? (
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void ask()}
          className="text-muted hover:text-ink focus-ring rounded-control inline-flex h-8 items-center font-medium underline underline-offset-4 disabled:cursor-wait disabled:no-underline"
        >
          Find the author
        </button>
      ) : null}
      {/* Always in the page, even when empty, so a screen reader is already
          watching it when the first message arrives. */}
      <p role="status" className="text-subtle">
        {message}
      </p>
      {state.kind === 'drive-not-connected' ? (
        // A plain link, not `next/link`: the connect route redirects to Google,
        // which the client router cannot follow.
        <a
          href={connectHref}
          className="focus-ring rounded-control font-semibold underline underline-offset-4"
        >
          Connect Google Drive
        </a>
      ) : null}
    </div>
  );
}
