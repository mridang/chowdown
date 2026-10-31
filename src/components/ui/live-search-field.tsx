'use client';

import { debounce, parseAsString, useQueryStates, type Options } from 'nuqs';
import {
  useMemo,
  useTransition,
  type ComponentProps,
  type ReactElement,
} from 'react';

import { SearchField } from '@/components/ui/field';

/** How long typing must pause before the address is updated, in milliseconds. */
const PAUSE_MS = 200;

/**
 * A search box that updates the page as you type. The text lives in one query
 * parameter of the address, so the page (a Server Component reading its
 * `searchParams`) re-renders with the results while every other parameter, such
 * as filters and order, stays as it is. The address is updated once typing
 * pauses, replacing the current history entry so the Back button is not filled
 * with half-typed words, and the old results stay on screen until the new ones
 * arrive. Enter updates the address at once, and the surrounding form (the one
 * that works without JavaScript) is not submitted.
 */
export function LiveSearchField({
  param = 'q',
  resets = [],
  ...props
}: Readonly<
  {
    /** The query parameter that holds the text. */
    param?: string;
    /** Parameters to drop when the text changes, such as the page size of "Show more". */
    resets?: readonly string[];
  } & Omit<
    ComponentProps<typeof SearchField>,
    'name' | 'value' | 'defaultValue' | 'onChange' | 'type'
  >
>): ReactElement {
  const [pending, startTransition] = useTransition();
  const parsers = useMemo(
    () => ({
      [param]: parseAsString.withDefault(''),
      ...Object.fromEntries(resets.map((name) => [name, parseAsString])),
    }),
    [param, resets],
  );
  const [values, setValues] = useQueryStates(parsers, {
    shallow: false,
    scroll: false,
    history: 'replace',
    startTransition,
    limitUrlUpdates: debounce(PAUSE_MS),
  });
  const text = values[param] ?? '';

  /** Put the text in the address, clearing the parameters that depend on it. */
  const update = (next: string, options?: Options) =>
    setValues(
      {
        [param]: next.trim() === '' ? null : next,
        ...Object.fromEntries(resets.map((name) => [name, null])),
      },
      options,
    );

  return (
    <SearchField
      {...props}
      name={param}
      value={text}
      aria-busy={pending}
      onChange={(e) => void update(e.target.value)}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (e.key === 'Enter') {
          e.preventDefault();
          void update(e.currentTarget.value, { limitUrlUpdates: debounce(0) });
        }
      }}
    />
  );
}
