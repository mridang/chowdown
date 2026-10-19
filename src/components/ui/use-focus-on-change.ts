'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Whether focus should move to the heading, given the last step it was moved
 * for and the step being shown now.
 *
 * @param seen The step focus was last moved for (or the one already showing at
 *   mount), `null` if none yet.
 * @param key The step showing now; `null` means "no step to announce".
 */
export function shouldMoveFocus(
  seen: string | null,
  key: string | null,
): boolean {
  return key !== null && key !== seen;
}

/**
 * Keep keyboard and screen-reader focus with the content when a page swaps one
 * step for the next (a wizard going from "paste" to "review").
 *
 * The button that was pressed to move on is usually part of what is replaced;
 * when it unmounts the browser drops focus to the page itself, so the next Tab
 * starts from the top and a screen reader says nothing of the new step. Put the
 * returned ref on the new step's heading, which needs `tabIndex={-1}` so it can
 * take focus without joining the Tab order, and focus moves there whenever `key`
 * changes.
 *
 * @param key Names the step on show; focus moves when it changes. `null` for a
 *   moment when there is nothing to focus.
 * @param seen The step already in focus when the component first renders: leave
 *   it out to start where the page starts (no focus move on first render), or
 *   pass `null` to move focus on first render too, for a step the person has
 *   just opened by pressing a button elsewhere.
 * @returns A ref for the heading.
 */
export function useFocusOnChange<T extends HTMLElement>(
  key: string | null,
  seen: string | null = key,
): RefObject<T | null> {
  const target = useRef<T>(null);
  const last = useRef<string | null>(seen);
  useEffect(() => {
    if (shouldMoveFocus(last.current, key)) {
      target.current?.focus();
    }
    last.current = key;
  }, [key]);
  return target;
}
