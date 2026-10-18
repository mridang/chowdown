import { CheckIcon, SearchIcon } from '@/design/icons';
import { FACETS, RECIPES, SOURCES } from '@/design/fixtures';
import { RecipeCard } from '@/design/recipe-card';
import { DesignShell } from '@/design/shell';

/** One filter group in the sidebar: a bold heading and chunky tick boxes. */
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
    <section className="border-ink/15 border-b-2 pb-5">
      <h3 className="font-display text-sm tracking-[0.15em] uppercase">
        {label}
      </h3>
      <ul className="mt-3 flex flex-col gap-1.5">
        {values.map(([value, count]) => {
          const on = checked.includes(value);
          return (
            <li key={value}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left text-lg"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`border-ink grid h-5 w-5 place-items-center rounded-md border-2 ${
                      on ? 'bg-flame text-white' : 'bg-white'
                    }`}
                  >
                    {on ? (
                      <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className={on ? 'font-semibold' : ''}>{value}</span>
                </span>
                <span className="font-display text-ink/50 text-xs">
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Search screen: filter sidebar on the left, recipe grid on the right. */
export default function DesignSearch() {
  return (
    <DesignShell signedIn active="search">
      <div className="border-ink bg-marigold border-b-2">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
          <h1 className="font-display text-4xl uppercase sm:text-5xl">
            Recipes
          </h1>
          <div className="border-ink mt-5 flex max-w-2xl items-center gap-2 rounded-full border-2 bg-white p-1.5 shadow-[4px_4px_0_0_var(--color-ink)]">
            <SearchIcon className="ml-3 h-6 w-6 shrink-0" />
            <input
              defaultValue=""
              placeholder="Search by name, tag or site…"
              className="placeholder:text-ink/50 min-w-0 flex-1 bg-transparent px-2 py-2 text-lg outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-8 md:grid-cols-[17rem_1fr]">
        <aside className="flex flex-col gap-5 md:sticky md:top-6 md:self-start">
          <button
            type="button"
            className="border-ink bg-bubblegum font-display flex items-center justify-between rounded-xl border-2 px-4 py-2.5 text-sm tracking-wide uppercase"
          >
            <span>♥ Favourites</span>
            <span>5</span>
          </button>
          {FACETS.map((f, i) => (
            <FacetGroup
              key={f.label}
              label={f.label}
              values={f.values}
              checked={i === 1 ? ['Mexican'] : []}
            />
          ))}
          <FacetGroup label="Source" values={SOURCES} />
        </aside>

        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-sm tracking-wide uppercase">
              85 recipes
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="border-ink bg-flame font-display inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs text-white uppercase">
                Mexican ✕
              </span>
              <button
                type="button"
                className="font-display text-xs uppercase underline underline-offset-4"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
            {RECIPES.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        </section>
      </div>
    </DesignShell>
  );
}
