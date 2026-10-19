'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

import {
  findMissingAuthors,
  progressText,
  summaryText,
  type BatchRun,
  type BatchTotals,
} from '@/components/recipe/find-author';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

/** Where the sweep is: not started, under way (with the totals so far), or ended. */
type Sweep =
  | Readonly<{ phase: 'idle' }>
  | Readonly<{ phase: 'running'; totals: BatchTotals | undefined }>
  | Readonly<{ phase: 'finished'; run: BatchRun }>;

/** The line read out in the dialog's live region for a sweep in its current state. */
function statusText(sweep: Sweep): string {
  switch (sweep.phase) {
    case 'idle':
      return '';
    case 'running':
      return sweep.totals ? progressText(sweep.totals) : 'Starting…';
    case 'finished':
      return summaryText(sweep.run);
  }
}

/**
 * The bulk "Find missing authors" action, in the account menu: reads the
 * author from the source page of every saved recipe that has one but no author,
 * a few at a time. It shows "Found N so far, M left" as it goes in a polite
 * live region, can be cancelled at any moment (what was already found is
 * kept), and ends with a one-line summary; if the server refuses (too many
 * requests, Drive not connected) it stops and says why. While it runs the
 * dialog cannot be dismissed and Start is disabled, so a second sweep can never
 * start on top of the first; leaving the page cancels the one in flight.
 *
 * It is controlled by its parent, because it is opened from a menu item that
 * unmounts as soon as the menu closes.
 */
export function FindAuthorsDialog({
  open,
  onOpenChange,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>): ReactElement {
  const [sweep, setSweep] = useState<Sweep>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const running = sweep.phase === 'running';

  // Leaving the page (or the menu unmounting) must not leave requests going on.
  useEffect(() => () => controller.current?.abort(), []);

  const start = async () => {
    const own = new AbortController();
    controller.current = own;
    setSweep({ phase: 'running', totals: undefined });
    const run = await findMissingAuthors({
      signal: own.signal,
      onProgress: (totals) => setSweep({ phase: 'running', totals }),
    });
    setSweep({ phase: 'finished', run });
  };

  // A closed dialog starts fresh: last time's summary is not news.
  const close = () => {
    setSweep({ phase: 'idle' });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) {
          return;
        }
        return next ? onOpenChange(true) : close();
      }}
    >
      <DialogContent
        variant="center"
        showClose={false}
        dismissable={!running}
        className="p-6"
      >
        <DialogTitle className="font-display text-xl font-semibold">
          Find missing authors
        </DialogTitle>
        <DialogDescription className="text-muted mt-2 text-sm leading-relaxed">
          For each recipe that has a source page but no author, chowdown reads
          the author from that page and saves it into the recipe. This can take
          a few minutes. You can stop at any time; what is found is kept.
        </DialogDescription>
        {/* In the page from the start, even empty, so a screen reader is
            already watching it when the first line arrives. */}
        <p role="status" className="text-ink mt-4 min-h-6 text-sm font-medium">
          {statusText(sweep)}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          {running ? (
            <Button
              variant="outline"
              onClick={() => controller.current?.abort()}
            >
              Cancel
            </Button>
          ) : (
            <Button variant="outline" onClick={close}>
              {sweep.phase === 'finished' ? 'Close' : 'Cancel'}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={running}
            onClick={() => void start()}
          >
            {sweep.phase === 'finished' ? 'Run again' : 'Start'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
