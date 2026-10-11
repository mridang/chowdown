'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Grid/list toggle for the recipe listing. The mode lives in the URL (`?view=`)
 * so the server renders the chosen layout — this island only writes the param.
 */
export function ViewToggle({ view }: { view: 'grid' | 'list' }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = useCallback(
    (next: 'grid' | 'list') => {
      const p = new URLSearchParams(params.toString());
      if (next === 'grid') {
        p.delete('view'); // grid is the default
      } else {
        p.set('view', next);
      }
      const qs = p.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  return (
    <div className="flex items-center rounded-md border border-slate-200 p-0.5">
      <button
        type="button"
        onClick={() => set('grid')}
        aria-label="Grid view"
        aria-pressed={view === 'grid'}
        className={`grid h-7 w-7 place-items-center rounded ${
          view === 'grid' ? 'bg-slate-100 text-slate-800' : 'text-slate-400'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => set('list')}
        aria-label="List view"
        aria-pressed={view === 'list'}
        className={`grid h-7 w-7 place-items-center rounded ${
          view === 'list' ? 'bg-slate-100 text-slate-800' : 'text-slate-400'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="3" rx="1" />
          <rect x="3" y="10.5" width="18" height="3" rx="1" />
          <rect x="3" y="17" width="18" height="3" rx="1" />
        </svg>
      </button>
    </div>
  );
}
