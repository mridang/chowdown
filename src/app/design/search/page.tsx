import { CheckIcon, SearchIcon } from '@/design/icons';
import { FACETS, RECIPES, SOURCES } from '@/design/fixtures';
import { RecipeCard } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';

/** One filter group: a small heading and quiet tick boxes. */
function FacetGroup({
  label,
  values,
  checked = [],
}: {
  label: string;
  values: [string, number][];
  checked?: string[];
}) {
  return (
    <section className="border-ink/10 border-b pb-5">
      <h3 className="text-[11px] font-semibold tracking-[0.18em] uppercase">
        {label}
      </h3>
      <ul className="mt-3 flex flex-col gap-0.5">
        {values.map(([value, count]) => {
          const on = checked.includes(value);
          return (
            <li key={value}>
              <button
                type="button"
                className="hover:bg-ink/5 flex w-full items-center justify-between gap-3 rounded px-1 py-1.5 text-left text-[15px]"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-sm border ${
                      on
                        ? 'border-ink bg-ink text-white'
                        : 'border-ink/35 bg-white'
                    }`}
                  >
                    {on ? (
                      <CheckIcon className="h-3 w-3" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className={on ? 'font-semibold' : ''}>{value}</span>
                </span>
                <span className="text-ink/45 text-xs">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** All the filters, used in the sidebar and in the phone drawer. */
function Filters() {
  return (
    <div className="flex flex-col gap-5">
      {FACETS.map((f, i) => (
        <FacetGroup
          key={f.label}
          label={f.label}
          values={f.values}
          checked={i === 1 ? ['Mexican'] : []}
        />
      ))}
      <FacetGroup label="Source" values={SOURCES} />
    </div>
  );
}

/** Search screen: filters beside the grid on desktop, behind a button on phones. */
export default function DesignSearch() {
  return (
    <DesignShell signedIn active="search">
      <div className="border-ink/10 border-b">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
          <p className="text-ember text-xs font-semibold tracking-[0.18em] uppercase">
            Your collection
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">
            Recipes
          </h1>
          <label className="border-ink/20 focus-within:border-ink mt-6 flex max-w-2xl items-center gap-3 rounded-md border bg-white px-4">
            <SearchIcon className="text-ink/60 h-5 w-5 shrink-0" />
            <input
              placeholder="Search by name, tag or site…"
              className="placeholder:text-ink/45 h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-8 md:grid-cols-[15rem_1fr] md:py-10">
        <aside className="hidden md:sticky md:top-24 md:block md:self-start">
          <button
            type="button"
            className="bg-marigold mb-5 flex w-full items-center justify-between rounded-md px-3.5 py-2.5 text-sm font-semibold"
          >
            <span>♥ Favourites</span>
            <span>5</span>
          </button>
          <Filters />
        </aside>

        <details className="border-ink/15 rounded-md border bg-white md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
            Filters
            <span className="bg-ink rounded px-2 py-0.5 text-xs text-white">
              1
            </span>
          </summary>
          <div className="border-ink/10 border-t p-4">
            <Filters />
          </div>
        </details>

        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ink/65 mr-2 text-sm">85 recipes</p>
              <span className="border-ink/20 inline-flex items-center gap-1.5 rounded border bg-white px-2.5 py-1 text-xs font-medium">
                Mexican <span aria-hidden="true">✕</span>
              </span>
              <button
                type="button"
                className="text-xs font-medium underline underline-offset-4"
              >
                Clear all
              </button>
            </div>
            <label className="text-ink/65 flex items-center gap-2 text-sm">
              Sort
              <select className="border-ink/20 text-ink rounded-md border bg-white px-2.5 py-1.5 text-sm">
                <option>Title A–Z</option>
                <option>Recently changed</option>
              </select>
            </label>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {RECIPES.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              className="border-ink hover:bg-ink rounded-md border px-6 py-3 text-sm font-semibold transition hover:text-white"
            >
              Load more
            </button>
          </div>
        </section>
      </div>
    </DesignShell>
  );
}
