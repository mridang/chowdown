'use client';

import { useEffect, useState, type ReactElement } from 'react';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExpandIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NumberBadge } from '@/components/ui/number-badge';
import type { StepToken } from '@/lib/recipe/cooklang';
import { stepText } from '@/lib/recipe/page-view';

import { useRecipeState } from './recipe-state';

/**
 * The current step in large type. Ingredients are underlined and followed by
 * the amount for the servings and units chosen, so the number is right there at
 * the stove; timers get a clock.
 */
function StepBody({
  tokens,
}: Readonly<{ tokens: readonly StepToken[] }>): ReactElement {
  const { quantity } = useRecipeState();
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.kind) {
          case 'text':
            return <span key={index}>{token.text}</span>;
          case 'ingredient':
            return (
              <span key={index}>
                <span className="decoration-marigold underline decoration-4 underline-offset-4">
                  {token.name}
                </span>
                {token.quantity ? (
                  <span className="text-subtle text-[0.6em] font-normal">
                    {' '}
                    ({quantity(token.quantity)})
                  </span>
                ) : null}
              </span>
            );
          case 'cookware':
            return (
              <span key={index} className="text-forest">
                {token.name}
              </span>
            );
          case 'timer':
            return (
              <span key={index} className="text-ember whitespace-nowrap">
                <ClockIcon className="mr-1 inline-block h-[0.8em] w-[0.8em] -translate-y-px" />
                {token.label}
              </span>
            );
        }
      })}
    </>
  );
}

/**
 * The step to show after a move: `index` clamped to the steps there are, so
 * "next" on the last step and "back" on the first stay where they are.
 *
 * @param index The step asked for (zero-based), possibly out of range.
 * @param stepCount How many steps the recipe has.
 */
export function clampStep(index: number, stepCount: number): number {
  return Math.max(0, Math.min(stepCount - 1, index));
}

/**
 * How far an arrow key moves through the steps: one forward for the right
 * arrow, one back for the left, and zero for any other key.
 */
export function stepOffsetForKey(key: string): -1 | 0 | 1 {
  switch (key) {
    case 'ArrowRight':
      return 1;
    case 'ArrowLeft':
      return -1;
    default:
      return 0;
  }
}

/**
 * Ask the browser to keep the screen awake and return the function that lets
 * it sleep again. Safe to call at any moment: if the lock is not granted yet
 * when it is released, it is given back the moment it is granted, and if the
 * browser refuses, releasing does nothing.
 *
 * @param wakeLock The browser's wake lock (`navigator.wakeLock`).
 */
export function keepScreenAwake(
  wakeLock: Pick<WakeLock, 'request'>,
): () => void {
  const granted = wakeLock.request('screen').catch(() => undefined);
  return () => {
    void granted.then((sentinel) => sentinel?.release());
  };
}

/**
 * Cook mode: a full-screen view for use at the stove. One step at a time in
 * large type, the other steps dimmed within reach, a progress bar, arrow-key
 * and button navigation, and the screen kept awake while it is open.
 */
export function CookMode({
  title,
  steps,
}: Readonly<{
  title: string;
  steps: readonly (readonly StepToken[])[];
}>): ReactElement {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Keep the screen from sleeping while cooking, where the browser allows it.
  useEffect(() => {
    if (!open || !('wakeLock' in navigator)) {
      return;
    }
    return keepScreenAwake(navigator.wakeLock);
  }, [open]);

  // Left and right arrows move between steps.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      const offset = stepOffsetForKey(event.key);
      if (offset !== 0) {
        setIndex((i) => clampStep(i + offset, steps.length));
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
          <ExpandIcon size="menu" />
          Cook mode
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel="Leave cook mode">
        <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 pt-5 pb-8 sm:px-10">
          <div className="pr-12">
            <DialogTitle className="font-display text-xl font-semibold sm:text-2xl">
              {title}
            </DialogTitle>
            <DialogDescription className="text-subtle mt-1 text-sm">
              Step {index + 1} of {steps.length}. Use the arrow keys or the
              buttons.
            </DialogDescription>
          </div>
          {/*
            One segment per step, filled up to the current one. (Segments rather
            than a bar whose width is set inline, which the Content Security
            Policy would refuse.)
          */}
          <div
            className="mt-4 flex gap-1"
            role="progressbar"
            aria-label="Step"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={index + 1}
          >
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i <= index ? 'bg-flame' : 'bg-ink/10',
                )}
              />
            ))}
          </div>

          <ol className="my-auto flex flex-col gap-6 py-10">
            {steps.map((step, i) => (
              <li
                key={i}
                aria-current={i === index ? 'step' : undefined}
                className={cn(
                  'flex gap-5 transition-opacity',
                  i === index ? 'opacity-100' : 'hidden opacity-30 sm:flex',
                  Math.abs(i - index) > 1 && 'sm:hidden',
                )}
              >
                <NumberBadge
                  value={i + 1}
                  size={i === index ? 'lg' : 'md'}
                  tone={i === index ? 'flame' : 'quiet'}
                />
                <p
                  className={cn(
                    'font-display leading-snug font-medium',
                    i === index ? 'text-3xl sm:text-5xl' : 'text-xl text-muted',
                  )}
                >
                  {/* The number badge is decorative, and the list may have lost its numbering. */}
                  <span className="sr-only">Step {i + 1}: </span>
                  {i === index ? <StepBody tokens={step} /> : stepText(step)}
                </p>
              </li>
            ))}
          </ol>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={index === 0}
              onClick={() => setIndex((i) => clampStep(i - 1, steps.length))}
              className="disabled:opacity-40"
            >
              <ChevronLeftIcon size="md" />
              Back
            </Button>
            {index === last ? (
              <Button size="lg" onClick={() => setOpen(false)}>
                Done cooking
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => setIndex((i) => clampStep(i + 1, steps.length))}
              >
                Next
                <ChevronRightIcon size="md" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
