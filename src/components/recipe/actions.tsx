'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  CheckIcon,
  PrinterIcon,
  ShareIcon,
  SparkIcon,
  TrashIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';

import { DeleteDialog } from './delete-dialog';

/**
 * Share the recipe using the device's own share sheet where there is one (phones,
 * and many desktops); otherwise copy the address and say so.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch {
        // The share sheet was dismissed; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be refused (an insecure page, a denied prompt).
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button
      variant="outline"
      onClick={() => void share()}
      aria-live="polite"
      className="gap-2"
    >
      {copied ? (
        <CheckIcon className="h-[18px] w-[18px]" />
      ) : (
        <ShareIcon className="h-[18px] w-[18px]" />
      )}
      {copied ? 'Link copied' : 'Share'}
    </Button>
  );
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
}: {
  recipeId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState('');
  const [tagging, setTagging] = useState(false);
  const clear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Show a message for a few seconds, then let it go.
  const say = (message: string) => {
    clearTimeout(clear.current);
    setStatus(message);
    clear.current = setTimeout(() => setStatus(''), 4000);
  };
  useEffect(() => () => clearTimeout(clear.current), []);

  const autoTag = async () => {
    setTagging(true);
    say('Tagging this recipe…');
    try {
      const res = await fetch('/rpc/tag-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId }),
      });
      if (!res.ok) {
        throw new Error(String(res.status));
      }
      const data = (await res.json()) as { tagged: boolean };
      if (data.tagged) {
        say('Tags updated.');
        router.refresh();
      } else {
        say("Couldn't tag this one.");
      }
    } catch {
      say('Tagging failed.');
    } finally {
      setTagging(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          className="rounded-control border-ink/25 hover:border-ink focus-visible:outline-ink grid h-10 w-10 place-items-center border bg-white text-xl leading-none transition outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span aria-hidden="true">⋯</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="print:hidden">
          <DropdownMenuItem disabled={tagging} onSelect={() => void autoTag()}>
            <SparkIcon className="text-ink/65 h-[18px] w-[18px]" />
            Auto-tag
          </DropdownMenuItem>
          <DropdownMenuItem
            // Let the menu finish closing so it isn't in the printed page.
            onSelect={() => setTimeout(() => window.print(), 150)}
          >
            <PrinterIcon className="text-ink/65 h-[18px] w-[18px]" />
            Print
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-ember"
            onSelect={() => setConfirmingDelete(true)}
          >
            <TrashIcon className="h-[18px] w-[18px]" />
            Delete recipe
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
