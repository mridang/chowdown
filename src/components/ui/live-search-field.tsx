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
  param: parameter = 'q',
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
      [parameter]: parseAsString.withDefault(''),
      ...Object.fromEntries(resets.map((name) => [name, parseAsString])),
    }),
    [parameter, resets],
  );
  const [values, setValues] = useQueryStates(parsers, {
    shallow: false,
    scroll: false,
    history: 'replace',
    startTransition,
    limitUrlUpdates: debounce(PAUSE_MS),
  });
  const text = values[parameter] ?? '';

  /** Put the text in the address, clearing the parameters that depend on it. */
  const update = async (next: string, options?: Options) =>
    setValues(
      {
        [parameter]: next.trim() === '' ? null : next,
        ...Object.fromEntries(resets.map((name) => [name, null])),
      },
      options,
    );

  return (
    <SearchField
      {...props}
      name={parameter}
      value={text}
      aria-busy={pending}
      onChange={(event) => void update(event.target.value)}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.key === 'Enter') {
          event.preventDefault();
          void update(event.currentTarget.value, {
            limitUrlUpdates: debounce(0),
          });
        }
      }}
    />
  );
}
