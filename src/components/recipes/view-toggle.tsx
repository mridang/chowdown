'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactElement } from 'react';

import { viewCookie, type ListView } from '@/components/recipes/list-view';
import { Segmented } from '@/components/ui/segmented';

/** The choices, as the segmented control shows them. */
const OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
] as const satisfies readonly { value: ListView; label: string }[];

/**
 * The control that switches the recipe listing between its grid and list
 * layouts. The choice is remembered in a cookie (see `list-view.ts`) and the
 * page is then asked for again, so the server draws it in the new layout. The
 * control itself answers at once, without waiting for the page.
 */
export function ViewToggle({
  value,
}: Readonly<{
  /** The layout the server drew the page in. */
  value: ListView;
}>): ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [chosen, setChosen] = useState(value);
  // A layout the server draws that is not the one chosen here (the page was
  // reloaded from another tab's choice, say) wins.
  const [drawn, setDrawn] = useState(value);
  if (value !== drawn) {
    setDrawn(value);
    setChosen(value);
  }

  return (
    <Segmented<ListView>
      label="Layout"
      value={chosen}
      options={OPTIONS}
      onValueChange={(next) => {
        setChosen(next);
        // eslint-disable-next-line unicorn/no-document-cookie -- tried cookieStore.set: it is async and missing from Firefox and older Safari, and the cookie must be written before router.refresh() reads it
        document.cookie = viewCookie(next, location.protocol === 'https:');
        startTransition(() => router.refresh());
      }}
    />
  );
}
