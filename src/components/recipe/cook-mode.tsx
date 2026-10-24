'use client';

import { useEffect, useState, type ReactElement } from 'react';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
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
import type { StepToken } from '@/lib/cooklang/cooklang';
import { stepText } from '@/lib/recipe/page-view';

import { ReadAloudButton } from '@/components/recipe/read-aloud';
import { StepBody } from '@/components/recipe/step-body';
import { TimerTray } from '@/components/recipe/timer-tray';
import {
  useStepTimers,
  StepTimersContext,
} from '@/components/recipe/use-step-timers';
import { useWakeLock } from '@/components/recipe/use-wake-lock';

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
 * Whether the target of a key press is somewhere the person is typing or
 * choosing with the arrow keys (a text box, a list, a slider, rich text), where
 * the arrows belong to that control and must not also turn the recipe's page.
 * Looks at the element's shape rather than its class, so it needs no DOM
 * classes and can be checked with a plain object.
 */
export function usesArrowKeys(target: EventTarget | null): boolean {
  if (typeof target !== 'object' || target === null) {
    return false;
  }
  const tag =
    'tagName' in target && typeof target.tagName === 'string'
      ? target.tagName.toUpperCase()
      : '';
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    ('isContentEditable' in target && target.isContentEditable === true)
  );
}

/**
 * How far a key press moves through the steps in cook mode. Like
 * {@link stepOffsetForKey}, but zero as well when the key is meant for
 * something else: a modified press (Alt+Left is the browser's Back), one
 * already handled, or one aimed at a control that uses the arrows itself.
 */
export function stepOffsetForEvent(
  event: Readonly<
    Pick<
      KeyboardEvent,
      'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'defaultPrevented'
    > & { target: EventTarget | null }
  >,
): -1 | 0 | 1 {
  const modified =
    event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  return modified || event.defaultPrevented || usesArrowKeys(event.target)
    ? 0
    : stepOffsetForKey(event.key);
}

/**
 * Cook mode: a full-screen view for use at the stove. One step at a time in
 * large type, the other steps dimmed within reach, a progress bar, arrow-key
 * and button navigation, the screen kept awake while it is open (and again
 * after the tab has been hidden), step timers that count down and ring, and a
 * button that reads the step aloud where the browser can speak.
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
  useWakeLock(open);
  // The timers live here, above the dialog, so they carry on while the cook
  // moves between steps; they are cleared when cook mode closes.
  const timers = useStepTimers(title);

  // Left and right arrows move between steps.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      const offset = stepOffsetForEvent(event);
      if (offset !== 0) {
        setIndex((i) => clampStep(i + offset, steps.length));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, steps.length]);

  const last = steps.length - 1;
  const changeOpen = (next: boolean): void => {
    setOpen(next);
    if (next) {
      setIndex(0);
    } else {
      timers.clear();
    }
  };
  return (
    <StepTimersContext.Provider value={timers}>
      <Dialog open={open} onOpenChange={changeOpen}>
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
              <DialogDescription className="mt-1 text-sm text-subtle">
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
                      i === index
                        ? 'text-3xl sm:text-5xl'
                        : 'text-xl text-muted',
                    )}
                  >
                    {/* The number badge is decorative, and the list may have lost its numbering. */}
                    <span className="sr-only">Step {i + 1}: </span>
                    {i === index ? (
                      <StepBody tokens={step} stepIndex={i} />
                    ) : (
                      stepText(step)
                    )}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mb-4 flex">
              <ReadAloudButton
                key={index}
                tokens={steps[index] ?? []}
                number={index + 1}
              />
            </div>

            <TimerTray timers={timers} />
            {/* Told to screen readers politely when a timer finishes. */}
            <p role="status" className="sr-only">
              {timers.announcement}
            </p>

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
                <Button size="lg" onClick={() => changeOpen(false)}>
                  Done cooking
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() =>
                    setIndex((i) => clampStep(i + 1, steps.length))
                  }
                >
                  Next
                  <ChevronRightIcon size="md" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </StepTimersContext.Provider>
  );
}
