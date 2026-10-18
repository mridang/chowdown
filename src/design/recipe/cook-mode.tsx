'use client';

import { useEffect, useState } from 'react';

import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon } from '../icons';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

/**
 * Cook mode: a full-screen view for use at the stove. One step at a time in
 * large type, the other steps dimmed within reach, a progress bar, arrow-key
 * and button navigation, and the screen kept awake while it is open.
 */
export function CookMode({ title, steps }: { title: string; steps: string[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Keep the screen from sleeping while cooking, where the browser allows it.
  useEffect(() => {
    if (!open || !('wakeLock' in navigator)) {
      return;
    }
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        lock = sentinel;
      })
      .catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, [open]);

  // Left and right arrows move between steps.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex((i) => Math.min(steps.length - 1, i + 1));
      } else if (event.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, steps.length]);

  const last = steps.length - 1;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setIndex(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent" size="lg">
          <ExpandIcon className="h-[18px] w-[18px]" />
          Cook mode
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel="Leave cook mode">
        <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 pt-5 pb-8 sm:px-10">
          <div className="pr-12">
            <DialogTitle className="font-display text-xl font-semibold sm:text-2xl">
              {title}
            </DialogTitle>
            <DialogDescription className="text-ink/65 mt-1 text-sm">
              Step {index + 1} of {steps.length}. Use the arrow keys or the
              buttons.
            </DialogDescription>
          </div>
          <div
            className="bg-ink/10 mt-4 h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={index + 1}
          >
            <div
              className="bg-flame h-full rounded-full transition-all"
              style={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>

          <ol className="my-auto flex flex-col gap-6 py-10">
            {steps.map((step, i) => (
              <li
                key={`${i}-${step.slice(0, 10)}`}
                aria-current={i === index ? 'step' : undefined}
                className={cn(
                  'flex gap-5 transition-opacity',
                  i === index ? 'opacity-100' : 'hidden opacity-30 sm:flex',
                  Math.abs(i - index) > 1 && 'sm:hidden',
                )}
              >
                <span
                  className={cn(
                    'grid shrink-0 place-items-center rounded-full font-semibold',
                    i === index
                      ? 'h-12 w-12 bg-flame text-xl text-ink'
                      : 'h-9 w-9 bg-ink/10 text-base text-ink/70',
                  )}
                >
                  {i + 1}
                </span>
                <p
                  className={cn(
                    'font-display leading-snug font-medium',
                    i === index
                      ? 'text-3xl sm:text-5xl'
                      : 'text-xl text-ink/70',
                  )}
                >
                  {step}
                </p>
              </li>
            ))}
          </ol>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="disabled:opacity-40"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              Back
            </Button>
            {index === last ? (
              <Button size="lg" onClick={() => setOpen(false)}>
                Done cooking
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => setIndex((i) => Math.min(last, i + 1))}
              >
                Next
                <ChevronRightIcon className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
