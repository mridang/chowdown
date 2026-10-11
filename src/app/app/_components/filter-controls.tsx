'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { FacetView } from '@/lib/recipe/facet-filter';

/**
 * The search box and facet sidebar. Both drive the URL query string, so the
 * server component re-renders a freshly filtered list — the filter state lives
 * in the URL (shareable, bookmarkable), not in client state. This island only
 * translates clicks into navigations.
 */
export function FilterControls({ facets }: { facets: FacetView[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get('q') ?? '');

  // Keep the box in sync if the URL changes from elsewhere (e.g. back button).
  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  /** Push a new query string built from the current one plus `mutate`. */
  const navigate = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  const submitSearch = useCallback(
    (value: string) => {
      navigate((next) => {
        const v = value.trim();
        if (v) {
          next.set('q', v);
        } else {
          next.delete('q');
        }
      });
    },
    [navigate],
  );

  /** Toggle one value within a facet's CSV param. */
  const toggle = useCallback(
    (key: string, value: string) => {
      navigate((next) => {
        const current = (next.get(key) ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const has = current.some((v) => v.toLowerCase() === value.toLowerCase());
        const updated = has
          ? current.filter((v) => v.toLowerCase() !== value.toLowerCase())
          : [...current, value];
        if (updated.length > 0) {
          next.set(key, updated.join(','));
        } else {
          next.delete(key);
        }
      });
    },
    [navigate],
  );

  const hasActive =
    facets.some((f) => f.values.some((v) => v.active)) || q.trim().length > 0;

  const clearAll = useCallback(() => {
    setQ('');
    router.push(pathname);
  }, [pathname, router]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => submitSearch(q)}
          placeholder="Search recipes…"
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />
      </form>

      {hasActive ? (
        <button
          type="button"
          onClick={clearAll}
          className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Clear all filters
        </button>
      ) : null}

      {facets.map((facet) => (
        <section key={facet.key} className="mt-5">
          <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            {facet.label}
          </h3>
          <ul className="mt-2 flex flex-col gap-0.5">
            {facet.values.map((v) => (
              <li key={v.value}>
                <button
                  type="button"
                  onClick={() => toggle(facet.key, v.value)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm transition hover:bg-slate-50 ${
                    v.active
                      ? 'font-semibold text-amber-800'
                      : 'text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`grid h-3.5 w-3.5 place-items-center rounded-sm border text-[10px] ${
                        v.active
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {v.active ? '✓' : ''}
                    </span>
                    {v.value}
                  </span>
                  <span className="text-xs text-slate-400">{v.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
